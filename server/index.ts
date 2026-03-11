import { db, initializeDatabase } from "./db/database";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

initializeDatabase();

type RouteHandler = (req: Request, params: Record<string, string>) => Response | Promise<Response>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cors(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

async function parseBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ---- Projects ----
function getProjects(): Response {
  const projects = db.query("SELECT * FROM projects ORDER BY created_at DESC").all();
  return json(projects);
}

async function createProject(req: Request): Promise<Response> {
  const body = await parseBody(req) as any;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.query(
    `INSERT INTO projects (id, name, description, grid_size_mm, grid_visible, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, body.name || "Nowy projekt", body.description || "", body.grid_size_mm ?? 100, body.grid_visible ?? 1, now, now);
  const project = db.query("SELECT * FROM projects WHERE id = ?").get(id);
  return json(project, 201);
}

async function updateProject(req: Request, params: Record<string, string>): Promise<Response> {
  const body = await parseBody(req) as any;
  const now = Date.now();
  db.query(
    `UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description),
     grid_size_mm = COALESCE(?, grid_size_mm), grid_visible = COALESCE(?, grid_visible), updated_at = ?
     WHERE id = ?`
  ).run(body.name, body.description, body.grid_size_mm, body.grid_visible, now, params.id);
  const project = db.query("SELECT * FROM projects WHERE id = ?").get(params.id);
  return json(project);
}

function deleteProject(params: Record<string, string>): Response {
  db.query("DELETE FROM projects WHERE id = ?").run(params.id);
  return json({ success: true });
}

// ---- Furniture Objects ----
function getObjects(params: Record<string, string>): Response {
  const objects = db.query("SELECT * FROM furniture_objects WHERE project_id = ? ORDER BY created_at ASC").all(params.projectId);
  return json(objects);
}

async function createObject(req: Request, params: Record<string, string>): Promise<Response> {
  const body = await parseBody(req) as any;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.query(
    `INSERT INTO furniture_objects (id, project_id, name, width, height, depth, position_x, position_y, position_z, rotation_y, color, material_template_id, component_id, is_independent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    now
  );
  const obj = db.query("SELECT * FROM furniture_objects WHERE id = ?").get(id);
  return json(obj, 201);
}

async function updateObject(req: Request, params: Record<string, string>): Promise<Response> {
  const body = await parseBody(req) as any;
  const now = Date.now();
  const stmt = db.query(
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
     WHERE id = ?`
  );
  // Resolve material_template_id: use provided value or keep existing
  const existingObj = db.query("SELECT material_template_id FROM furniture_objects WHERE id = ?").get(params.id) as any;
  const materialTemplateId = body.material_template_id !== undefined
    ? body.material_template_id
    : existingObj?.material_template_id ?? null;

  stmt.run(
    body.name, body.width, body.height, body.depth,
    body.position_x, body.position_y, body.position_z, body.rotation_y,
    body.color,
    materialTemplateId,
    body.component_id, body.is_independent, now, params.id
  );
  const obj = db.query("SELECT * FROM furniture_objects WHERE id = ?").get(params.id);
  return json(obj);
}

async function updateObjectsBatch(req: Request): Promise<Response> {
  const body = await parseBody(req) as any;
  const now = Date.now();
  const updates = Array.isArray(body) ? body : [];
  for (const item of updates) {
    db.query(
      `UPDATE furniture_objects SET
        name = COALESCE(?, name), width = COALESCE(?, width), height = COALESCE(?, height),
        depth = COALESCE(?, depth), color = COALESCE(?, color), updated_at = ?
       WHERE id = ?`
    ).run(item.name, item.width, item.height, item.depth, item.color, now, item.id);
  }
  return json({ success: true, updated: updates.length });
}

function deleteObject(params: Record<string, string>): Response {
  db.query("DELETE FROM furniture_objects WHERE id = ?").run(params.id);
  return json({ success: true });
}

async function duplicateObject(req: Request, params: Record<string, string>): Promise<Response> {
  const source = db.query("SELECT * FROM furniture_objects WHERE id = ?").get(params.id) as any;
  if (!source) return json({ error: "Not found" }, 404);
  const body = await parseBody(req) as any;
  const newId = crypto.randomUUID();
  const now = Date.now();
  db.query(
    `INSERT INTO furniture_objects (id, project_id, name, width, height, depth, position_x, position_y, position_z, rotation_y, color, material_template_id, component_id, is_independent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId, source.project_id, source.name + " (kopia)",
    source.width, source.height, source.depth,
    (source.position_x ?? 0) + (body.offset_x ?? 50),
    source.position_y ?? 0,
    (source.position_z ?? 0) + (body.offset_z ?? 50),
    source.rotation_y ?? 0,
    source.color, source.material_template_id,
    null, 0, now, now
  );
  const obj = db.query("SELECT * FROM furniture_objects WHERE id = ?").get(newId);
  return json(obj, 201);
}

// ---- Component Groups ----
function getComponents(params: Record<string, string>): Response {
  const groups = db.query("SELECT * FROM component_groups WHERE project_id = ?").all(params.projectId);
  return json(groups);
}

async function createComponent(req: Request, params: Record<string, string>): Promise<Response> {
  const body = await parseBody(req) as any;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.query("INSERT INTO component_groups (id, project_id, name, created_at) VALUES (?, ?, ?, ?)").run(
    id, params.projectId, body.name || "Nowy komponent", now
  );

  // Assign objects to this component
  if (Array.isArray(body.object_ids) && body.object_ids.length > 0) {
    for (const objId of body.object_ids) {
      db.query("UPDATE furniture_objects SET component_id = ?, is_independent = 0, updated_at = ? WHERE id = ?")
        .run(id, now, objId);
    }
    // Copy params from first object to all others
    const first = db.query("SELECT * FROM furniture_objects WHERE id = ?").get(body.object_ids[0]) as any;
    if (first) {
      for (const objId of body.object_ids.slice(1)) {
        db.query("UPDATE furniture_objects SET width = ?, height = ?, depth = ?, color = ?, material_template_id = ?, updated_at = ? WHERE id = ? AND is_independent = 0")
          .run(first.width, first.height, first.depth, first.color, first.material_template_id, now, objId);
      }
    }
  }

  const group = db.query("SELECT * FROM component_groups WHERE id = ?").get(id);
  return json(group, 201);
}

function deleteComponent(params: Record<string, string>): Response {
  // Remove component association from objects
  db.query("UPDATE furniture_objects SET component_id = NULL, is_independent = 0 WHERE component_id = ?").run(params.id);
  db.query("DELETE FROM component_groups WHERE id = ?").run(params.id);
  return json({ success: true });
}

async function syncComponent(req: Request, params: Record<string, string>): Promise<Response> {
  const body = await parseBody(req) as any;
  const now = Date.now();
  // Update all non-independent objects in this component with the given params
  if (body.width !== undefined) db.query("UPDATE furniture_objects SET width = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0").run(body.width, now, params.id);
  if (body.height !== undefined) db.query("UPDATE furniture_objects SET height = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0").run(body.height, now, params.id);
  if (body.depth !== undefined) db.query("UPDATE furniture_objects SET depth = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0").run(body.depth, now, params.id);
  if (body.color !== undefined) db.query("UPDATE furniture_objects SET color = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0").run(body.color, now, params.id);
  if (body.material_template_id !== undefined) db.query("UPDATE furniture_objects SET material_template_id = ?, updated_at = ? WHERE component_id = ? AND is_independent = 0").run(body.material_template_id, now, params.id);
  const objects = db.query("SELECT * FROM furniture_objects WHERE component_id = ?").all(params.id);
  return json(objects);
}

// ---- Material Templates ----
function getMaterialTemplates(): Response {
  const templates = db.query("SELECT * FROM material_templates ORDER BY created_at DESC").all();
  const layers = db.query("SELECT * FROM material_layers ORDER BY template_id, side, sort_order").all();
  const templateMap = new Map<string, any>();
  for (const t of templates as any[]) {
    templateMap.set(t.id, { ...t, layers: [] });
  }
  for (const l of layers as any[]) {
    if (templateMap.has(l.template_id)) {
      templateMap.get(l.template_id).layers.push(l);
    }
  }
  return json(Array.from(templateMap.values()));
}

async function createMaterialTemplate(req: Request): Promise<Response> {
  const body = await parseBody(req) as any;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.query(
    "INSERT INTO material_templates (id, name, description, base_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, body.name || "Nowy materiał", body.description || "", body.base_color || "#8B7355", now, now);
  const template = db.query("SELECT * FROM material_templates WHERE id = ?").get(id);
  return json({ ...template, layers: [] }, 201);
}

async function updateMaterialTemplate(req: Request, params: Record<string, string>): Promise<Response> {
  const body = await parseBody(req) as any;
  const now = Date.now();
  db.query(
    "UPDATE material_templates SET name = COALESCE(?, name), description = COALESCE(?, description), base_color = COALESCE(?, base_color), updated_at = ? WHERE id = ?"
  ).run(body.name, body.description, body.base_color, now, params.id);
  const template = db.query("SELECT * FROM material_templates WHERE id = ?").get(params.id);
  const layers = db.query("SELECT * FROM material_layers WHERE template_id = ? ORDER BY side, sort_order").all(params.id);
  return json({ ...template, layers });
}

function deleteMaterialTemplate(params: Record<string, string>): Response {
  db.query("DELETE FROM material_templates WHERE id = ?").run(params.id);
  return json({ success: true });
}

// ---- Material Layers ----
async function createMaterialLayer(req: Request, params: Record<string, string>): Promise<Response> {
  const body = await parseBody(req) as any;
  const id = crypto.randomUUID();
  const now = Date.now();
  const oppositeSides: Record<string, string> = {
    top: "bottom", bottom: "top", left: "right", right: "left", front: "back", back: "front"
  };
  const side = body.side || "top";
  const isBilateral = body.is_bilateral ? 1 : 0;
  const oppSide = oppositeSides[side] || null;

  db.query(
    "INSERT INTO material_layers (id, template_id, side, layer_type, color, thickness, is_bilateral, opposite_side, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, params.templateId, side, body.layer_type || "veneer", body.color || "#D4A574", body.thickness ?? 0.5, isBilateral, isBilateral ? oppSide : null, body.sort_order ?? 0, now);

  if (isBilateral && oppSide) {
    const oppId = crypto.randomUUID();
    db.query(
      "INSERT INTO material_layers (id, template_id, side, layer_type, color, thickness, is_bilateral, opposite_side, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(oppId, params.templateId, oppSide, body.layer_type || "veneer", body.color || "#D4A574", body.thickness ?? 0.5, 1, side, body.sort_order ?? 0, now);
  }

  // Update template updated_at
  db.query("UPDATE material_templates SET updated_at = ? WHERE id = ?").run(now, params.templateId);

  const layers = db.query("SELECT * FROM material_layers WHERE template_id = ? ORDER BY side, sort_order").all(params.templateId);
  return json(layers, 201);
}

async function updateMaterialLayer(req: Request, params: Record<string, string>): Promise<Response> {
  const body = await parseBody(req) as any;
  const now = Date.now();
  db.query(
    "UPDATE material_layers SET layer_type = COALESCE(?, layer_type), color = COALESCE(?, color), thickness = COALESCE(?, thickness) WHERE id = ?"
  ).run(body.layer_type, body.color, body.thickness, params.layerId);

  // If bilateral, update opposite too
  const layer = db.query("SELECT * FROM material_layers WHERE id = ?").get(params.layerId) as any;
  if (layer && layer.is_bilateral && layer.opposite_side) {
    const oppLayer = db.query("SELECT id FROM material_layers WHERE template_id = ? AND side = ? AND is_bilateral = 1").get(layer.template_id, layer.opposite_side) as any;
    if (oppLayer) {
      db.query("UPDATE material_layers SET layer_type = COALESCE(?, layer_type), color = COALESCE(?, color), thickness = COALESCE(?, thickness) WHERE id = ?")
        .run(body.layer_type, body.color, body.thickness, oppLayer.id);
    }
  }

  db.query("UPDATE material_templates SET updated_at = ? WHERE id = ?").run(now, layer?.template_id);
  const layers = db.query("SELECT * FROM material_layers WHERE template_id = ? ORDER BY side, sort_order").all(layer?.template_id);
  return json(layers);
}

function deleteMaterialLayer(params: Record<string, string>): Response {
  const layer = db.query("SELECT * FROM material_layers WHERE id = ?").get(params.layerId) as any;
  if (layer && layer.is_bilateral && layer.opposite_side) {
    db.query("DELETE FROM material_layers WHERE template_id = ? AND side = ? AND is_bilateral = 1").run(layer.template_id, layer.opposite_side);
  }
  db.query("DELETE FROM material_layers WHERE id = ?").run(params.layerId);
  const now = Date.now();
  if (layer) db.query("UPDATE material_templates SET updated_at = ? WHERE id = ?").run(now, layer.template_id);
  return json({ success: true });
}

// ---- Router ----
type Route = { method: string; pattern: RegExp; paramNames: string[]; handler: RouteHandler };
const routes: Route[] = [];

function addRoute(method: string, path: string, handler: RouteHandler) {
  const paramNames: string[] = [];
  const pattern = new RegExp(
    "^" + path.replace(/:([^/]+)/g, (_, name) => { paramNames.push(name); return "([^/]+)"; }) + "$"
  );
  routes.push({ method, pattern, paramNames, handler });
}

// Register routes
addRoute("GET", "/api/projects", () => getProjects());
addRoute("POST", "/api/projects", (req) => createProject(req));
addRoute("PUT", "/api/projects/:id", (req, p) => updateProject(req, p));
addRoute("DELETE", "/api/projects/:id", (_, p) => deleteProject(p));

addRoute("GET", "/api/projects/:projectId/objects", (_, p) => getObjects(p));
addRoute("POST", "/api/projects/:projectId/objects", (req, p) => createObject(req, p));
addRoute("PUT", "/api/projects/:projectId/objects/batch", (req, _) => updateObjectsBatch(req));
addRoute("PUT", "/api/projects/:projectId/objects/:id", (req, p) => updateObject(req, p));
addRoute("DELETE", "/api/projects/:projectId/objects/:id", (_, p) => deleteObject(p));
addRoute("POST", "/api/projects/:projectId/objects/:id/duplicate", (req, p) => duplicateObject(req, p));

addRoute("GET", "/api/projects/:projectId/components", (_, p) => getComponents(p));
addRoute("POST", "/api/projects/:projectId/components", (req, p) => createComponent(req, p));
addRoute("DELETE", "/api/projects/:projectId/components/:id", (_, p) => deleteComponent(p));
addRoute("POST", "/api/projects/:projectId/components/:id/sync", (req, p) => syncComponent(req, p));

addRoute("GET", "/api/material-templates", () => getMaterialTemplates());
addRoute("POST", "/api/material-templates", (req) => createMaterialTemplate(req));
addRoute("PUT", "/api/material-templates/:id", (req, p) => updateMaterialTemplate(req, p));
addRoute("DELETE", "/api/material-templates/:id", (_, p) => deleteMaterialTemplate(p));
addRoute("POST", "/api/material-templates/:templateId/layers", (req, p) => createMaterialLayer(req, p));
addRoute("PUT", "/api/material-templates/:templateId/layers/:layerId", (req, p) => updateMaterialLayer(req, p));
addRoute("DELETE", "/api/material-templates/:templateId/layers/:layerId", (_, p) => deleteMaterialLayer(p));

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    // Handle API routes
    if (pathname.startsWith("/api/")) {
      for (const route of routes) {
        if (route.method !== req.method) continue;
        const match = pathname.match(route.pattern);
        if (match) {
          const params: Record<string, string> = {};
          route.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
          try {
            const res = await route.handler(req, params);
            return cors(res);
          } catch (err) {
            console.error("Route error:", err);
            return cors(json({ error: "Internal server error" }, 500));
          }
        }
      }
      return cors(json({ error: "Not found" }, 404));
    }

    // Serve static files from client/dist in production
    // In development, the Vite dev server handles static files
    const distPath = new URL("../client/dist", import.meta.url).pathname;
    try {
      const filePath = pathname === "/" ? "/index.html" : pathname;
      const file = Bun.file(distPath + filePath);
      if (await file.exists()) {
        return cors(new Response(file));
      }
      // SPA fallback
      const indexFile = Bun.file(distPath + "/index.html");
      if (await indexFile.exists()) {
        return cors(new Response(indexFile, { headers: { "Content-Type": "text/html" } }));
      }
    } catch {}

    return cors(json({ error: "Not found" }, 404));
  },
});

console.log(`🪵 Skyguin Meblox server running on http://localhost:${server.port}`);
