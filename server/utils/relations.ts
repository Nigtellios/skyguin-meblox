import type { Database } from "bun:sqlite";
import type {
  FurnitureObjectRow,
  ObjectRelationPayload,
  ObjectRelationRow,
  RelationAnchor,
  RelationField,
  RelationMode,
  RelationType,
} from "../types";
import { getAll, getOne } from "./db";

export const OPPOSITE_SIDES: Record<string, string> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
  front: "back",
  back: "front",
};

export const DIMENSION_FIELDS = new Set<RelationField>([
  "width",
  "height",
  "depth",
]);
export const POSITION_FIELDS = new Set<RelationField>([
  "position_x",
  "position_y",
  "position_z",
]);
export const RELATION_TYPES = new Set<RelationType>([
  "dimension",
  "attachment",
]);
export const RELATION_MODES = new Set<RelationMode>([
  "direct",
  "relative",
  "anchor",
]);
export const RELATION_ANCHORS = new Set<RelationAnchor>([
  "start",
  "center",
  "end",
]);
export const MAX_RELATION_PROPAGATION_DEPTH = 200;

export function getAxisDimension(
  field: RelationField,
): Extract<RelationField, "width" | "height" | "depth"> {
  if (field === "position_x") return "width";
  if (field === "position_y") return "height";
  if (field === "position_z") return "depth";
  return field;
}

export function getAnchorShift(
  object: FurnitureObjectRow,
  field: Extract<RelationField, "position_x" | "position_y" | "position_z">,
  anchor: RelationAnchor,
) {
  const dimension = object[getAxisDimension(field)];
  if (anchor === "start") return -dimension / 2;
  if (anchor === "end") return dimension / 2;
  return 0;
}

export function applyObjectRelation(
  relation: ObjectRelationRow,
  source: FurnitureObjectRow,
  target: FurnitureObjectRow,
) {
  if (relation.relation_type === "dimension") {
    if (
      !DIMENSION_FIELDS.has(relation.source_field) ||
      !DIMENSION_FIELDS.has(relation.target_field)
    ) {
      return null;
    }

    return {
      [relation.target_field]:
        source[relation.source_field] +
        (relation.mode === "relative" ? relation.offset_mm : 0),
    } as Partial<FurnitureObjectRow>;
  }

  if (
    !POSITION_FIELDS.has(relation.source_field) ||
    !POSITION_FIELDS.has(relation.target_field) ||
    !relation.source_anchor ||
    !relation.target_anchor
  ) {
    return null;
  }

  const sourceField = relation.source_field as Extract<
    RelationField,
    "position_x" | "position_y" | "position_z"
  >;
  const targetField = relation.target_field as Extract<
    RelationField,
    "position_x" | "position_y" | "position_z"
  >;
  const sourceAnchor =
    source[sourceField] +
    getAnchorShift(source, sourceField, relation.source_anchor);
  const targetShift = getAnchorShift(
    target,
    targetField,
    relation.target_anchor,
  );

  return {
    [targetField]: sourceAnchor + relation.offset_mm - targetShift,
  } as Partial<FurnitureObjectRow>;
}

export function hasObjectChanges(
  target: FurnitureObjectRow,
  updates: Partial<FurnitureObjectRow>,
) {
  return Object.entries(updates).some(([key, value]) => {
    if (typeof value !== "number") {
      return false;
    }
    return target[key as keyof FurnitureObjectRow] !== value;
  });
}

export function getProjectRelations(database: Database, projectId: string) {
  return getAll<ObjectRelationRow>(
    database,
    "SELECT * FROM object_relations WHERE project_id = ? ORDER BY created_at ASC",
    projectId,
  );
}

export function getObjectById(database: Database, id: string) {
  return (
    getOne<FurnitureObjectRow>(
      database,
      "SELECT * FROM furniture_objects WHERE id = ?",
      id,
    ) ?? undefined
  );
}

export function syncRelations(
  database: Database,
  projectId: string,
  changedObjectIds: string[],
) {
  const relations = getProjectRelations(database, projectId);
  if (relations.length === 0 || changedObjectIds.length === 0) {
    return;
  }

  const relationsBySource = new Map<string, ObjectRelationRow[]>();
  for (const relation of relations) {
    const list = relationsBySource.get(relation.source_object_id);
    if (list) {
      list.push(relation);
    } else {
      relationsBySource.set(relation.source_object_id, [relation]);
    }
  }

  const objectCache = new Map<string, FurnitureObjectRow>();

  const queue = [...new Set(changedObjectIds)];
  const processed = new Set<string>();
  let safety = 0;

  while (queue.length > 0 && safety < MAX_RELATION_PROPAGATION_DEPTH) {
    safety += 1;
    const sourceId = queue.shift();
    if (!sourceId) continue;

    let source = objectCache.get(sourceId);
    if (!source) {
      source = getObjectById(database, sourceId);
      if (!source) {
        continue;
      }
      objectCache.set(sourceId, source);
    }

    const sourceRelations = relationsBySource.get(source.id);
    if (!sourceRelations || sourceRelations.length === 0) {
      continue;
    }

    // Process dimension relations before attachment relations so that when
    // attachment positions are computed, the target's dimensions are already
    // up-to-date in the cache (prevents objects from overlapping after a
    // dimension change).
    const dimensionRelations = sourceRelations.filter(
      (relation) => relation.relation_type === "dimension",
    );
    const nonDimensionRelations = sourceRelations.filter(
      (relation) => relation.relation_type !== "dimension",
    );
    const orderedRelations = [...dimensionRelations, ...nonDimensionRelations];

    for (const relation of orderedRelations) {
      let target = objectCache.get(relation.target_object_id);
      if (!target) {
        target = getObjectById(database, relation.target_object_id);
        if (!target) {
          continue;
        }
        objectCache.set(relation.target_object_id, target);
      }

      const updates = applyObjectRelation(relation, source, target);
      if (!updates || !hasObjectChanges(target, updates)) {
        continue;
      }

      const assignments = Object.entries(updates)
        .filter(([, value]) => typeof value === "number")
        .map(([key]) => `${key} = ?`);

      if (assignments.length === 0) {
        continue;
      }

      const values = Object.entries(updates)
        .filter(([, value]) => typeof value === "number")
        .map(([, value]) => value as number);

      const updatedAt = Date.now();
      database
        .query(
          `UPDATE furniture_objects SET ${assignments.join(", ")}, updated_at = ? WHERE id = ?`,
        )
        .run(...values, updatedAt, target.id);

      // Update the in-memory cache so that subsequent relations for this
      // target (either as target or later as source) use the fresh values.
      Object.assign(target, updates, { updated_at: updatedAt });

      const relationKey = `${relation.id}:${target.id}`;
      if (!processed.has(relationKey)) {
        queue.push(target.id);
        processed.add(relationKey);
      }
    }
  }

  if (safety >= MAX_RELATION_PROPAGATION_DEPTH && queue.length > 0) {
    console.warn(
      `syncRelations reached MAX_RELATION_PROPAGATION_DEPTH (${MAX_RELATION_PROPAGATION_DEPTH}) for project ${projectId}; ` +
        `${queue.length} object(s) remain in the propagation queue.`,
    );
  }
}

export function buildRelation(
  database: Database,
  projectId: string,
  body: ObjectRelationPayload,
): ObjectRelationRow | null {
  const sourceId = body.source_object_id;
  const targetId = body.target_object_id;
  const relationType = body.relation_type;
  const sourceField = body.source_field;
  const targetField = body.target_field;
  const mode = body.mode;

  if (
    !sourceId ||
    !targetId ||
    sourceId === targetId ||
    !relationType ||
    !RELATION_TYPES.has(relationType) ||
    !sourceField ||
    !targetField ||
    !mode ||
    !RELATION_MODES.has(mode)
  ) {
    return null;
  }

  if (relationType === "dimension") {
    if (
      !DIMENSION_FIELDS.has(sourceField) ||
      !DIMENSION_FIELDS.has(targetField) ||
      !["direct", "relative"].includes(mode)
    ) {
      return null;
    }
  }

  if (relationType === "attachment") {
    if (
      !POSITION_FIELDS.has(sourceField) ||
      !POSITION_FIELDS.has(targetField) ||
      mode !== "anchor"
    ) {
      return null;
    }
    if (
      !body.source_anchor ||
      !body.target_anchor ||
      !RELATION_ANCHORS.has(body.source_anchor) ||
      !RELATION_ANCHORS.has(body.target_anchor)
    ) {
      return null;
    }
  }

  const sourceObject = getObjectById(database, sourceId);
  const targetObject = getObjectById(database, targetId);
  if (
    !sourceObject ||
    !targetObject ||
    sourceObject.project_id !== projectId ||
    targetObject.project_id !== projectId
  ) {
    return null;
  }

  const relation: ObjectRelationRow = {
    id: crypto.randomUUID(),
    project_id: projectId,
    source_object_id: sourceId,
    target_object_id: targetId,
    relation_type: relationType,
    source_field: sourceField,
    target_field: targetField,
    mode,
    source_anchor:
      relationType === "attachment" ? (body.source_anchor ?? null) : null,
    target_anchor:
      relationType === "attachment" ? (body.target_anchor ?? null) : null,
    offset_mm:
      typeof body.offset_mm === "number"
        ? body.offset_mm
        : relationType === "dimension"
          ? mode === "relative"
            ? targetObject[targetField] - sourceObject[sourceField]
            : 0
          : targetObject[targetField] +
            getAnchorShift(
              targetObject,
              targetField as Extract<
                RelationField,
                "position_x" | "position_y" | "position_z"
              >,
              body.target_anchor as RelationAnchor,
            ) -
            (sourceObject[sourceField] +
              getAnchorShift(
                sourceObject,
                sourceField as Extract<
                  RelationField,
                  "position_x" | "position_y" | "position_z"
                >,
                body.source_anchor as RelationAnchor,
              )),
    created_at: Date.now(),
  };

  return relation;
}
