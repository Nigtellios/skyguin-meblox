import type { Database } from "bun:sqlite";
import type {
  ComponentGroupRow,
  ComponentPayload,
  FurnitureObjectRow,
} from "../../types";
import { getAll, getOne } from "../../utils/db";
import { isStringArray, json, parseObjectBody } from "../../utils/http";
import { syncRelations } from "../../utils/relations";

type ComponentSyncPayload = Partial<
  Pick<
    FurnitureObjectRow,
    "width" | "height" | "depth" | "color" | "material_template_id"
  >
>;

export function createComponentHandlers(database: Database) {
  const getComponents = (_req: Request, params: Record<string, string>) =>
    json(
      getAll<ComponentGroupRow>(
        database,
        "SELECT * FROM component_groups WHERE project_id = ? ORDER BY created_at ASC",
        params.projectId,
      ),
    );

  const createComponent = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const body = await parseObjectBody<ComponentPayload>(req);
    const id = crypto.randomUUID();
    const now = Date.now();
    const objectIds = isStringArray(body.object_ids) ? body.object_ids : [];

    database
      .query(
        "INSERT INTO component_groups (id, project_id, name, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, params.projectId, body.name || "Nowy komponent", now);

    for (const objectId of objectIds) {
      database
        .query(
          "UPDATE furniture_objects SET component_id = ?, is_independent = 0, updated_at = ? WHERE id = ?",
        )
        .run(id, now, objectId);
    }

    const firstObjectId = objectIds.at(0);
    const firstObject = firstObjectId
      ? getOne<FurnitureObjectRow>(
          database,
          "SELECT * FROM furniture_objects WHERE id = ?",
          firstObjectId,
        )
      : null;

    if (firstObject) {
      for (const objectId of objectIds.slice(1)) {
        database
          .query(
            `UPDATE furniture_objects SET
              width = ?,
              height = ?,
              depth = ?,
              color = ?,
              material_template_id = ?,
              updated_at = ?
             WHERE id = ? AND is_independent = 0`,
          )
          .run(
            firstObject.width,
            firstObject.height,
            firstObject.depth,
            firstObject.color,
            firstObject.material_template_id,
            now,
            objectId,
          );
      }
    }

    return json(
      getOne<ComponentGroupRow>(
        database,
        "SELECT * FROM component_groups WHERE id = ?",
        id,
      ),
      201,
    );
  };

  const deleteComponent = (_req: Request, params: Record<string, string>) => {
    database
      .query(
        "UPDATE furniture_objects SET component_id = NULL, is_independent = 0 WHERE component_id = ?",
      )
      .run(params.id);
    database.query("DELETE FROM component_groups WHERE id = ?").run(params.id);
    return json({ success: true });
  };

  const syncComponent = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const body = await parseObjectBody<ComponentSyncPayload>(req);
    const now = Date.now();

    if (body.width !== undefined) {
      database
        .query(
          "UPDATE furniture_objects SET width = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0",
        )
        .run(body.width, now, params.id);
    }

    if (body.height !== undefined) {
      database
        .query(
          "UPDATE furniture_objects SET height = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0",
        )
        .run(body.height, now, params.id);
    }

    if (body.depth !== undefined) {
      database
        .query(
          "UPDATE furniture_objects SET depth = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0",
        )
        .run(body.depth, now, params.id);
    }

    if (body.color !== undefined) {
      database
        .query(
          "UPDATE furniture_objects SET color = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0",
        )
        .run(body.color, now, params.id);
    }

    if (body.material_template_id !== undefined) {
      database
        .query(
          "UPDATE furniture_objects SET material_template_id = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0",
        )
        .run(body.material_template_id, now, params.id);
    }

    const changedIds = getAll<Pick<FurnitureObjectRow, "id">>(
      database,
      "SELECT id FROM furniture_objects WHERE component_id = ? AND is_independent = 0",
      params.id,
    ).map((object) => object.id);
    syncRelations(database, params.projectId, changedIds);

    return json(
      getAll<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE component_id = ? ORDER BY created_at ASC",
        params.id,
      ),
    );
  };

  return { getComponents, createComponent, deleteComponent, syncComponent };
}

export function registerComponentRoutes(
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
  const handlers = createComponentHandlers(database);

  addRoute("GET", "/api/projects/:projectId/components", (req, params) =>
    handlers.getComponents(req, params),
  );
  addRoute("POST", "/api/projects/:projectId/components", (req, params) =>
    handlers.createComponent(req, params),
  );
  addRoute("DELETE", "/api/projects/:projectId/components/:id", (req, params) =>
    handlers.deleteComponent(req, params),
  );
  addRoute(
    "POST",
    "/api/projects/:projectId/components/:id/sync",
    (req, params) => handlers.syncComponent(req, params),
  );
}
