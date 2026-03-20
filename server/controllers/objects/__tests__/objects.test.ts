import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../../db/database";
import type { FurnitureObjectRow, ProjectRow } from "../../../types";
import { createObjectHandlers } from "../objects";

let tempDir: string;
let database: ReturnType<typeof createDatabase>;
let projectId: string;

function cleanupTempDir() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function getProjectId() {
  const projects = database
    .query("SELECT * FROM projects")
    .all() as ProjectRow[];
  return projects[0]?.id;
}

beforeEach(async () => {
  cleanupTempDir();
  tempDir = mkdtempSync(join(tmpdir(), "meblox-objects-test-"));
  database = createDatabase(join(tempDir, "test.sqlite"));
  projectId = await getProjectId();
});

afterEach(() => {
  database.close(false);
  cleanupTempDir();
});

describe("objects controller", () => {
  test("lists objects for a project (empty by default)", async () => {
    const handlers = createObjectHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
    );
    const response = await handlers.getObjects(req, { projectId });
    expect(response.status).toBe(200);
    const objects = (await response.json()) as FurnitureObjectRow[];
    expect(objects).toHaveLength(0);
  });

  test("creates a furniture object with default values", async () => {
    const handlers = createObjectHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bok" }),
      },
    );
    const response = await handlers.createObject(req, { projectId });
    expect(response.status).toBe(201);
    const obj = (await response.json()) as FurnitureObjectRow;
    expect(obj.name).toBe("Bok");
    expect(obj.width).toBe(600);
    expect(obj.height).toBe(720);
    expect(obj.project_id).toBe(projectId);
  });

  test("creates a furniture object with custom dimensions", async () => {
    const handlers = createObjectHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Półka",
          width: 800,
          height: 18,
          depth: 400,
        }),
      },
    );
    const response = await handlers.createObject(req, { projectId });
    const obj = (await response.json()) as FurnitureObjectRow;
    expect(obj.width).toBe(800);
    expect(obj.height).toBe(18);
    expect(obj.depth).toBe(400);
  });

  test("updates a furniture object", async () => {
    const handlers = createObjectHandlers(database);
    const createReq = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Element" }),
      },
    );
    const created = (await (
      await handlers.createObject(createReq, { projectId })
    ).json()) as FurnitureObjectRow;

    const updateReq = new Request(
      `http://app.local/api/projects/${projectId}/objects/${created.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Zmieniony element", width: 900 }),
      },
    );
    const response = await handlers.updateObject(updateReq, {
      projectId,
      id: created.id,
    });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as FurnitureObjectRow;
    expect(updated.name).toBe("Zmieniony element");
    expect(updated.width).toBe(900);
  });

  test("returns 404 when updating non-existent object", async () => {
    const handlers = createObjectHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/objects/non-existent`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      },
    );
    const response = await handlers.updateObject(req, {
      projectId,
      id: "non-existent",
    });
    expect(response.status).toBe(404);
  });

  test("deletes a furniture object", async () => {
    const handlers = createObjectHandlers(database);
    const createReq = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Do usunięcia" }),
      },
    );
    const created = (await (
      await handlers.createObject(createReq, { projectId })
    ).json()) as FurnitureObjectRow;

    const deleteReq = new Request(
      `http://app.local/api/projects/${projectId}/objects/${created.id}`,
      { method: "DELETE" },
    );
    const response = await handlers.deleteObject(deleteReq, {
      projectId,
      id: created.id,
    });
    expect(response.status).toBe(200);

    const listReq = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
    );
    const listResponse = await handlers.getObjects(listReq, { projectId });
    const objects = (await listResponse.json()) as FurnitureObjectRow[];
    expect(objects).toHaveLength(0);
  });

  test("duplicates an object with default offset", async () => {
    const handlers = createObjectHandlers(database);
    const createReq = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Oryginał", position_x: 0 }),
      },
    );
    const created = (await (
      await handlers.createObject(createReq, { projectId })
    ).json()) as FurnitureObjectRow;

    const dupReq = new Request(
      `http://app.local/api/projects/${projectId}/objects/${created.id}/duplicate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const response = await handlers.duplicateObject(dupReq, {
      projectId,
      id: created.id,
    });
    expect(response.status).toBe(201);
    const duplicate = (await response.json()) as FurnitureObjectRow;
    expect(duplicate.name).toBe("Oryginał (kopia)");
    expect(duplicate.position_x).toBe(created.position_x + 50);
    expect(duplicate.component_id).toBeNull();
  });

  test("batch updates multiple objects", async () => {
    const handlers = createObjectHandlers(database);
    const createReq1 = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "A", width: 100 }),
      },
    );
    const createReq2 = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "B", width: 200 }),
      },
    );
    const objA = (await (
      await handlers.createObject(createReq1, { projectId })
    ).json()) as FurnitureObjectRow;
    const objB = (await (
      await handlers.createObject(createReq2, { projectId })
    ).json()) as FurnitureObjectRow;

    const batchReq = new Request(
      `http://app.local/api/projects/${projectId}/objects/batch`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { id: objA.id, width: 300 },
          { id: objB.id, width: 400 },
        ]),
      },
    );
    const response = await handlers.updateObjectsBatch(batchReq, { projectId });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { updated: number };
    expect(result.updated).toBe(2);
  });
});
