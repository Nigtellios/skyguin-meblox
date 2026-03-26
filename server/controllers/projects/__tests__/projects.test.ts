import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../../db/database";
import type {
  ComponentGroupRow,
  FurnitureObjectRow,
  ObjectRelationRow,
  ProjectRow,
} from "../../../types";
import { createProjectHandlers } from "../projects";

let tempDir: string;
let database: ReturnType<typeof createDatabase>;

function cleanupTempDir() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

beforeEach(() => {
  cleanupTempDir();
  tempDir = mkdtempSync(join(tmpdir(), "meblox-projects-test-"));
  database = createDatabase(join(tempDir, "test.sqlite"));
});

afterEach(() => {
  database.close(false);
  cleanupTempDir();
});

describe("projects controller", () => {
  test("lists the seeded default project", async () => {
    const handlers = createProjectHandlers(database);
    const response = await handlers.getProjects();
    expect(response.status).toBe(200);
    const projects = (await response.json()) as ProjectRow[];
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe("Projekt 1");
  });

  test("creates a new project with provided name", async () => {
    const handlers = createProjectHandlers(database);
    const req = new Request("http://app.local/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Testowy projekt", description: "Opis" }),
    });
    const response = await handlers.createProject(req);
    expect(response.status).toBe(201);
    const project = (await response.json()) as ProjectRow;
    expect(project.name).toBe("Testowy projekt");
    expect(project.description).toBe("Opis");
    expect(project.id).toBeString();
  });

  test("creates a project with default name when name is not provided", async () => {
    const handlers = createProjectHandlers(database);
    const req = new Request("http://app.local/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await handlers.createProject(req);
    expect(response.status).toBe(201);
    const project = (await response.json()) as ProjectRow;
    expect(project.name).toBe("Nowy projekt");
  });

  test("updates a project name and description", async () => {
    const handlers = createProjectHandlers(database);
    const listResponse = await handlers.getProjects();
    const projects = (await listResponse.json()) as ProjectRow[];
    const projectId = projects[0]?.id;

    const req = new Request(`http://app.local/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Zmieniona nazwa" }),
    });
    const response = await handlers.updateProject(req, { id: projectId });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as ProjectRow;
    expect(updated.name).toBe("Zmieniona nazwa");
  });

  test("deletes a project", async () => {
    const handlers = createProjectHandlers(database);
    const listResponse = await handlers.getProjects();
    const projects = (await listResponse.json()) as ProjectRow[];
    const projectId = projects[0]?.id;

    const deleteReq = new Request(
      `http://app.local/api/projects/${projectId}`,
      { method: "DELETE" },
    );
    const deleteResponse = await handlers.deleteProject(deleteReq, {
      id: projectId,
    });
    expect(deleteResponse.status).toBe(200);

    const afterDelete = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    expect(afterDelete).toHaveLength(0);
  });

  test("creates project with grid settings", async () => {
    const handlers = createProjectHandlers(database);
    const req = new Request("http://app.local/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Z siatką",
        grid_size_mm: 50,
        grid_visible: 1,
      }),
    });
    const response = await handlers.createProject(req);
    const project = (await response.json()) as ProjectRow;
    expect(project.grid_size_mm).toBe(50);
    expect(project.grid_visible).toBe(1);
  });

  // ---- duplicateProject ----

  test("duplicateProject returns 404 for unknown project", async () => {
    const handlers = createProjectHandlers(database);
    const req = new Request(
      "http://app.local/api/projects/nonexistent/duplicate",
      { method: "POST" },
    );
    const response = await handlers.duplicateProject(req, {
      id: "nonexistent",
    });
    expect(response.status).toBe(404);
  });

  test("duplicateProject copies project metadata with '(kopia)' suffix", async () => {
    const handlers = createProjectHandlers(database);

    // Give the source project a thumbnail so we can verify it is copied
    const sourceList = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    const sourceId = sourceList[0]?.id as string;
    const thumbnailReq = new Request(
      `http://app.local/api/projects/${sourceId}/thumbnail`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: "data:image/jpeg;base64,abc123" }),
      },
    );
    await handlers.saveThumbnail(thumbnailReq, { id: sourceId });

    const dupReq = new Request(
      `http://app.local/api/projects/${sourceId}/duplicate`,
      { method: "POST" },
    );
    const response = await handlers.duplicateProject(dupReq, { id: sourceId });
    expect(response.status).toBe(201);

    const copy = (await response.json()) as ProjectRow;
    expect(copy.id).not.toBe(sourceId);
    expect(copy.name).toBe("Projekt 1 (kopia)");
    expect(copy.thumbnail).toBe("data:image/jpeg;base64,abc123");

    // Both projects should now exist
    const allProjects = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    expect(allProjects).toHaveLength(2);
  });

  test("duplicateProject copies component groups with remapped IDs", async () => {
    const handlers = createProjectHandlers(database);
    const sourceList = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    const sourceId = sourceList[0]?.id as string;
    const now = Date.now();

    // Insert a component group into the source project
    const compId = crypto.randomUUID();
    database
      .query(
        "INSERT INTO component_groups (id, project_id, name, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(compId, sourceId, "Grupa testowa", now);

    const dupReq = new Request(
      `http://app.local/api/projects/${sourceId}/duplicate`,
      { method: "POST" },
    );
    const response = await handlers.duplicateProject(dupReq, { id: sourceId });
    const copy = (await response.json()) as ProjectRow;

    const copiedGroups = database
      .query("SELECT * FROM component_groups WHERE project_id = ?")
      .all(copy.id) as ComponentGroupRow[];

    expect(copiedGroups).toHaveLength(1);
    expect(copiedGroups[0]?.name).toBe("Grupa testowa");
    // The copied group must have a different ID
    expect(copiedGroups[0]?.id).not.toBe(compId);
    expect(copiedGroups[0]?.project_id).toBe(copy.id);
  });

  test("duplicateProject copies furniture objects with remapped IDs", async () => {
    const handlers = createProjectHandlers(database);
    const sourceList = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    const sourceId = sourceList[0]?.id as string;
    const now = Date.now();

    // Insert two objects into the source project
    const objId1 = crypto.randomUUID();
    const objId2 = crypto.randomUUID();
    for (const [oid, name] of [
      [objId1, "Bok lewy"],
      [objId2, "Bok prawy"],
    ] as [string, string][]) {
      database
        .query(
          `INSERT INTO furniture_objects
            (id, project_id, name, width, height, depth, position_x, position_y, position_z,
             rotation_y, color, material_template_id, component_id, is_independent, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          oid,
          sourceId,
          name,
          600,
          720,
          18,
          0,
          0,
          0,
          0,
          "#8B7355",
          null,
          null,
          0,
          now,
          now,
        );
    }

    const dupReq = new Request(
      `http://app.local/api/projects/${sourceId}/duplicate`,
      { method: "POST" },
    );
    const response = await handlers.duplicateProject(dupReq, { id: sourceId });
    const copy = (await response.json()) as ProjectRow;

    const copiedObjects = database
      .query("SELECT * FROM furniture_objects WHERE project_id = ?")
      .all(copy.id) as FurnitureObjectRow[];

    expect(copiedObjects).toHaveLength(2);
    const names = copiedObjects.map((o) => o.name).sort();
    expect(names).toEqual(["Bok lewy", "Bok prawy"]);
    // All IDs must be new
    expect(copiedObjects.map((o) => o.id)).not.toContain(objId1);
    expect(copiedObjects.map((o) => o.id)).not.toContain(objId2);
    // project_id must point to the copy
    for (const obj of copiedObjects) {
      expect(obj.project_id).toBe(copy.id);
    }
  });

  test("duplicateProject copies object relations with remapped IDs", async () => {
    const handlers = createProjectHandlers(database);
    const sourceList = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    const sourceId = sourceList[0]?.id as string;
    const now = Date.now();

    const objId1 = crypto.randomUUID();
    const objId2 = crypto.randomUUID();
    for (const [oid, name] of [
      [objId1, "Src"],
      [objId2, "Tgt"],
    ] as [string, string][]) {
      database
        .query(
          `INSERT INTO furniture_objects
            (id, project_id, name, width, height, depth, position_x, position_y, position_z,
             rotation_y, color, material_template_id, component_id, is_independent, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          oid,
          sourceId,
          name,
          600,
          720,
          18,
          0,
          0,
          0,
          0,
          "#8B7355",
          null,
          null,
          0,
          now,
          now,
        );
    }

    const relId = crypto.randomUUID();
    database
      .query(
        `INSERT INTO object_relations
          (id, project_id, source_object_id, target_object_id, relation_type,
           source_field, target_field, mode, source_anchor, target_anchor, offset_mm, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        relId,
        sourceId,
        objId1,
        objId2,
        "dimension",
        "width",
        "width",
        "direct",
        null,
        null,
        0,
        now,
      );

    const dupReq = new Request(
      `http://app.local/api/projects/${sourceId}/duplicate`,
      { method: "POST" },
    );
    const response = await handlers.duplicateProject(dupReq, { id: sourceId });
    const copy = (await response.json()) as ProjectRow;

    const copiedRelations = database
      .query("SELECT * FROM object_relations WHERE project_id = ?")
      .all(copy.id) as ObjectRelationRow[];

    expect(copiedRelations).toHaveLength(1);
    const rel = copiedRelations[0] as ObjectRelationRow;
    // relation ID must be new
    expect(rel.id).not.toBe(relId);
    expect(rel.project_id).toBe(copy.id);
    // source/target must point to copied objects (not originals)
    expect(rel.source_object_id).not.toBe(objId1);
    expect(rel.target_object_id).not.toBe(objId2);
    // The referenced objects must actually exist in the copied project
    const srcObj = database
      .query("SELECT id FROM furniture_objects WHERE id = ?")
      .get(rel.source_object_id);
    const tgtObj = database
      .query("SELECT id FROM furniture_objects WHERE id = ?")
      .get(rel.target_object_id);
    expect(srcObj).not.toBeNull();
    expect(tgtObj).not.toBeNull();
    // Relation metadata must be preserved
    expect(rel.relation_type).toBe("dimension");
    expect(rel.source_field).toBe("width");
    expect(rel.mode).toBe("direct");
  });

  // ---- saveThumbnail ----

  test("saveThumbnail returns 400 when thumbnail field is missing", async () => {
    const handlers = createProjectHandlers(database);
    const sourceList = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    const projectId = sourceList[0]?.id as string;

    const req = new Request(
      `http://app.local/api/projects/${projectId}/thumbnail`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const response = await handlers.saveThumbnail(req, { id: projectId });
    expect(response.status).toBe(400);
  });

  test("saveThumbnail persists thumbnail data", async () => {
    const handlers = createProjectHandlers(database);
    const sourceList = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    const projectId = sourceList[0]?.id as string;

    const dataUrl = "data:image/jpeg;base64,/9j/test==";
    const req = new Request(
      `http://app.local/api/projects/${projectId}/thumbnail`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: dataUrl }),
      },
    );
    const response = await handlers.saveThumbnail(req, { id: projectId });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean };
    expect(result.success).toBe(true);

    // Verify the thumbnail is persisted in the DB
    const row = database
      .query("SELECT thumbnail FROM projects WHERE id = ?")
      .get(projectId) as { thumbnail: string };
    expect(row.thumbnail).toBe(dataUrl);
  });

  test("saveThumbnail updates updated_at so project floats to top of list", async () => {
    const handlers = createProjectHandlers(database);

    // Backdate the seeded project's updated_at so it is clearly older
    const pastTs = Date.now() - 10_000;
    database.query("UPDATE projects SET updated_at = ?").run(pastTs);

    // Create a second project (newer by default)
    const createReq = new Request("http://app.local/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Projekt 2" }),
    });
    await handlers.createProject(createReq);

    const listBefore = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    // "Projekt 2" should be first (newer updated_at)
    expect(listBefore[0]?.name).toBe("Projekt 2");
    const firstProjectId = listBefore[1]?.id as string;

    // Save thumbnail on the older project — this bumps its updated_at
    const req = new Request(
      `http://app.local/api/projects/${firstProjectId}/thumbnail`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: "data:image/jpeg;base64,abc" }),
      },
    );
    await handlers.saveThumbnail(req, { id: firstProjectId });

    const listAfter = (await (
      await handlers.getProjects()
    ).json()) as ProjectRow[];
    // After thumbnail save, the updated project should be first
    expect(listAfter[0]?.id).toBe(firstProjectId);
  });
});
