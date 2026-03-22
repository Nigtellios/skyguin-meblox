import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  spyOn,
  test,
} from "bun:test";
import { createPinia, setActivePinia } from "pinia";
import type { FurnitureObject, HistoryEntry, Project } from "../../../types";
import { api } from "../../useApi/useApi";
import { useAppStore } from "../useAppStore";

// ---- Stub factories ----

function makeObject(id: string): FurnitureObject {
  return {
    id,
    project_id: "p1",
    name: `Object ${id}`,
    width: 100,
    height: 100,
    depth: 100,
    position_x: 0,
    position_y: 0,
    position_z: 0,
    rotation_y: 0,
    color: "#8B7355",
    material_template_id: null,
    component_id: null,
    is_independent: 0,
    created_at: 1000,
    updated_at: 1000,
  };
}

function makeHistoryEntry(id: string, index: number): HistoryEntry {
  return {
    id,
    project_id: "p1",
    action_type: "test",
    action_label: `Action ${index}`,
    created_at: index,
  };
}

function makeProject(id: string, updatedAt: number): Project {
  return {
    id,
    name: `Project ${id}`,
    description: "",
    grid_size_mm: 100,
    grid_visible: 1,
    thumbnail: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

// ---- Helpers ----

/**
 * Set up a fresh Pinia instance, mock the minimum API surface needed to make
 * `selectProject` succeed, and optionally pre-seed historyEntries via a mocked
 * `api.history.list` response.
 */
async function setupStore(options?: {
  historyEntries?: HistoryEntry[];
  objects?: FurnitureObject[];
}) {
  const historyEntries = options?.historyEntries ?? [];
  const objects = options?.objects ?? [];

  spyOn(api.objects, "list").mockResolvedValue(objects);
  spyOn(api.components, "list").mockResolvedValue([]);
  spyOn(api.relations, "list").mockResolvedValue([]);
  spyOn(api.history, "list").mockResolvedValue(historyEntries);

  const store = useAppStore();
  await store.selectProject("p1");
  return store;
}

// ---- Shape tests ----

describe("useAppStore composable", () => {
  test("useAppStore is exported as a function", () => {
    expect(typeof useAppStore).toBe("function");
  });

  test("useAppStore.$id is 'app'", () => {
    expect(useAppStore.$id).toBe("app");
  });
});

// ---- History debounce tests ----

describe("useAppStore – move history debounce", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("rapid updateObjectPosition calls produce a single history entry after the debounce window", async () => {
    const obj = makeObject("obj-1");
    const store = await setupStore({ objects: [obj] });

    // Mock position update; return the same object with updated coordinates.
    spyOn(api.objects, "update").mockImplementation(
      async (_projectId, _id, pos) => ({ ...obj, ...pos }) as FurnitureObject,
    );

    const historyAddSpy = spyOn(api.history, "add").mockResolvedValue(
      makeHistoryEntry("h-new", 999),
    );

    // Simulate 5 rapid moves without advancing time.
    for (let i = 0; i < 5; i++) {
      await store.updateObjectPosition("obj-1", { position_x: i * 10 });
    }

    // No history entry should have been written yet.
    expect(historyAddSpy).not.toHaveBeenCalled();

    // Advance past the 800 ms debounce window.
    jest.advanceTimersByTime(800);
    // Allow the resulting async recordHistory call to settle.
    await Promise.resolve();
    await Promise.resolve();

    // Exactly one entry should have been recorded, regardless of move count.
    expect(historyAddSpy).toHaveBeenCalledTimes(1);
    const [, payload] = historyAddSpy.mock.calls[0] as [
      string,
      { action_type: string; action_label: string },
    ];
    expect(payload.action_type).toBe("move_object");
  });
});

// ---- undoHistory / redoHistory tests ----

describe("useAppStore – undoHistory / redoHistory", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("undoHistory decrements historyCurrentIndex and restores objects", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];
    const restoredObjects = [makeObject("obj-restored")];

    const store = await setupStore({ historyEntries: entries });
    expect(store.state.historyCurrentIndex).toBe(2);

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: restoredObjects,
    });

    await store.undoHistory();

    expect(navigateSpy).toHaveBeenCalledWith("p1", "h1");
    expect(store.state.historyCurrentIndex).toBe(1);
    expect(store.state.objects).toEqual(restoredObjects);
    expect(store.state.selectedObjectIds).toEqual([]);
    expect(store.state.contextMode).toBe("none");
  });

  test("redoHistory increments historyCurrentIndex and restores objects", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];
    const restoredObjects = [makeObject("obj-redo")];

    const store = await setupStore({ historyEntries: entries });

    // Simulate being at index 1 (after one undo).
    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: restoredObjects,
    });
    await store.undoHistory(); // moves to index 1
    navigateSpy.mockClear();

    await store.redoHistory();

    expect(navigateSpy).toHaveBeenCalledWith("p1", "h2");
    expect(store.state.historyCurrentIndex).toBe(2);
    expect(store.state.objects).toEqual(restoredObjects);
  });

  test("undoHistory does not go below 0", async () => {
    const entries = [makeHistoryEntry("h0", 0)];

    const store = await setupStore({ historyEntries: entries });
    // historyCurrentIndex is 0 (the only entry).

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.undoHistory(); // targetIndex = -1, should be a no-op.

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(store.state.historyCurrentIndex).toBe(0);
  });

  test("redoHistory does not go beyond the last entry", async () => {
    const entries = [makeHistoryEntry("h0", 0)];
    const store = await setupStore({ historyEntries: entries });
    // Already at the end.

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.redoHistory(); // no-op

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(store.state.historyCurrentIndex).toBe(0);
  });

  test("undoHistory keeps historyCurrentIndex unchanged on API error", async () => {
    const entries = [makeHistoryEntry("h0", 0), makeHistoryEntry("h1", 1)];
    const store = await setupStore({ historyEntries: entries });
    expect(store.state.historyCurrentIndex).toBe(1);

    spyOn(api.history, "navigate").mockRejectedValue(new Error("network"));

    await store.undoHistory();

    // Index must not have changed.
    expect(store.state.historyCurrentIndex).toBe(1);
  });
});

// ---- recordHistory branching (trim_after_id) tests ----

describe("useAppStore – recordHistory after undo sends trim_after_id", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("recordHistory passes trim_after_id when historyCurrentIndex is behind the tail", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];

    const store = await setupStore({ historyEntries: entries });
    expect(store.state.historyCurrentIndex).toBe(2);

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.undoHistory(); // index → 1
    await store.undoHistory(); // index → 0
    expect(store.state.historyCurrentIndex).toBe(0);
    navigateSpy.mockRestore();

    const newEntry = makeHistoryEntry("h-new", 999);
    const historyAddSpy = spyOn(api.history, "add").mockResolvedValue(newEntry);

    await store.recordHistory("create_object", "Added object");

    expect(historyAddSpy).toHaveBeenCalledTimes(1);
    const [, payload] = historyAddSpy.mock.calls[0] as [
      string,
      { trim_after_id?: string },
    ];
    // Should trim after h0 (the entry at historyCurrentIndex=0).
    expect(payload.trim_after_id).toBe("h0");
  });

  test("recordHistory truncates local historyEntries when trim_after_id is set", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];

    const store = await setupStore({ historyEntries: entries });

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.undoHistory(); // index → 1
    navigateSpy.mockRestore();

    const newEntry = makeHistoryEntry("h-new", 999);
    spyOn(api.history, "add").mockResolvedValue(newEntry);

    await store.recordHistory("create_object", "Added object");

    // h2 should have been removed; list is now [h0, h1, h-new].
    expect(store.state.historyEntries).toHaveLength(3);
    expect(store.state.historyEntries[2].id).toBe("h-new");
    expect(store.state.historyCurrentIndex).toBe(2);
  });

  test("recordHistory does NOT send trim_after_id when at the tail", async () => {
    const entries = [makeHistoryEntry("h0", 0), makeHistoryEntry("h1", 1)];

    const store = await setupStore({ historyEntries: entries });
    expect(store.state.historyCurrentIndex).toBe(1); // already at tail

    const historyAddSpy = spyOn(api.history, "add").mockResolvedValue(
      makeHistoryEntry("h-new", 999),
    );

    await store.recordHistory("create_object", "Added object");

    const [, payload] = historyAddSpy.mock.calls[0] as [
      string,
      { trim_after_id?: string },
    ];
    expect(payload.trim_after_id).toBeUndefined();
  });
});

// ---- Project dashboard actions ----

describe("useAppStore – project dashboard actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function setupProjectStore(projects: Project[]) {
    spyOn(api.projects, "list").mockResolvedValue(projects);
    const store = useAppStore();
    await store.loadProjects();
    return store;
  }

  test("loadProjects populates state.projects and sets showProjectsDashboard to true", async () => {
    const projects = [makeProject("p1", 3000), makeProject("p2", 1000)];
    const store = await setupProjectStore(projects);

    expect(store.state.projects).toEqual(projects);
    expect(store.state.showProjectsDashboard).toBe(true);
  });

  test("setShowProjectsDashboard toggles the dashboard flag", () => {
    const store = useAppStore();

    expect(store.state.showProjectsDashboard).toBe(false);

    store.setShowProjectsDashboard(true);
    expect(store.state.showProjectsDashboard).toBe(true);

    store.setShowProjectsDashboard(false);
    expect(store.state.showProjectsDashboard).toBe(false);
  });

  test("renameProject calls api.projects.update and moves the renamed project to the front", async () => {
    const p1 = makeProject("p1", 1000);
    const p2 = makeProject("p2", 2000);
    // p2 is newer — so it should be at front before the rename
    const store = await setupProjectStore([p2, p1]);
    expect(store.state.projects[0]?.id).toBe("p2");

    const renamed = { ...p1, name: "Renamed Project", updated_at: 9999 };
    const updateSpy = spyOn(api.projects, "update").mockResolvedValue(renamed);

    await store.renameProject("p1", "Renamed Project");

    expect(updateSpy).toHaveBeenCalledWith("p1", { name: "Renamed Project" });
    // p1 (now renamed and bumped) should be at the front
    expect(store.state.projects[0]?.id).toBe("p1");
    expect(store.state.projects[0]?.name).toBe("Renamed Project");
    expect(store.state.projects).toHaveLength(2);
  });

  test("renameProject does not mutate list when project id is not found", async () => {
    const p1 = makeProject("p1", 1000);
    const store = await setupProjectStore([p1]);

    spyOn(api.projects, "update").mockResolvedValue(
      makeProject("unknown", 9999),
    );

    // renameProject with unknown id: the update fires but findIndex returns -1
    await store.renameProject("unknown", "Ghost");

    // List stays unchanged
    expect(store.state.projects).toHaveLength(1);
    expect(store.state.projects[0]?.id).toBe("p1");
  });

  test("saveThumbnail calls api.projects.update with thumbnail and moves project to front", async () => {
    const p1 = makeProject("p1", 1000);
    const p2 = makeProject("p2", 2000);
    const store = await setupProjectStore([p2, p1]);

    const withThumb = {
      ...p1,
      thumbnail: "data:image/jpeg;base64,abc",
      updated_at: 9999,
    };
    const updateSpy = spyOn(api.projects, "update").mockResolvedValue(withThumb);

    await store.saveThumbnail("p1", "data:image/jpeg;base64,abc");

    expect(updateSpy).toHaveBeenCalledWith("p1", {
      thumbnail: "data:image/jpeg;base64,abc",
    });
    expect(store.state.projects[0]?.id).toBe("p1");
    expect(store.state.projects[0]?.thumbnail).toBe("data:image/jpeg;base64,abc");
    expect(store.state.projects).toHaveLength(2);
  });

  test("duplicateProject calls api.projects.duplicate and prepends the copy", async () => {
    const p1 = makeProject("p1", 1000);
    const store = await setupProjectStore([p1]);
    expect(store.state.projects).toHaveLength(1);

    const copy = { ...makeProject("p1-copy", 2000), name: "Project p1 (kopia)" };
    const duplicateSpy = spyOn(api.projects, "duplicate").mockResolvedValue(copy);

    const result = await store.duplicateProject("p1");

    expect(duplicateSpy).toHaveBeenCalledWith("p1");
    expect(result.id).toBe("p1-copy");
    // The copy should be at the very front
    expect(store.state.projects[0]?.id).toBe("p1-copy");
    expect(store.state.projects[0]?.name).toBe("Project p1 (kopia)");
    expect(store.state.projects).toHaveLength(2);
  });
});


// ---- Shape tests ----

describe("useAppStore composable", () => {
  test("useAppStore is exported as a function", () => {
    expect(typeof useAppStore).toBe("function");
  });

  test("useAppStore.$id is 'app'", () => {
    expect(useAppStore.$id).toBe("app");
  });
});

// ---- History debounce tests ----

describe("useAppStore – move history debounce", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("rapid updateObjectPosition calls produce a single history entry after the debounce window", async () => {
    const obj = makeObject("obj-1");
    const store = await setupStore({ objects: [obj] });

    // Mock position update; return the same object with updated coordinates.
    spyOn(api.objects, "update").mockImplementation(
      async (_projectId, _id, pos) => ({ ...obj, ...pos }) as FurnitureObject,
    );

    const historyAddSpy = spyOn(api.history, "add").mockResolvedValue(
      makeHistoryEntry("h-new", 999),
    );

    // Simulate 5 rapid moves without advancing time.
    for (let i = 0; i < 5; i++) {
      await store.updateObjectPosition("obj-1", { position_x: i * 10 });
    }

    // No history entry should have been written yet.
    expect(historyAddSpy).not.toHaveBeenCalled();

    // Advance past the 800 ms debounce window.
    jest.advanceTimersByTime(800);
    // Allow the resulting async recordHistory call to settle.
    await Promise.resolve();
    await Promise.resolve();

    // Exactly one entry should have been recorded, regardless of move count.
    expect(historyAddSpy).toHaveBeenCalledTimes(1);
    const [, payload] = historyAddSpy.mock.calls[0] as [
      string,
      { action_type: string; action_label: string },
    ];
    expect(payload.action_type).toBe("move_object");
  });
});

// ---- undoHistory / redoHistory tests ----

describe("useAppStore – undoHistory / redoHistory", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("undoHistory decrements historyCurrentIndex and restores objects", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];
    const restoredObjects = [makeObject("obj-restored")];

    const store = await setupStore({ historyEntries: entries });
    expect(store.state.historyCurrentIndex).toBe(2);

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: restoredObjects,
    });

    await store.undoHistory();

    expect(navigateSpy).toHaveBeenCalledWith("p1", "h1");
    expect(store.state.historyCurrentIndex).toBe(1);
    expect(store.state.objects).toEqual(restoredObjects);
    expect(store.state.selectedObjectIds).toEqual([]);
    expect(store.state.contextMode).toBe("none");
  });

  test("redoHistory increments historyCurrentIndex and restores objects", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];
    const restoredObjects = [makeObject("obj-redo")];

    const store = await setupStore({ historyEntries: entries });

    // Simulate being at index 1 (after one undo).
    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: restoredObjects,
    });
    await store.undoHistory(); // moves to index 1
    navigateSpy.mockClear();

    await store.redoHistory();

    expect(navigateSpy).toHaveBeenCalledWith("p1", "h2");
    expect(store.state.historyCurrentIndex).toBe(2);
    expect(store.state.objects).toEqual(restoredObjects);
  });

  test("undoHistory does not go below 0", async () => {
    const entries = [makeHistoryEntry("h0", 0)];

    const store = await setupStore({ historyEntries: entries });
    // historyCurrentIndex is 0 (the only entry).

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.undoHistory(); // targetIndex = -1, should be a no-op.

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(store.state.historyCurrentIndex).toBe(0);
  });

  test("redoHistory does not go beyond the last entry", async () => {
    const entries = [makeHistoryEntry("h0", 0)];
    const store = await setupStore({ historyEntries: entries });
    // Already at the end.

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.redoHistory(); // no-op

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(store.state.historyCurrentIndex).toBe(0);
  });

  test("undoHistory keeps historyCurrentIndex unchanged on API error", async () => {
    const entries = [makeHistoryEntry("h0", 0), makeHistoryEntry("h1", 1)];
    const store = await setupStore({ historyEntries: entries });
    expect(store.state.historyCurrentIndex).toBe(1);

    spyOn(api.history, "navigate").mockRejectedValue(new Error("network"));

    await store.undoHistory();

    // Index must not have changed.
    expect(store.state.historyCurrentIndex).toBe(1);
  });
});

// ---- recordHistory branching (trim_after_id) tests ----

describe("useAppStore – recordHistory after undo sends trim_after_id", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("recordHistory passes trim_after_id when historyCurrentIndex is behind the tail", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];

    const store = await setupStore({ historyEntries: entries });
    expect(store.state.historyCurrentIndex).toBe(2);

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.undoHistory(); // index → 1
    await store.undoHistory(); // index → 0
    expect(store.state.historyCurrentIndex).toBe(0);
    navigateSpy.mockRestore();

    const newEntry = makeHistoryEntry("h-new", 999);
    const historyAddSpy = spyOn(api.history, "add").mockResolvedValue(newEntry);

    await store.recordHistory("create_object", "Added object");

    expect(historyAddSpy).toHaveBeenCalledTimes(1);
    const [, payload] = historyAddSpy.mock.calls[0] as [
      string,
      { trim_after_id?: string },
    ];
    // Should trim after h0 (the entry at historyCurrentIndex=0).
    expect(payload.trim_after_id).toBe("h0");
  });

  test("recordHistory truncates local historyEntries when trim_after_id is set", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];

    const store = await setupStore({ historyEntries: entries });

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.undoHistory(); // index → 1
    navigateSpy.mockRestore();

    const newEntry = makeHistoryEntry("h-new", 999);
    spyOn(api.history, "add").mockResolvedValue(newEntry);

    await store.recordHistory("create_object", "Added object");

    // h2 should have been removed; list is now [h0, h1, h-new].
    expect(store.state.historyEntries).toHaveLength(3);
    expect(store.state.historyEntries[2].id).toBe("h-new");
    expect(store.state.historyCurrentIndex).toBe(2);
  });

  test("recordHistory does NOT send trim_after_id when at the tail", async () => {
    const entries = [makeHistoryEntry("h0", 0), makeHistoryEntry("h1", 1)];

    const store = await setupStore({ historyEntries: entries });
    expect(store.state.historyCurrentIndex).toBe(1); // already at tail

    const historyAddSpy = spyOn(api.history, "add").mockResolvedValue(
      makeHistoryEntry("h-new", 999),
    );

    await store.recordHistory("create_object", "Added object");

    const [, payload] = historyAddSpy.mock.calls[0] as [
      string,
      { trim_after_id?: string },
    ];
    expect(payload.trim_after_id).toBeUndefined();
  });
});
