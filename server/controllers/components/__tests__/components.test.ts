import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../../db/database";
import type {
  ComponentGroupRow,
  FurnitureObjectRow,
  ProjectRow,
} from "../../../types";
import { createObjectHandlers } from "../../objects/objects";
import { createComponentHandlers } from "../components";

let tempDir: string;
let database: ReturnType<typeof createDatabase>;
let projectId: string;

function cleanupTempDir() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function createObject(name: string, width = 18) {
  const handlers = createObjectHandlers(database);
  const req = new Request("http://app.local/objects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, width }),
  });
  return (await (
    await handlers.createObject(req, { projectId })
  ).json()) as FurnitureObjectRow;
}

beforeEach(async () => {
  cleanupTempDir();
  tempDir = mkdtempSync(join(tmpdir(), "meblox-components-test-"));
  database = createDatabase(join(tempDir, "test.sqlite"));
  const projects = database
    .query("SELECT * FROM projects")
    .all() as ProjectRow[];
  projectId = projects[0]?.id;
});

afterEach(() => {
  database.close(false);
  cleanupTempDir();
});

describe("components controller", () => {
  test("lists components (empty initially)", async () => {
    const handlers = createComponentHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/components`,
    );
    const response = await handlers.getComponents(req, { projectId });
    expect(response.status).toBe(200);
    const components = (await response.json()) as ComponentGroupRow[];
    expect(components).toHaveLength(0);
  });

  test("creates a component group from objects", async () => {
    const obj1 = await createObject("Bok lewy");
    const obj2 = await createObject("Bok prawy");
    const handlers = createComponentHandlers(database);

    const req = new Request(
      `http://app.local/api/projects/${projectId}/components`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bok korpusu",
          object_ids: [obj1.id, obj2.id],
        }),
      },
    );
    const response = await handlers.createComponent(req, { projectId });
    expect(response.status).toBe(201);
    const component = (await response.json()) as ComponentGroupRow;
    expect(component.name).toBe("Bok korpusu");
    expect(component.id).toBeString();
  });

  test("syncs component properties to all members", async () => {
    const obj1 = await createObject("Bok A", 18);
    const obj2 = await createObject("Bok B", 18);
    const handlers = createComponentHandlers(database);

    const createReq = new Request(
      `http://app.local/api/projects/${projectId}/components`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Boki",
          object_ids: [obj1.id, obj2.id],
        }),
      },
    );
    const component = (await (
      await handlers.createComponent(createReq, { projectId })
    ).json()) as ComponentGroupRow;

    const syncReq = new Request(
      `http://app.local/api/projects/${projectId}/components/${component.id}/sync`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: 25, height: 800 }),
      },
    );
    const response = await handlers.syncComponent(syncReq, {
      projectId,
      id: component.id,
    });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as FurnitureObjectRow[];
    expect(updated.every((o) => o.width === 25)).toBe(true);
    expect(updated.every((o) => o.height === 800)).toBe(true);
  });

  test("deletes a component group and unlinks members", async () => {
    const obj = await createObject("Bok");
    const handlers = createComponentHandlers(database);

    const createReq = new Request(
      `http://app.local/api/projects/${projectId}/components`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Komponent", object_ids: [obj.id] }),
      },
    );
    const component = (await (
      await handlers.createComponent(createReq, { projectId })
    ).json()) as ComponentGroupRow;

    const deleteReq = new Request(
      `http://app.local/api/projects/${projectId}/components/${component.id}`,
      { method: "DELETE" },
    );
    const response = await handlers.deleteComponent(deleteReq, {
      projectId,
      id: component.id,
    });
    expect(response.status).toBe(200);

    const row = database
      .query("SELECT component_id FROM furniture_objects WHERE id = ?")
      .get(obj.id) as { component_id: string | null };
    expect(row.component_id).toBeNull();
  });
});
