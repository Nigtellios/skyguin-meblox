import { describe, expect, test } from "bun:test";
import { api } from "../useApi";

describe("useApi composable", () => {
  test("api object has all required project methods", () => {
    expect(typeof api.projects.list).toBe("function");
    expect(typeof api.projects.create).toBe("function");
    expect(typeof api.projects.update).toBe("function");
    expect(typeof api.projects.delete).toBe("function");
  });

  test("api object has all required object methods", () => {
    expect(typeof api.objects.list).toBe("function");
    expect(typeof api.objects.create).toBe("function");
    expect(typeof api.objects.update).toBe("function");
    expect(typeof api.objects.updateBatch).toBe("function");
    expect(typeof api.objects.delete).toBe("function");
    expect(typeof api.objects.duplicate).toBe("function");
  });

  test("api object has all required component methods", () => {
    expect(typeof api.components.list).toBe("function");
    expect(typeof api.components.create).toBe("function");
    expect(typeof api.components.delete).toBe("function");
    expect(typeof api.components.sync).toBe("function");
  });

  test("api object has all required relation methods", () => {
    expect(typeof api.relations.list).toBe("function");
    expect(typeof api.relations.create).toBe("function");
    expect(typeof api.relations.delete).toBe("function");
  });

  test("api object has all required material methods", () => {
    expect(typeof api.materials.list).toBe("function");
    expect(typeof api.materials.create).toBe("function");
    expect(typeof api.materials.update).toBe("function");
    expect(typeof api.materials.delete).toBe("function");
    expect(typeof api.materials.layers.create).toBe("function");
    expect(typeof api.materials.layers.update).toBe("function");
    expect(typeof api.materials.layers.delete).toBe("function");
  });

  test("api object has all required history methods", () => {
    expect(typeof api.history.list).toBe("function");
    expect(typeof api.history.add).toBe("function");
    expect(typeof api.history.revert).toBe("function");
    expect(typeof api.history.navigate).toBe("function");
  });

  test("api methods are callable and return Promise", () => {
    const projectsListResult = api.projects.list();
    expect(projectsListResult).toBeInstanceOf(Promise);
    // Reject the promise to avoid unhandled rejection (fetch will fail without a server)
    projectsListResult.catch(() => {});
  });

  test("api namespace structure is valid", () => {
    const namespaces = [
      "projects",
      "objects",
      "components",
      "relations",
      "materials",
      "history",
    ] as const;
    for (const ns of namespaces) {
      expect(typeof api[ns]).toBe("object");
    }
  });
});
