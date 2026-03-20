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
  posZ = 0,
) {
  const handlers = createObjectHandlers(database);
  const req = new Request("http://app.local/objects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      width,
      height,
      depth,
      position_x: posX,
      position_z: posZ,
    }),
  });
  return (await (
    await handlers.createObject(req, { projectId })
  ).json()) as FurnitureObjectRow;
}

async function createRelation(
  body: Record<string, unknown>,
): Promise<ObjectRelationRow> {
  const handlers = createRelationHandlers(database);
  const req = new Request(
    `http://app.local/api/projects/${projectId}/relations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return (await (
    await handlers.createRelation(req, { projectId })
  ).json()) as ObjectRelationRow;
}

async function updateObject(
  id: string,
  data: Record<string, unknown>,
): Promise<FurnitureObjectRow> {
  const handlers = createObjectHandlers(database);
  const req = new Request(`http://app.local/objects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return (await (
    await handlers.updateObject(req, { projectId, id })
  ).json()) as FurnitureObjectRow;
}

async function getObject(id: string): Promise<FurnitureObjectRow | undefined> {
  const handlers = createObjectHandlers(database);
  const req = new Request(`http://app.local/api/projects/${projectId}/objects`);
  const objects = (await (
    await handlers.getObjects(req, { projectId })
  ).json()) as FurnitureObjectRow[];
  return objects.find((o) => o.id === id);
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

  test("creating a dimension relation propagates source value to target", async () => {
    // Source has width=600, target has width=18 (different) — after relation
    // is created, syncRelations must update target.width to match source.width.
    const source = await createObject("Źródło", 600);
    const target = await createObject("Cel", 18);
    const handlers = createRelationHandlers(database);
    const objectHandlers = createObjectHandlers(database);

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

    // Verify target.width has been synced to match source.width
    const getReq = new Request(
      `http://app.local/api/projects/${projectId}/objects`,
    );
    const objects = (await (
      await objectHandlers.getObjects(getReq, { projectId })
    ).json()) as FurnitureObjectRow[];

    const updatedTarget = objects.find((o) => o.id === target.id);
    expect(updatedTarget?.width).toBe(600);
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

    const relation = await createRelation({
      source_object_id: source.id,
      target_object_id: target.id,
      relation_type: "dimension",
      source_field: "height",
      target_field: "height",
      mode: "direct",
    });

    const handlers = createRelationHandlers(database);
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

  // -----------------------------------------------------------------------
  // Overlap prevention: when a dimension changes the cache must be updated
  // before attachment positions are recomputed, otherwise objects collide.
  // -----------------------------------------------------------------------

  test("attachment position is recomputed with updated depth after dimension change", async () => {
    // A at z=0, depth=18.  B glued to the front face of A (no gap).
    // After A.depth changes to 20 both objects must still touch — not overlap.
    //
    // Expected (with fix):
    //   A spans [-10, 10] along Z
    //   B.depth = 20  (dimension relation)
    //   B.position_z = 10 + 10 = 20  (attachment: A.end → B.start, offset=0)
    //   B spans [10, 30] — touching A with zero overlap.
    //
    // Without the cache-update fix syncRelations computed B.position_z using
    // stale B.depth=18, giving position_z=19 → B spans [9, 29], overlapping A.
    const A = await createObject("Bok", 18, 720, 18, 0, 0);
    const B = await createObject("Plecy", 560, 720, 18, 0, 18);

    // Dimension: A.depth → B.depth (direct)
    await createRelation({
      source_object_id: A.id,
      target_object_id: B.id,
      relation_type: "dimension",
      source_field: "depth",
      target_field: "depth",
      mode: "direct",
    });

    // Attachment: A.position_z(end) → B.position_z(start), zero offset
    await createRelation({
      source_object_id: A.id,
      target_object_id: B.id,
      relation_type: "attachment",
      source_field: "position_z",
      target_field: "position_z",
      mode: "anchor",
      source_anchor: "end",
      target_anchor: "start",
      offset_mm: 0,
    });

    // Change A's depth from 18 → 20
    await updateObject(A.id, { depth: 20 });

    const updatedB = await getObject(B.id);
    expect(updatedB?.depth).toBe(20);
    // B.position_z must equal A.end + B.depth/2 = 10 + 10 = 20
    expect(updatedB?.position_z).toBe(20);

    // Verify no overlap: B's near edge (position_z - depth/2) must equal A's far edge (A.depth/2)
    const bNearEdge = (updatedB?.position_z ?? 0) - (updatedB?.depth ?? 0) / 2;
    const aFarEdge = 20 / 2; // A.position_z=0, A.depth=20
    expect(bNearEdge).toBe(aFarEdge);
  });

  test("attachment is correct when attachment relation was created before dimension relation", async () => {
    // Same setup but attachment relation is created FIRST (before dimension).
    // The ordering fix ensures dimension is applied before attachment regardless
    // of relation creation order.
    const A = await createObject("Bok", 18, 720, 18, 0, 0);
    const B = await createObject("Plecy", 560, 720, 18, 0, 18);

    // Attachment created FIRST
    await createRelation({
      source_object_id: A.id,
      target_object_id: B.id,
      relation_type: "attachment",
      source_field: "position_z",
      target_field: "position_z",
      mode: "anchor",
      source_anchor: "end",
      target_anchor: "start",
      offset_mm: 0,
    });

    // Dimension created SECOND
    await createRelation({
      source_object_id: A.id,
      target_object_id: B.id,
      relation_type: "dimension",
      source_field: "depth",
      target_field: "depth",
      mode: "direct",
    });

    await updateObject(A.id, { depth: 20 });

    const updatedB = await getObject(B.id);
    expect(updatedB?.depth).toBe(20);
    expect(updatedB?.position_z).toBe(20);

    const bNearEdge = (updatedB?.position_z ?? 0) - (updatedB?.depth ?? 0) / 2;
    expect(bNearEdge).toBe(10); // equals A's far edge
  });

  test("chain of three objects stays collision-free after depth change", async () => {
    // A — B — C glued in a chain along Z, all with same depth (dimension relation from A).
    // A at z=0, depth=18. B touches front of A. C touches front of B.
    const A = await createObject("A", 18, 720, 18, 0, 0);
    const B = await createObject("B", 18, 720, 18, 0, 18);
    const C = await createObject("C", 18, 720, 18, 0, 36);

    // Dimension: A → B, A → C (direct)
    await createRelation({
      source_object_id: A.id,
      target_object_id: B.id,
      relation_type: "dimension",
      source_field: "depth",
      target_field: "depth",
      mode: "direct",
    });
    await createRelation({
      source_object_id: A.id,
      target_object_id: C.id,
      relation_type: "dimension",
      source_field: "depth",
      target_field: "depth",
      mode: "direct",
    });

    // Attachment chain: A(end)→B(start), B(end)→C(start)
    await createRelation({
      source_object_id: A.id,
      target_object_id: B.id,
      relation_type: "attachment",
      source_field: "position_z",
      target_field: "position_z",
      mode: "anchor",
      source_anchor: "end",
      target_anchor: "start",
      offset_mm: 0,
    });
    await createRelation({
      source_object_id: B.id,
      target_object_id: C.id,
      relation_type: "attachment",
      source_field: "position_z",
      target_field: "position_z",
      mode: "anchor",
      source_anchor: "end",
      target_anchor: "start",
      offset_mm: 0,
    });

    // Change A's depth: 18 → 20
    await updateObject(A.id, { depth: 20 });

    const bAfter = await getObject(B.id);
    const cAfter = await getObject(C.id);

    // B and C must have the new depth
    expect(bAfter?.depth).toBe(20);
    expect(cAfter?.depth).toBe(20);

    // A: spans [-10, 10]. B must start at 10 → position_z = 20
    expect(bAfter?.position_z).toBe(20);

    // B: spans [10, 30]. C must start at 30 → position_z = 40
    expect(cAfter?.position_z).toBe(40);

    // No overlap between any consecutive pair
    const aFarEdge = 20 / 2;
    const bNearEdge = (bAfter?.position_z ?? 0) - (bAfter?.depth ?? 0) / 2;
    expect(bNearEdge).toBe(aFarEdge);

    const bFarEdge = (bAfter?.position_z ?? 0) + (bAfter?.depth ?? 0) / 2;
    const cNearEdge = (cAfter?.position_z ?? 0) - (cAfter?.depth ?? 0) / 2;
    expect(cNearEdge).toBe(bFarEdge);
  });
});
