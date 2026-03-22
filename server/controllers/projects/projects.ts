import type { Database } from "bun:sqlite";
import type {
  ComponentGroupRow,
  FurnitureObjectRow,
  ObjectRelationRow,
  ProjectPayload,
  ProjectRow,
} from "../../types";
import { getAll, getOne } from "../../utils/db";
import { json, parseObjectBody, toSqlValue } from "../../utils/http";

export function createProjectHandlers(database: Database) {
  const getProjects = () =>
    json(
      getAll<ProjectRow>(
        database,
        "SELECT * FROM projects ORDER BY updated_at DESC",
      ),
    );

  const createProject = async (req: Request) => {
    const body = await parseObjectBody<ProjectPayload>(req);
    const id = crypto.randomUUID();
    const now = Date.now();

    database
      .query(
        `INSERT INTO projects (id, name, description, grid_size_mm, grid_visible, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        body.name || "Nowy projekt",
        body.description || "",
        body.grid_size_mm ?? 100,
        body.grid_visible ?? 1,
        now,
        now,
      );

    return json(
      getOne<ProjectRow>(database, "SELECT * FROM projects WHERE id = ?", id),
      201,
    );
  };

  const updateProject = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const body = await parseObjectBody<ProjectPayload>(req);
    const now = Date.now();

    database
      .query(
        `UPDATE projects SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          grid_size_mm = COALESCE(?, grid_size_mm),
          grid_visible = COALESCE(?, grid_visible),
          thumbnail = COALESCE(?, thumbnail),
          updated_at = ?
         WHERE id = ?`,
      )
      .run(
        toSqlValue(body.name),
        toSqlValue(body.description),
        toSqlValue(body.grid_size_mm),
        toSqlValue(body.grid_visible),
        toSqlValue(body.thumbnail),
        now,
        params.id,
      );

    return json(
      getOne<ProjectRow>(
        database,
        "SELECT * FROM projects WHERE id = ?",
        params.id,
      ),
    );
  };

  const deleteProject = (_req: Request, params: Record<string, string>) => {
    database.query("DELETE FROM projects WHERE id = ?").run(params.id);
    return json({ success: true });
  };

  const duplicateProject = (_req: Request, params: Record<string, string>) => {
    const source = getOne<ProjectRow>(
      database,
      "SELECT * FROM projects WHERE id = ?",
      params.id,
    );
    if (!source) {
      return json({ error: "Project not found" }, 404);
    }

    const newProjectId = crypto.randomUUID();
    const now = Date.now();

    database
      .query(
        `INSERT INTO projects (id, name, description, grid_size_mm, grid_visible, thumbnail, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newProjectId,
        `${source.name} (kopia)`,
        source.description,
        source.grid_size_mm,
        source.grid_visible,
        source.thumbnail ?? null,
        now,
        now,
      );

    // Map old component group IDs → new component group IDs
    const componentIdMap = new Map<string, string>();
    const oldComponents = getAll<ComponentGroupRow>(
      database,
      "SELECT * FROM component_groups WHERE project_id = ?",
      params.id,
    );
    for (const comp of oldComponents) {
      const newCompId = crypto.randomUUID();
      componentIdMap.set(comp.id, newCompId);
      database
        .query(
          `INSERT INTO component_groups (id, project_id, name, created_at) VALUES (?, ?, ?, ?)`,
        )
        .run(newCompId, newProjectId, comp.name, now);
    }

    // Map old object IDs → new object IDs
    const objectIdMap = new Map<string, string>();
    const oldObjects = getAll<FurnitureObjectRow>(
      database,
      "SELECT * FROM furniture_objects WHERE project_id = ?",
      params.id,
    );
    for (const obj of oldObjects) {
      const newObjId = crypto.randomUUID();
      objectIdMap.set(obj.id, newObjId);
      const newCompId = obj.component_id
        ? (componentIdMap.get(obj.component_id) ?? null)
        : null;
      database
        .query(
          `INSERT INTO furniture_objects
            (id, project_id, name, width, height, depth, position_x, position_y, position_z,
             rotation_y, color, material_template_id, component_id, is_independent, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newObjId,
          newProjectId,
          obj.name,
          obj.width,
          obj.height,
          obj.depth,
          obj.position_x,
          obj.position_y,
          obj.position_z,
          obj.rotation_y,
          obj.color,
          obj.material_template_id ?? null,
          newCompId,
          obj.is_independent,
          now,
          now,
        );
    }

    // Copy object relations
    const oldRelations = getAll<ObjectRelationRow>(
      database,
      "SELECT * FROM object_relations WHERE project_id = ?",
      params.id,
    );
    for (const rel of oldRelations) {
      const newSrcId = objectIdMap.get(rel.source_object_id);
      const newTgtId = objectIdMap.get(rel.target_object_id);
      if (!newSrcId || !newTgtId) continue;
      database
        .query(
          `INSERT INTO object_relations
            (id, project_id, source_object_id, target_object_id, relation_type,
             source_field, target_field, mode, source_anchor, target_anchor, offset_mm, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          newProjectId,
          newSrcId,
          newTgtId,
          rel.relation_type,
          rel.source_field,
          rel.target_field,
          rel.mode,
          rel.source_anchor ?? null,
          rel.target_anchor ?? null,
          rel.offset_mm,
          now,
        );
    }

    return json(
      getOne<ProjectRow>(
        database,
        "SELECT * FROM projects WHERE id = ?",
        newProjectId,
      ),
      201,
    );
  };

  const saveThumbnail = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const body = await parseObjectBody<{ thumbnail: string }>(req);
    if (!body.thumbnail) {
      return json({ error: "thumbnail is required" }, 400);
    }
    database
      .query("UPDATE projects SET thumbnail = ?, updated_at = ? WHERE id = ?")
      .run(body.thumbnail, Date.now(), params.id);
    return json({ success: true });
  };

  return {
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
    saveThumbnail,
  };
}

export function registerProjectRoutes(
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
  const handlers = createProjectHandlers(database);

  addRoute("GET", "/api/projects", () => handlers.getProjects());
  addRoute("POST", "/api/projects", (req) => handlers.createProject(req));
  addRoute("PUT", "/api/projects/:id", (req, params) =>
    handlers.updateProject(req, params),
  );
  addRoute("DELETE", "/api/projects/:id", (req, params) =>
    handlers.deleteProject(req, params),
  );
  addRoute("POST", "/api/projects/:id/duplicate", (req, params) =>
    handlers.duplicateProject(req, params),
  );
  addRoute("POST", "/api/projects/:id/thumbnail", (req, params) =>
    handlers.saveThumbnail(req, params),
  );
}
