import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../../db/database";
import type {
  FurnitureObjectRow,
  ObjectRelationRow,
  ProjectRow,
} from "../../../types";
import { createObjectHandlers } from "../../objects/objects";
import { createRelationHandlers } from "../relations";

let tempDir: string;
let database: ReturnType<typeof createDatabase>;
let projectId: string;

function cleanupTempDir() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function createObject(
  name: string,
  width = 18,
  height = 720,
  depth = 560,
  posX = 0,
) {
  const handlers = createObjectHandlers(database);
  const req = new Request("http://app.local/objects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, width, height, depth, position_x: posX }),
  });
  return (await (
    await handlers.createObject(req, { projectId })
  ).json()) as FurnitureObjectRow;
}

beforeEach(async () => {
  cleanupTempDir();
  tempDir = mkdtempSync(join(tmpdir(), "meblox-relations-test-"));
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

describe("relations controller", () => {
  test("lists relations (empty initially)", async () => {
    const handlers = createRelationHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/relations`,
    );
    const response = await handlers.getRelations(req, { projectId });
    expect(response.status).toBe(200);
    const relations = (await response.json()) as ObjectRelationRow[];
    expect(relations).toHaveLength(0);
  });

  test("creates a dimension relation between two objects", async () => {
    const source = await createObject("Źródło", 18);
    const target = await createObject("Cel", 18);
    const handlers = createRelationHandlers(database);

    const req = new Request(
      `http://app.local/api/projects/${projectId}/relations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_object_id: source.id,
          target_object_id: target.id,
          relation_type: "dimension",
          source_field: "width",
          target_field: "width",
          mode: "direct",
        }),
      },
    );
    const response = await handlers.createRelation(req, { projectId });
    expect(response.status).toBe(201);
    const relation = (await response.json()) as ObjectRelationRow;
    expect(relation.relation_type).toBe("dimension");
    expect(relation.source_field).toBe("width");
  });

  test("rejects invalid relation (same source and target)", async () => {
    const obj = await createObject("Obiekt");
    const handlers = createRelationHandlers(database);

    const req = new Request(
      `http://app.local/api/projects/${projectId}/relations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_object_id: obj.id,
          target_object_id: obj.id,
          relation_type: "dimension",
          source_field: "width",
          target_field: "width",
          mode: "direct",
        }),
      },
    );
    const response = await handlers.createRelation(req, { projectId });
    expect(response.status).toBe(400);
  });

  test("creates an attachment relation", async () => {
    const source = await createObject("Bok", 18, 720, 560, 0);
    const target = await createObject("Półka", 560, 18, 560, 0);
    const handlers = createRelationHandlers(database);

    const req = new Request(
      `http://app.local/api/projects/${projectId}/relations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_object_id: source.id,
          target_object_id: target.id,
          relation_type: "attachment",
          source_field: "position_x",
          target_field: "position_x",
          mode: "anchor",
          source_anchor: "end",
          target_anchor: "start",
          offset_mm: 0,
        }),
      },
    );
    const response = await handlers.createRelation(req, { projectId });
    expect(response.status).toBe(201);
    const relation = (await response.json()) as ObjectRelationRow;
    expect(relation.relation_type).toBe("attachment");
    expect(relation.mode).toBe("anchor");
  });

  test("deletes a relation", async () => {
    const source = await createObject("A");
    const target = await createObject("B");
    const handlers = createRelationHandlers(database);

    const createReq = new Request(
      `http://app.local/api/projects/${projectId}/relations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_object_id: source.id,
          target_object_id: target.id,
          relation_type: "dimension",
          source_field: "height",
          target_field: "height",
          mode: "direct",
        }),
      },
    );
    const relation = (await (
      await handlers.createRelation(createReq, { projectId })
    ).json()) as ObjectRelationRow;

    const deleteReq = new Request(
      `http://app.local/api/projects/${projectId}/relations/${relation.id}`,
      { method: "DELETE" },
    );
    const response = await handlers.deleteRelation(deleteReq, {
      projectId,
      id: relation.id,
    });
    expect(response.status).toBe(200);

    const listReq = new Request(
      `http://app.local/api/projects/${projectId}/relations`,
    );
    const listResponse = await handlers.getRelations(listReq, { projectId });
    const relations = (await listResponse.json()) as ObjectRelationRow[];
    expect(relations).toHaveLength(0);
  });
});
