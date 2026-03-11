import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFetchHandler } from "../server/app";
import { createDatabase } from "../server/db/database";
import type {
  FurnitureObjectRow,
  MaterialLayerRow,
  ProjectRow,
} from "../server/types";

let tempDir: string;
let database: ReturnType<typeof createDatabase>;
let appFetch: ReturnType<typeof createFetchHandler>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanupTempDir() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function request(path: string, init?: RequestInit) {
  return appFetch(new Request(`http://app.local${path}`, init));
}

beforeEach(() => {
  cleanupTempDir();
  tempDir = mkdtempSync(join(tmpdir(), "meblox-test-"));
  database = createDatabase(join(tempDir, "test.sqlite"));
  appFetch = createFetchHandler(database);
});

afterEach(() => {
  database.close(false);
  cleanupTempDir();
});

describe("server api", () => {
  test("seeds a default project", async () => {
    const response = await request("/api/projects");
    expect(response.status).toBe(200);

    const projects = (await response.json()) as ProjectRow[];
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe("Projekt 1");
  });

  test("creates and duplicates furniture objects", async () => {
    const projects = (await (
      await request("/api/projects")
    ).json()) as ProjectRow[];
    const projectId = projects[0]?.id;
    expect(projectId).toBeString();
    expect(projectId).toMatch(UUID_PATTERN);

    const createdResponse = await request(
      `/api/projects/${projectId}/objects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Panel testowy",
          width: 18,
          height: 720,
          depth: 600,
          color: "#123456",
        }),
      },
    );

    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as FurnitureObjectRow;
    expect(created.name).toBe("Panel testowy");

    const duplicateResponse = await request(
      `/api/projects/${projectId}/objects/${created.id}/duplicate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offset_x: 120, offset_z: 80 }),
      },
    );

    expect(duplicateResponse.status).toBe(201);
    const duplicate = (await duplicateResponse.json()) as FurnitureObjectRow;
    expect(duplicate.name).toContain("(kopia)");
    expect(duplicate.position_x).toBe(120);
    expect(duplicate.position_z).toBe(80);
  });

  test("syncs component members and supports independent edits", async () => {
    const projects = (await (
      await request("/api/projects")
    ).json()) as ProjectRow[];
    const projectId = projects[0]?.id;
    expect(projectId).toBeString();
    expect(projectId).toMatch(UUID_PATTERN);

    const first = (await (
      await request(`/api/projects/${projectId}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "A",
          width: 18,
          height: 720,
          depth: 600,
          color: "#111111",
        }),
      })
    ).json()) as FurnitureObjectRow;

    const second = (await (
      await request(`/api/projects/${projectId}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "B",
          width: 32,
          height: 500,
          depth: 320,
          color: "#222222",
        }),
      })
    ).json()) as FurnitureObjectRow;

    const componentResponse = await request(
      `/api/projects/${projectId}/components`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Korpus",
          object_ids: [first.id, second.id],
        }),
      },
    );
    expect(componentResponse.status).toBe(201);

    const component = (await componentResponse.json()) as { id: string };

    const syncedObjects = (await (
      await request(
        `/api/projects/${projectId}/components/${component.id}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ width: 42, color: "#abcdef" }),
        },
      )
    ).json()) as FurnitureObjectRow[];

    expect(syncedObjects.every((object) => object.width === 42)).toBe(true);
    expect(syncedObjects.every((object) => object.color === "#abcdef")).toBe(
      true,
    );

    await request(`/api/projects/${projectId}/objects/${second.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_independent: 1 }),
    });

    const afterIndependentSync = (await (
      await request(
        `/api/projects/${projectId}/components/${component.id}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ depth: 700 }),
        },
      )
    ).json()) as FurnitureObjectRow[];

    const independentObject = afterIndependentSync.find(
      (object) => object.id === second.id,
    );
    const sharedObject = afterIndependentSync.find(
      (object) => object.id === first.id,
    );
    expect(sharedObject?.depth).toBe(700);
    expect(independentObject?.depth).not.toBe(700);
  });

  test("creates bilateral material layers on opposite faces", async () => {
    const templateResponse = await request("/api/material-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Korpus fornirowany",
        base_color: "#C4A882",
      }),
    });
    const template = (await templateResponse.json()) as { id: string };

    const layersResponse = await request(
      `/api/material-templates/${template.id}/layers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: "front",
          layer_type: "edge_banding",
          color: "#D4A574",
          thickness: 0.5,
          is_bilateral: true,
        }),
      },
    );

    expect(layersResponse.status).toBe(201);
    const layers = (await layersResponse.json()) as MaterialLayerRow[];
    expect(layers).toHaveLength(2);
    expect(layers.map((layer) => layer.side).sort()).toEqual(["back", "front"]);
  });
});
