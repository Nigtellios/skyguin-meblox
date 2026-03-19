import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../../db/database";
import type { ProjectRow } from "../../../types";
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
});
