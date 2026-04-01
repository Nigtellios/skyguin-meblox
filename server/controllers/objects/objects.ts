import type { Database } from "bun:sqlite";
import type {
  DuplicatePayload,
  FurnitureObjectPayload,
  FurnitureObjectRow,
} from "../../types";
import { getAll, getOne } from "../../utils/db";
import {
  json,
  parseArrayBody,
  parseObjectBody,
  toSqlValue,
} from "../../utils/http";
import { syncRelations } from "../../utils/relations";

export function createObjectHandlers(database: Database) {
  const getObjects = (_req: Request, params: Record<string, string>) =>
    json(
      getAll<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE project_id = ? ORDER BY created_at ASC",
        params.projectId,
      ),
    );

  const createObject = async (req: Request, params: Record<string, string>) => {
    const body = await parseObjectBody<FurnitureObjectPayload>(req);
    const id = crypto.randomUUID();
    const now = Date.now();

    database
      .query(
        `INSERT INTO furniture_objects (
          id, project_id, name, width, height, depth,
          position_x, position_y, position_z, rotation_y,
          color, material_type, edge_banding_json, material_template_id, component_id, is_independent,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        params.projectId,
        body.name || "Nowy element",
        body.width ?? 600,
        body.height ?? 720,
        body.depth ?? 18,
        body.position_x ?? 0,
        body.position_y ?? 0,
        body.position_z ?? 0,
        body.rotation_y ?? 0,
        body.color ?? "#8B7355",
        body.material_type ?? "wood",
        body.edge_banding_json ?? null,
        body.material_template_id ?? null,
        body.component_id ?? null,
        body.is_independent ?? 0,
        now,
        now,
      );

    return json(
      getOne<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE id = ?",
        id,
      ),
      201,
    );
  };

  const updateObject = async (req: Request, params: Record<string, string>) => {
    const body = await parseObjectBody<FurnitureObjectPayload>(req);
    const now = Date.now();

    const existingObject = getOne<FurnitureObjectRow>(
      database,
      "SELECT * FROM furniture_objects WHERE id = ? AND project_id = ?",
      params.id,
      params.projectId,
    );

    if (!existingObject) {
      return new Response("Not found", { status: 404 });
    }

    const materialTemplateId =
      body.material_template_id !== undefined
        ? body.material_template_id
        : (existingObject?.material_template_id ?? null);

    database
      .query(
        `UPDATE furniture_objects SET
          name = COALESCE(?, name),
          width = COALESCE(?, width),
          height = COALESCE(?, height),
          depth = COALESCE(?, depth),
          position_x = COALESCE(?, position_x),
          position_y = COALESCE(?, position_y),
          position_z = COALESCE(?, position_z),
          rotation_y = COALESCE(?, rotation_y),
          color = COALESCE(?, color),
          material_type = COALESCE(?, material_type),
          edge_banding_json = COALESCE(?, edge_banding_json),
          material_template_id = ?,
          component_id = COALESCE(?, component_id),
          is_independent = COALESCE(?, is_independent),
          updated_at = ?
         WHERE id = ? AND project_id = ?`,
      )
      .run(
        toSqlValue(body.name),
        toSqlValue(body.width),
        toSqlValue(body.height),
        toSqlValue(body.depth),
        toSqlValue(body.position_x),
        toSqlValue(body.position_y),
        toSqlValue(body.position_z),
        toSqlValue(body.rotation_y),
        toSqlValue(body.color),
        toSqlValue(body.material_type),
        toSqlValue(body.edge_banding_json),
        toSqlValue(materialTemplateId),
        toSqlValue(body.component_id),
        toSqlValue(body.is_independent),
        now,
        params.id,
        params.projectId,
      );

    const positionFieldChanged =
      body.position_x !== undefined ||
      body.position_y !== undefined ||
      body.position_z !== undefined;

    const companionIds: string[] = [];

    if (
      positionFieldChanged &&
      existingObject?.component_id &&
      !existingObject.is_independent
    ) {
      const dx =
        (body.position_x ?? existingObject.position_x) -
        existingObject.position_x;
      const dy =
        (body.position_y ?? existingObject.position_y) -
        existingObject.position_y;
      const dz =
        (body.position_z ?? existingObject.position_z) -
        existingObject.position_z;

      if (dx !== 0 || dy !== 0 || dz !== 0) {
        database
          .query(
            `UPDATE furniture_objects
              SET position_x = position_x + ?,
                  position_y = position_y + ?,
                  position_z = position_z + ?,
                  updated_at = ?
              WHERE component_id = ?
                AND is_independent = 0
                AND id != ?
                AND project_id = ?`,
          )
          .run(
            dx,
            dy,
            dz,
            now,
            existingObject.component_id,
            params.id,
            params.projectId,
          );

        const companions = getAll<Pick<FurnitureObjectRow, "id">>(
          database,
          "SELECT id FROM furniture_objects WHERE component_id = ? AND is_independent = 0 AND id != ? AND project_id = ?",
          existingObject.component_id,
          params.id,
          params.projectId,
        );
        for (const c of companions) {
          companionIds.push(c.id);
        }
      }
    }

    return json(
      (() => {
        syncRelations(database, params.projectId, [params.id, ...companionIds]);
        return getOne<FurnitureObjectRow>(
          database,
          "SELECT * FROM furniture_objects WHERE id = ?",
          params.id,
        );
      })(),
    );
  };

  const updateObjectsBatch = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const updates = await parseArrayBody<
      FurnitureObjectPayload & { id?: string }
    >(req);
    const now = Date.now();

    for (const item of updates) {
      if (!item.id) {
        continue;
      }

      database
        .query(
          `UPDATE furniture_objects SET
            name = COALESCE(?, name),
            width = COALESCE(?, width),
            height = COALESCE(?, height),
            depth = COALESCE(?, depth),
            color = COALESCE(?, color),
            updated_at = ?
           WHERE id = ? AND project_id = ?`,
        )
        .run(
          toSqlValue(item.name),
          toSqlValue(item.width),
          toSqlValue(item.height),
          toSqlValue(item.depth),
          toSqlValue(item.color),
          now,
          item.id,
          params.projectId,
        );
    }

    return json({ success: true, updated: updates.length });
  };

  const deleteObject = (_req: Request, params: Record<string, string>) => {
    database
      .query("DELETE FROM furniture_objects WHERE id = ? AND project_id = ?")
      .run(params.id, params.projectId);
    return json({ success: true });
  };

  const duplicateObject = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const source = getOne<FurnitureObjectRow>(
      database,
      "SELECT * FROM furniture_objects WHERE id = ? AND project_id = ?",
      params.id,
      params.projectId,
    );
    if (!source) {
      return json({ error: "Not found" }, 404);
    }

    const body = await parseObjectBody<DuplicatePayload>(req);
    const newId = crypto.randomUUID();
    const now = Date.now();

    database
      .query(
        `INSERT INTO furniture_objects (
          id, project_id, name, width, height, depth,
          position_x, position_y, position_z, rotation_y,
          color, material_type, edge_banding_json, material_template_id, component_id, is_independent,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        source.project_id,
        `${source.name} (kopia)`,
        source.width,
        source.height,
        source.depth,
        source.position_x + (body.offset_x ?? 50),
        source.position_y,
        source.position_z + (body.offset_z ?? 50),
        source.rotation_y,
        source.color,
        source.material_type,
        source.edge_banding_json,
        source.material_template_id,
        null,
        0,
        now,
        now,
      );

    return json(
      getOne<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE id = ?",
        newId,
      ),
      201,
    );
  };

  return {
    getObjects,
    createObject,
    updateObject,
    updateObjectsBatch,
    deleteObject,
    duplicateObject,
  };
}

export function registerObjectRoutes(
  addRoute: (
    method: string,
    path: string,
    handler: (
      req: Request,
      params: Record<string, string>,
    ) => Response | Promise<Response>,
  ) => void,
  database: Database,
) {
  const handlers = createObjectHandlers(database);

  addRoute("GET", "/api/projects/:projectId/objects", (req, params) =>
    handlers.getObjects(req, params),
  );
  addRoute("POST", "/api/projects/:projectId/objects", (req, params) =>
    handlers.createObject(req, params),
  );
  addRoute("PUT", "/api/projects/:projectId/objects/batch", (req, params) =>
    handlers.updateObjectsBatch(req, params),
  );
  addRoute("PUT", "/api/projects/:projectId/objects/:id", (req, params) =>
    handlers.updateObject(req, params),
  );
  addRoute("DELETE", "/api/projects/:projectId/objects/:id", (req, params) =>
    handlers.deleteObject(req, params),
  );
  addRoute(
    "POST",
    "/api/projects/:projectId/objects/:id/duplicate",
    (req, params) => handlers.duplicateObject(req, params),
  );
}
