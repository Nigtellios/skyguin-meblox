import type { Database } from "bun:sqlite";
import type { FurnitureObjectRow, HistoryRow } from "../../types";
import { getAll, getOne } from "../../utils/db";
import { json, parseObjectBody } from "../../utils/http";

const MAX_HISTORY_ENTRIES = 100;

export function createHistoryHandlers(database: Database) {
  const getHistory = (_req: Request, params: Record<string, string>) =>
    json(
      getAll<Omit<HistoryRow, "snapshot">>(
        database,
        "SELECT id, project_id, action_type, action_label, created_at FROM project_history WHERE project_id = ? ORDER BY created_at ASC, rowid ASC",
        params.projectId,
      ),
    );

  const addHistory = async (req: Request, params: Record<string, string>) => {
    const body = await parseObjectBody<{
      action_type?: string;
      action_label?: string;
      snapshot?: string;
      trim_after_id?: string;
    }>(req);
    const id = crypto.randomUUID();
    const now = Date.now();

    if (body.trim_after_id) {
      const afterEntry = getOne<
        Pick<HistoryRow, "created_at"> & { rowid: number }
      >(
        database,
        "SELECT rowid, created_at FROM project_history WHERE id = ? AND project_id = ?",
        body.trim_after_id,
        params.projectId,
      );
      if (afterEntry) {
        database
          .query(
            "DELETE FROM project_history WHERE project_id = ? AND (created_at > ? OR (created_at = ? AND rowid > ?))",
          )
          .run(
            params.projectId,
            afterEntry.created_at,
            afterEntry.created_at,
            afterEntry.rowid,
          );
      }
    }

    database
      .query(
        "INSERT INTO project_history (id, project_id, action_type, action_label, snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        params.projectId,
        body.action_type || "unknown",
        body.action_label || "Zmiana",
        body.snapshot || "[]",
        now,
      );

    database
      .query(
        `DELETE FROM project_history WHERE project_id = ? AND id NOT IN (
          SELECT id FROM project_history WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
        )`,
      )
      .run(params.projectId, params.projectId, MAX_HISTORY_ENTRIES);

    return json(
      getOne<Omit<HistoryRow, "snapshot">>(
        database,
        "SELECT id, project_id, action_type, action_label, created_at FROM project_history WHERE id = ?",
        id,
      ),
      201,
    );
  };

  const revertHistory = async (
    _req: Request,
    params: Record<string, string>,
  ) => {
    const entry = getOne<HistoryRow>(
      database,
      "SELECT * FROM project_history WHERE id = ? AND project_id = ?",
      params.historyId,
      params.projectId,
    );
    if (!entry) return json({ error: "History entry not found" }, 404);

    let objects: FurnitureObjectRow[] = [];
    try {
      objects = JSON.parse(entry.snapshot) as FurnitureObjectRow[];
    } catch {
      return json({ error: "Invalid snapshot" }, 400);
    }

    const now = Date.now();

    const executeRevert = database.transaction(() => {
      database
        .query("DELETE FROM furniture_objects WHERE project_id = ?")
        .run(params.projectId);

      const insertStmt = database.prepare(
        `INSERT INTO furniture_objects (
          id, project_id, name, width, height, depth,
          position_x, position_y, position_z, rotation_y,
          color, material_template_id, component_id, is_independent,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const obj of objects) {
        insertStmt.run(
          obj.id,
          params.projectId,
          obj.name,
          obj.width,
          obj.height,
          obj.depth,
          obj.position_x,
          obj.position_y,
          obj.position_z,
          obj.rotation_y,
          obj.color,
          obj.material_template_id,
          obj.component_id,
          obj.is_independent,
          obj.created_at,
          now,
        );
      }

      database
        .query(
          "DELETE FROM project_history WHERE project_id = ? AND created_at > ?",
        )
        .run(params.projectId, entry.created_at);
    });

    executeRevert();

    return json({
      success: true,
      objects: getAll<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE project_id = ? ORDER BY created_at ASC",
        params.projectId,
      ),
    });
  };

  const navigateHistory = async (
    _req: Request,
    params: Record<string, string>,
  ) => {
    const entry = getOne<HistoryRow>(
      database,
      "SELECT * FROM project_history WHERE id = ? AND project_id = ?",
      params.historyId,
      params.projectId,
    );
    if (!entry) return json({ error: "History entry not found" }, 404);

    let objects: FurnitureObjectRow[] = [];
    try {
      objects = JSON.parse(entry.snapshot) as FurnitureObjectRow[];
    } catch {
      return json({ error: "Invalid snapshot" }, 400);
    }

    const now = Date.now();

    const executeRestore = database.transaction(() => {
      database
        .query("DELETE FROM furniture_objects WHERE project_id = ?")
        .run(params.projectId);

      const insertStmt = database.prepare(
        `INSERT INTO furniture_objects (
          id, project_id, name, width, height, depth,
          position_x, position_y, position_z, rotation_y,
          color, material_template_id, component_id, is_independent,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const obj of objects) {
        insertStmt.run(
          obj.id,
          params.projectId,
          obj.name,
          obj.width,
          obj.height,
          obj.depth,
          obj.position_x,
          obj.position_y,
          obj.position_z,
          obj.rotation_y,
          obj.color,
          obj.material_template_id,
          obj.component_id,
          obj.is_independent,
          obj.created_at,
          now,
        );
      }
      // navigate does NOT delete future history entries
    });

    executeRestore();

    return json({
      success: true,
      objects: getAll<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE project_id = ? ORDER BY created_at ASC",
        params.projectId,
      ),
    });
  };

  return { getHistory, addHistory, revertHistory, navigateHistory };
}

export function registerHistoryRoutes(
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
  const handlers = createHistoryHandlers(database);

  addRoute("GET", "/api/projects/:projectId/history", (req, params) =>
    handlers.getHistory(req, params),
  );
  addRoute("POST", "/api/projects/:projectId/history", (req, params) =>
    handlers.addHistory(req, params),
  );
  addRoute(
    "POST",
    "/api/projects/:projectId/history/:historyId/revert",
    (req, params) => handlers.revertHistory(req, params),
  );
  addRoute(
    "POST",
    "/api/projects/:projectId/history/:historyId/navigate",
    (req, params) => handlers.navigateHistory(req, params),
  );
}
