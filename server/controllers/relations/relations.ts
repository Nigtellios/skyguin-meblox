import type { Database } from "bun:sqlite";
import type { ObjectRelationPayload, ObjectRelationRow } from "../../types";
import { getOne } from "../../utils/db";
import { json, parseObjectBody } from "../../utils/http";
import {
  buildRelation,
  getProjectRelations,
  syncRelations,
} from "../../utils/relations";

export function createRelationHandlers(database: Database) {
  const getRelations = (_req: Request, params: Record<string, string>) =>
    json(getProjectRelations(database, params.projectId));

  const createRelation = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const body = await parseObjectBody<ObjectRelationPayload>(req);
    const relation = buildRelation(database, params.projectId, body);
    if (!relation) {
      return json({ error: "Niepoprawna definicja relacji" }, 400);
    }

    database
      .query(
        `INSERT INTO object_relations (
          id, project_id, source_object_id, target_object_id, relation_type,
          source_field, target_field, mode, source_anchor, target_anchor,
          offset_mm, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        relation.id,
        relation.project_id,
        relation.source_object_id,
        relation.target_object_id,
        relation.relation_type,
        relation.source_field,
        relation.target_field,
        relation.mode,
        relation.source_anchor,
        relation.target_anchor,
        relation.offset_mm,
        relation.created_at,
      );

    syncRelations(database, params.projectId, [relation.source_object_id]);
    return json(
      getOne<ObjectRelationRow>(
        database,
        "SELECT * FROM object_relations WHERE id = ?",
        relation.id,
      ),
      201,
    );
  };

  const deleteRelation = (_req: Request, params: Record<string, string>) => {
    database
      .query("DELETE FROM object_relations WHERE id = ? AND project_id = ?")
      .run(params.id, params.projectId);
    return json({ success: true });
  };

  return { getRelations, createRelation, deleteRelation };
}

export function registerRelationRoutes(
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
  const handlers = createRelationHandlers(database);

  addRoute("GET", "/api/projects/:projectId/relations", (req, params) =>
    handlers.getRelations(req, params),
  );
  addRoute("POST", "/api/projects/:projectId/relations", (req, params) =>
    handlers.createRelation(req, params),
  );
  addRoute("DELETE", "/api/projects/:projectId/relations/:id", (req, params) =>
    handlers.deleteRelation(req, params),
  );
}
