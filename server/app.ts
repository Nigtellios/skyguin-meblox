import type { Database } from "bun:sqlite";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ComponentGroupRow,
  ComponentPayload,
  DuplicatePayload,
  FurnitureObjectPayload,
  FurnitureObjectRow,
  HistoryRow,
  MaterialLayerPayload,
  MaterialLayerRow,
  MaterialTemplatePayload,
  MaterialTemplateRow,
  MaterialTemplateWithLayers,
  ProjectPayload,
  ProjectRow,
  Route,
  RouteHandler,
} from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_PATH = resolve(join(__dirname, "../client/dist"));

const OPPOSITE_SIDES: Record<string, string> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
  front: "back",
  back: "front",
};

type JsonObject = Record<string, unknown>;
type SqlValue = string | number | bigint | boolean | Uint8Array | null;

function toSqlValue(value: SqlValue | undefined) {
  return value ?? null;
}

type ComponentSyncPayload = Partial<
  Pick<
    FurnitureObjectRow,
    "width" | "height" | "depth" | "color" | "material_template_id"
  >
>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

async function parseJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function parseObjectBody<T>(req: Request): Promise<Partial<T>> {
  const value = await parseJson(req);
  return isJsonObject(value) ? (value as Partial<T>) : {};
}

async function parseArrayBody<T>(req: Request): Promise<T[]> {
  const value = await parseJson(req);
  return Array.isArray(value) ? (value as T[]) : [];
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cors(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function getOne<T>(database: Database, sql: string, ...params: SqlValue[]) {
  return database.query(sql).get(...params) as T | null;
}

function getAll<T>(database: Database, sql: string, ...params: SqlValue[]) {
  return database.query(sql).all(...params) as T[];
}

function createRouter() {
  const routes: Route[] = [];

  function addRoute(method: string, path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    const pattern = new RegExp(
      "^" +
        path.replace(/:([^/]+)/g, (_match, name: string) => {
          paramNames.push(name);
          return "([^/]+)";
        }) +
        "$",
    );
    routes.push({ method, pattern, paramNames, handler });
  }

  return { addRoute, routes };
}

export function createFetchHandler(database: Database) {
  const { addRoute, routes } = createRouter();

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
          color, material_template_id, component_id, is_independent,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const existingObject = getOne<
      Pick<FurnitureObjectRow, "material_template_id">
    >(
      database,
      "SELECT material_template_id FROM furniture_objects WHERE id = ?",
      params.id,
    );
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
          material_template_id = ?,
          component_id = COALESCE(?, component_id),
          is_independent = COALESCE(?, is_independent),
          updated_at = ?
         WHERE id = ?`,
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
        toSqlValue(materialTemplateId),
        toSqlValue(body.component_id),
        toSqlValue(body.is_independent),
        now,
        params.id,
      );

    return json(
      getOne<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE id = ?",
        params.id,
      ),
    );
  };

  const updateObjectsBatch = async (req: Request) => {
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
           WHERE id = ?`,
        )
        .run(
          toSqlValue(item.name),
          toSqlValue(item.width),
          toSqlValue(item.height),
          toSqlValue(item.depth),
          toSqlValue(item.color),
          now,
          item.id,
        );
    }

    return json({ success: true, updated: updates.length });
  };

  const deleteObject = (_req: Request, params: Record<string, string>) => {
    database.query("DELETE FROM furniture_objects WHERE id = ?").run(params.id);
    return json({ success: true });
  };

  const duplicateObject = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const source = getOne<FurnitureObjectRow>(
      database,
      "SELECT * FROM furniture_objects WHERE id = ?",
      params.id,
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
          color, material_template_id, component_id, is_independent,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    return json(
      getAll<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE component_id = ? ORDER BY created_at ASC",
        params.id,
      ),
    );
  };

  const getMaterialTemplates = () => {
    const templates = getAll<MaterialTemplateRow>(
      database,
      "SELECT * FROM material_templates ORDER BY created_at DESC",
    );
    const layers = getAll<MaterialLayerRow>(
      database,
      "SELECT * FROM material_layers ORDER BY template_id, side, sort_order",
    );
    const templateMap = new Map<string, MaterialTemplateWithLayers>();

    for (const template of templates) {
      templateMap.set(template.id, { ...template, layers: [] });
    }

    for (const layer of layers) {
      templateMap.get(layer.template_id)?.layers.push(layer);
    }

    return json(Array.from(templateMap.values()));
  };

  const createMaterialTemplate = async (req: Request) => {
    const body = await parseObjectBody<MaterialTemplatePayload>(req);
    const id = crypto.randomUUID();
    const now = Date.now();

    database
      .query(
        "INSERT INTO material_templates (id, name, description, base_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        body.name || "Nowy materiał",
        body.description || "",
        body.base_color || "#8B7355",
        now,
        now,
      );

    const template = getOne<MaterialTemplateRow>(
      database,
      "SELECT * FROM material_templates WHERE id = ?",
      id,
    );
    if (!template) {
      return json({ error: "Template not found" }, 404);
    }

    return json({ ...template, layers: [] }, 201);
  };

  const updateMaterialTemplate = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const body = await parseObjectBody<MaterialTemplatePayload>(req);
    const now = Date.now();

    database
      .query(
        `UPDATE material_templates SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          base_color = COALESCE(?, base_color),
          updated_at = ?
         WHERE id = ?`,
      )
      .run(
        toSqlValue(body.name),
        toSqlValue(body.description),
        toSqlValue(body.base_color),
        now,
        params.id,
      );

    const template = getOne<MaterialTemplateRow>(
      database,
      "SELECT * FROM material_templates WHERE id = ?",
      params.id,
    );
    const layers = getAll<MaterialLayerRow>(
      database,
      "SELECT * FROM material_layers WHERE template_id = ? ORDER BY side, sort_order",
      params.id,
    );

    return json(template ? { ...template, layers } : null);
  };

  const deleteMaterialTemplate = (
    _req: Request,
    params: Record<string, string>,
  ) => {
    database
      .query("DELETE FROM material_templates WHERE id = ?")
      .run(params.id);
    return json({ success: true });
  };

  const createMaterialLayer = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const body = await parseObjectBody<MaterialLayerPayload>(req);
    const id = crypto.randomUUID();
    const now = Date.now();
    const side = body.side || "top";
    const isBilateral = body.is_bilateral ? 1 : 0;
    const oppositeSide = OPPOSITE_SIDES[side] ?? null;

    database
      .query(
        `INSERT INTO material_layers (
          id, template_id, side, layer_type, color,
          thickness, is_bilateral, opposite_side, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        params.templateId,
        side,
        body.layer_type || "veneer",
        body.color || "#D4A574",
        body.thickness ?? 0.5,
        isBilateral,
        isBilateral ? oppositeSide : null,
        body.sort_order ?? 0,
        now,
      );

    if (isBilateral && oppositeSide) {
      database
        .query(
          `INSERT INTO material_layers (
            id, template_id, side, layer_type, color,
            thickness, is_bilateral, opposite_side, sort_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          params.templateId,
          oppositeSide,
          body.layer_type || "veneer",
          body.color || "#D4A574",
          body.thickness ?? 0.5,
          1,
          side,
          body.sort_order ?? 0,
          now,
        );
    }

    database
      .query("UPDATE material_templates SET updated_at = ? WHERE id = ?")
      .run(now, params.templateId);

    return json(
      getAll<MaterialLayerRow>(
        database,
        "SELECT * FROM material_layers WHERE template_id = ? ORDER BY side, sort_order",
        params.templateId,
      ),
      201,
    );
  };

  const updateMaterialLayer = async (
    req: Request,
    params: Record<string, string>,
  ) => {
    const body = await parseObjectBody<MaterialLayerPayload>(req);
    const now = Date.now();

    database
      .query(
        `UPDATE material_layers SET
          layer_type = COALESCE(?, layer_type),
          color = COALESCE(?, color),
          thickness = COALESCE(?, thickness)
         WHERE id = ?`,
      )
      .run(
        toSqlValue(body.layer_type),
        toSqlValue(body.color),
        toSqlValue(body.thickness),
        params.layerId,
      );

    const layer = getOne<MaterialLayerRow>(
      database,
      "SELECT * FROM material_layers WHERE id = ?",
      params.layerId,
    );

    if (layer?.is_bilateral && layer.opposite_side) {
      const oppositeLayer = getOne<Pick<MaterialLayerRow, "id">>(
        database,
        "SELECT id FROM material_layers WHERE template_id = ? AND side = ? AND is_bilateral = 1",
        layer.template_id,
        layer.opposite_side,
      );

      if (oppositeLayer) {
        database
          .query(
            `UPDATE material_layers SET
              layer_type = COALESCE(?, layer_type),
              color = COALESCE(?, color),
              thickness = COALESCE(?, thickness)
             WHERE id = ?`,
          )
          .run(
            toSqlValue(body.layer_type),
            toSqlValue(body.color),
            toSqlValue(body.thickness),
            oppositeLayer.id,
          );
      }
    }

    if (!layer) {
      return json([], 404);
    }

    database
      .query("UPDATE material_templates SET updated_at = ? WHERE id = ?")
      .run(now, layer.template_id);

    return json(
      getAll<MaterialLayerRow>(
        database,
        "SELECT * FROM material_layers WHERE template_id = ? ORDER BY side, sort_order",
        layer.template_id,
      ),
    );
  };

  const deleteMaterialLayer = (
    _req: Request,
    params: Record<string, string>,
  ) => {
    const layer = getOne<MaterialLayerRow>(
      database,
      "SELECT * FROM material_layers WHERE id = ?",
      params.layerId,
    );

    if (layer?.is_bilateral && layer.opposite_side) {
      database
        .query(
          "DELETE FROM material_layers WHERE template_id = ? AND side = ? AND is_bilateral = 1",
        )
        .run(layer.template_id, layer.opposite_side);
    }

    database
      .query("DELETE FROM material_layers WHERE id = ?")
      .run(params.layerId);

    if (layer) {
      database
        .query("UPDATE material_templates SET updated_at = ? WHERE id = ?")
        .run(Date.now(), layer.template_id);
    }

    return json({ success: true });
  };

  const getHistory = (_req: Request, params: Record<string, string>) =>
    json(
      getAll<HistoryRow>(
        database,
        "SELECT * FROM project_history WHERE project_id = ? ORDER BY created_at ASC",
        params.projectId,
      ),
    );

  const addHistory = async (req: Request, params: Record<string, string>) => {
    const body = await parseObjectBody<{
      action_type?: string;
      action_label?: string;
      snapshot?: string;
    }>(req);
    const id = crypto.randomUUID();
    const now = Date.now();

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

    return json(
      getOne<HistoryRow>(
        database,
        "SELECT * FROM project_history WHERE id = ?",
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
      "SELECT * FROM project_history WHERE id = ?",
      params.historyId,
    );
    if (!entry) return json({ error: "History entry not found" }, 404);

    let objects: FurnitureObjectRow[] = [];
    try {
      objects = JSON.parse(entry.snapshot) as FurnitureObjectRow[];
    } catch {
      return json({ error: "Invalid snapshot" }, 400);
    }

    const now = Date.now();

    // Delete all current objects for this project and restore from snapshot.
    // This replaces all objects atomically to match the snapshotted state,
    // which is simpler and more reliable than a granular diff/patch approach.
    database
      .query("DELETE FROM furniture_objects WHERE project_id = ?")
      .run(params.projectId);

    // Restore objects from snapshot
    for (const obj of objects) {
      database
        .query(
          `INSERT INTO furniture_objects (
            id, project_id, name, width, height, depth,
            position_x, position_y, position_z, rotation_y,
            color, material_template_id, component_id, is_independent,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
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

    // Delete history entries after the target entry
    database
      .query(
        "DELETE FROM project_history WHERE project_id = ? AND created_at > ?",
      )
      .run(params.projectId, entry.created_at);

    return json({
      success: true,
      objects: getAll<FurnitureObjectRow>(
        database,
        "SELECT * FROM furniture_objects WHERE project_id = ? ORDER BY created_at ASC",
        params.projectId,
      ),
    });
  };

  addRoute("GET", "/api/projects", () => getProjects());
  addRoute("POST", "/api/projects", (req) => createProject(req));
  addRoute("PUT", "/api/projects/:id", (req, params) =>
    updateProject(req, params),
  );
  addRoute("DELETE", "/api/projects/:id", (req, params) =>
    deleteProject(req, params),
  );

  addRoute("GET", "/api/projects/:projectId/objects", (req, params) =>
    getObjects(req, params),
  );
  addRoute("POST", "/api/projects/:projectId/objects", (req, params) =>
    createObject(req, params),
  );
  addRoute("PUT", "/api/projects/:projectId/objects/batch", (req) =>
    updateObjectsBatch(req),
  );
  addRoute("PUT", "/api/projects/:projectId/objects/:id", (req, params) =>
    updateObject(req, params),
  );
  addRoute("DELETE", "/api/projects/:projectId/objects/:id", (req, params) =>
    deleteObject(req, params),
  );
  addRoute(
    "POST",
    "/api/projects/:projectId/objects/:id/duplicate",
    (req, params) => duplicateObject(req, params),
  );

  addRoute("GET", "/api/projects/:projectId/components", (req, params) =>
    getComponents(req, params),
  );
  addRoute("POST", "/api/projects/:projectId/components", (req, params) =>
    createComponent(req, params),
  );
  addRoute("DELETE", "/api/projects/:projectId/components/:id", (req, params) =>
    deleteComponent(req, params),
  );
  addRoute(
    "POST",
    "/api/projects/:projectId/components/:id/sync",
    (req, params) => syncComponent(req, params),
  );

  addRoute("GET", "/api/projects/:projectId/history", (req, params) =>
    getHistory(req, params),
  );
  addRoute("POST", "/api/projects/:projectId/history", (req, params) =>
    addHistory(req, params),
  );
  addRoute(
    "POST",
    "/api/projects/:projectId/history/:historyId/revert",
    (req, params) => revertHistory(req, params),
  );

  addRoute("GET", "/api/material-templates", () => getMaterialTemplates());
  addRoute("POST", "/api/material-templates", (req) =>
    createMaterialTemplate(req),
  );
  addRoute("PUT", "/api/material-templates/:id", (req, params) =>
    updateMaterialTemplate(req, params),
  );
  addRoute("DELETE", "/api/material-templates/:id", (req, params) =>
    deleteMaterialTemplate(req, params),
  );
  addRoute(
    "POST",
    "/api/material-templates/:templateId/layers",
    (req, params) => createMaterialLayer(req, params),
  );
  addRoute(
    "PUT",
    "/api/material-templates/:templateId/layers/:layerId",
    (req, params) => updateMaterialLayer(req, params),
  );
  addRoute(
    "DELETE",
    "/api/material-templates/:templateId/layers/:layerId",
    (req, params) => deleteMaterialLayer(req, params),
  );

  return async function fetch(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    if (pathname.startsWith("/api/")) {
      for (const route of routes) {
        if (route.method !== req.method) {
          continue;
        }

        const match = pathname.match(route.pattern);
        if (!match) {
          continue;
        }

        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          const value = match[index + 1];
          if (value !== undefined) {
            params[name] = value;
          }
        });

        try {
          return cors(await route.handler(req, params));
        } catch (error) {
          console.error("Route error:", error);
          return cors(json({ error: "Internal server error" }, 500));
        }
      }

      return cors(json({ error: "Not found" }, 404));
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const resolvedStaticPath = resolve(DIST_PATH, relativePath);
    const isInsideDist =
      resolvedStaticPath === DIST_PATH ||
      resolvedStaticPath.startsWith(`${DIST_PATH}${sep}`);

    if (isInsideDist) {
      const staticFile = Bun.file(resolvedStaticPath);
      if (await staticFile.exists()) {
        return cors(new Response(staticFile));
      }
    }

    const indexFile = Bun.file(join(DIST_PATH, "index.html"));
    if (await indexFile.exists()) {
      return cors(
        new Response(indexFile, {
          headers: { "Content-Type": "text/html" },
        }),
      );
    }

    return cors(json({ error: "Not found" }, 404));
  };
}

export function startServer(database: Database, port = 3001) {
  return Bun.serve({
    port,
    fetch: createFetchHandler(database),
  });
}
