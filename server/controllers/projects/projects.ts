import type { Database } from "bun:sqlite";
import type { ProjectPayload, ProjectRow } from "../../types";
import { getAll, getOne } from "../../utils/db";
import { json, parseObjectBody, toSqlValue } from "../../utils/http";

export function createProjectHandlers(database: Database) {
  const getProjects = () =>
    json(
      getAll<ProjectRow>(
        database,
        "SELECT * FROM projects ORDER BY created_at DESC",
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
          updated_at = ?
         WHERE id = ?`,
      )
      .run(
        toSqlValue(body.name),
        toSqlValue(body.description),
        toSqlValue(body.grid_size_mm),
        toSqlValue(body.grid_visible),
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

  return { getProjects, createProject, updateProject, deleteProject };
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
}
