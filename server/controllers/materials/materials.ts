import type { Database } from "bun:sqlite";
import type {
  MaterialLayerPayload,
  MaterialLayerRow,
  MaterialTemplatePayload,
  MaterialTemplateRow,
  MaterialTemplateWithLayers,
} from "../../types";
import { getAll, getOne } from "../../utils/db";
import { json, parseObjectBody, toSqlValue } from "../../utils/http";
import { OPPOSITE_SIDES } from "../../utils/relations";

export function createMaterialHandlers(database: Database) {
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

  return {
    getMaterialTemplates,
    createMaterialTemplate,
    updateMaterialTemplate,
    deleteMaterialTemplate,
    createMaterialLayer,
    updateMaterialLayer,
    deleteMaterialLayer,
  };
}

export function registerMaterialRoutes(
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
  const handlers = createMaterialHandlers(database);

  addRoute("GET", "/api/material-templates", () =>
    handlers.getMaterialTemplates(),
  );
  addRoute("POST", "/api/material-templates", (req) =>
    handlers.createMaterialTemplate(req),
  );
  addRoute("PUT", "/api/material-templates/:id", (req, params) =>
    handlers.updateMaterialTemplate(req, params),
  );
  addRoute("DELETE", "/api/material-templates/:id", (req, params) =>
    handlers.deleteMaterialTemplate(req, params),
  );
  addRoute(
    "POST",
    "/api/material-templates/:templateId/layers",
    (req, params) => handlers.createMaterialLayer(req, params),
  );
  addRoute(
    "PUT",
    "/api/material-templates/:templateId/layers/:layerId",
    (req, params) => handlers.updateMaterialLayer(req, params),
  );
  addRoute(
    "DELETE",
    "/api/material-templates/:templateId/layers/:layerId",
    (req, params) => handlers.deleteMaterialLayer(req, params),
  );
}
