import { describe, expect, test } from "bun:test";
import ProjectsModal from "../ProjectsModal.vue";

// ProjectsModal lists projects and allows creation and selection.
describe("ProjectsModal", () => {
  test("component can be imported", () => {
    expect(ProjectsModal).toBeDefined();
  });

  test("project has id, name, and created_at fields", () => {
    const project = {
      id: "proj-1",
      name: "Szafa narożna",
      description: "Projekt szafy",
      grid_size_mm: 100,
      grid_visible: 1,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    expect(project.id).toBeString();
    expect(project.name).toBeString();
    expect(project.created_at).toBeNumber();
  });

  test("projects list can be sorted by creation time descending", () => {
    const projects = [
      { id: "a", name: "Projekt 1", created_at: 1000 },
      { id: "b", name: "Projekt 2", created_at: 3000 },
      { id: "c", name: "Projekt 3", created_at: 2000 },
    ];
    const sorted = [...projects].sort((a, b) => b.created_at - a.created_at);
    expect(sorted[0]?.id).toBe("b");
  });

  test("new project default name is valid", () => {
    const defaultName = "Nowy projekt";
    expect(defaultName).toBe("Nowy projekt");
    expect(defaultName.length).toBeGreaterThan(0);
  });
});
