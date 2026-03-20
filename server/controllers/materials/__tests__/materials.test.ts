import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../../db/database";
import type {
  MaterialLayerRow,
  MaterialTemplateWithLayers,
} from "../../../types";
import { createMaterialHandlers } from "../materials";

let tempDir: string;
let database: ReturnType<typeof createDatabase>;

function cleanupTempDir() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function createTemplate(name = "Materiał testowy") {
  const handlers = createMaterialHandlers(database);
  const req = new Request("http://app.local/api/material-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, base_color: "#C4A882" }),
  });
  return (await (
    await handlers.createMaterialTemplate(req)
  ).json()) as MaterialTemplateWithLayers;
}

beforeEach(() => {
  cleanupTempDir();
  tempDir = mkdtempSync(join(tmpdir(), "meblox-materials-test-"));
  database = createDatabase(join(tempDir, "test.sqlite"));
});

afterEach(() => {
  database.close(false);
  cleanupTempDir();
});

describe("materials controller", () => {
  test("lists material templates (empty initially)", async () => {
    const handlers = createMaterialHandlers(database);
    const response = await handlers.getMaterialTemplates();
    expect(response.status).toBe(200);
    const templates = (await response.json()) as MaterialTemplateWithLayers[];
    expect(templates).toHaveLength(0);
  });

  test("creates a material template", async () => {
    const handlers = createMaterialHandlers(database);
    const req = new Request("http://app.local/api/material-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dąb",
        description: "Okleina dębowa",
        base_color: "#C4A882",
      }),
    });
    const response = await handlers.createMaterialTemplate(req);
    expect(response.status).toBe(201);
    const template = (await response.json()) as MaterialTemplateWithLayers;
    expect(template.name).toBe("Dąb");
    expect(template.layers).toHaveLength(0);
  });

  test("updates a material template", async () => {
    const template = await createTemplate("Stary materiał");
    const handlers = createMaterialHandlers(database);

    const req = new Request(
      `http://app.local/api/material-templates/${template.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nowy materiał" }),
      },
    );
    const response = await handlers.updateMaterialTemplate(req, {
      id: template.id,
    });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as MaterialTemplateWithLayers;
    expect(updated?.name).toBe("Nowy materiał");
  });

  test("deletes a material template", async () => {
    const template = await createTemplate();
    const handlers = createMaterialHandlers(database);

    const deleteReq = new Request(
      `http://app.local/api/material-templates/${template.id}`,
      { method: "DELETE" },
    );
    const response = await handlers.deleteMaterialTemplate(deleteReq, {
      id: template.id,
    });
    expect(response.status).toBe(200);

    const listResponse = await handlers.getMaterialTemplates();
    const templates =
      (await listResponse.json()) as MaterialTemplateWithLayers[];
    expect(templates).toHaveLength(0);
  });

  test("creates a material layer for a template", async () => {
    const template = await createTemplate();
    const handlers = createMaterialHandlers(database);

    const req = new Request(
      `http://app.local/api/material-templates/${template.id}/layers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: "top",
          layer_type: "veneer",
          color: "#C4A882",
          thickness: 0.5,
          is_bilateral: false,
        }),
      },
    );
    const response = await handlers.createMaterialLayer(req, {
      templateId: template.id,
    });
    expect(response.status).toBe(201);
    const layers = (await response.json()) as MaterialLayerRow[];
    expect(layers).toHaveLength(1);
    expect(layers[0]?.side).toBe("top");
    expect(layers[0]?.layer_type).toBe("veneer");
  });

  test("creates bilateral layers on opposite faces", async () => {
    const template = await createTemplate();
    const handlers = createMaterialHandlers(database);

    const req = new Request(
      `http://app.local/api/material-templates/${template.id}/layers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: "left",
          layer_type: "edge_banding",
          color: "#DDD",
          thickness: 0.5,
          is_bilateral: true,
        }),
      },
    );
    const response = await handlers.createMaterialLayer(req, {
      templateId: template.id,
    });
    const layers = (await response.json()) as MaterialLayerRow[];
    expect(layers).toHaveLength(2);
    const sides = layers.map((l) => l.side).sort();
    expect(sides).toEqual(["left", "right"]);
  });

  test("deletes a material layer", async () => {
    const template = await createTemplate();
    const handlers = createMaterialHandlers(database);

    const createLayerReq = new Request(
      `http://app.local/api/material-templates/${template.id}/layers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: "front",
          layer_type: "paint",
          color: "#FFF",
          thickness: 0.1,
          is_bilateral: false,
        }),
      },
    );
    const layers = (await (
      await handlers.createMaterialLayer(createLayerReq, {
        templateId: template.id,
      })
    ).json()) as MaterialLayerRow[];
    const layerId = layers[0]?.id;

    const deleteReq = new Request(
      `http://app.local/api/material-templates/${template.id}/layers/${layerId}`,
      { method: "DELETE" },
    );
    const response = await handlers.deleteMaterialLayer(deleteReq, {
      templateId: template.id,
      layerId,
    });
    expect(response.status).toBe(200);
  });

  test("updates a material layer and syncs bilateral", async () => {
    const template = await createTemplate();
    const handlers = createMaterialHandlers(database);

    const createLayerReq = new Request(
      `http://app.local/api/material-templates/${template.id}/layers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: "top",
          layer_type: "veneer",
          color: "#AAA",
          thickness: 0.5,
          is_bilateral: true,
        }),
      },
    );
    const layers = (await (
      await handlers.createMaterialLayer(createLayerReq, {
        templateId: template.id,
      })
    ).json()) as MaterialLayerRow[];
    const topLayer = layers.find((l) => l.side === "top")!;

    const updateReq = new Request(
      `http://app.local/api/material-templates/${template.id}/layers/${topLayer.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: "#BBB", thickness: 1.0 }),
      },
    );
    const response = await handlers.updateMaterialLayer(updateReq, {
      templateId: template.id,
      layerId: topLayer.id,
    });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as MaterialLayerRow[];
    expect(updated.every((l) => l.color === "#BBB")).toBe(true);
    expect(updated.every((l) => l.thickness === 1.0)).toBe(true);
  });
});
