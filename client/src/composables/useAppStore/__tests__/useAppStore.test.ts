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
import { api } from "../../useApi";
import { useAppStore } from "../useAppStore";

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

async function setupStore(options?: {
  historyEntries?: HistoryEntry[];
  objects?: FurnitureObject[];
  currentProjectId?: string;
}) {
  const historyEntries = options?.historyEntries ?? [];
  const objects = options?.objects ?? [];
  const currentProjectId = options?.currentProjectId ?? "p1";

  spyOn(api.objects, "list").mockResolvedValue(objects);
  spyOn(api.components, "list").mockResolvedValue([]);
  spyOn(api.relations, "list").mockResolvedValue([]);
  spyOn(api.history, "list").mockResolvedValue(historyEntries);

  const store = useAppStore();
  await store.selectProject(currentProjectId);
  return store;
}

describe("useAppStore composable", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("is exported as a function", () => {
    expect(typeof useAppStore).toBe("function");
    expect(useAppStore.$id).toBe("app");
  });
});

describe("useAppStore – move history debounce", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("coalesces rapid updateObjectPosition calls into a single history entry", async () => {
    const obj = makeObject("obj-1");
    const store = await setupStore({ objects: [obj] });

    spyOn(api.objects, "update").mockImplementation(
      async (_projectId, _id, pos) => ({ ...obj, ...pos }) as FurnitureObject,
    );
    const historyAddSpy = spyOn(api.history, "add").mockResolvedValue(
      makeHistoryEntry("h-new", 999),
    );

    for (let i = 0; i < 5; i++) {
      await store.updateObjectPosition("obj-1", { position_x: i * 10 });
    }

    expect(historyAddSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(800);
    await Promise.resolve();
    await Promise.resolve();

    expect(historyAddSpy).toHaveBeenCalledTimes(1);
    const [, payload] = historyAddSpy.mock.calls[0] as [
      string,
      { action_type: string; action_label: string },
    ];
    expect(payload.action_type).toBe("move_object");
    expect(payload.action_label).toContain("Przesunięto");
  });
});

describe("useAppStore – undo/redo navigation", () => {
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

    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: restoredObjects,
    });
    await store.undoHistory();
    navigateSpy.mockClear();

    await store.redoHistory();

    expect(navigateSpy).toHaveBeenCalledWith("p1", "h2");
    expect(store.state.historyCurrentIndex).toBe(2);
    expect(store.state.objects).toEqual(restoredObjects);
  });

  test("undoHistory and redoHistory stop cleanly at the ends of the timeline", async () => {
    const store = await setupStore({
      historyEntries: [makeHistoryEntry("h0", 0)],
    });
    const navigateSpy = spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.undoHistory();
    await store.redoHistory();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(store.state.historyCurrentIndex).toBe(0);
  });

  test("undoHistory keeps the current index unchanged when navigation fails", async () => {
    const store = await setupStore({
      historyEntries: [makeHistoryEntry("h0", 0), makeHistoryEntry("h1", 1)],
    });
    spyOn(console, "error").mockImplementation(() => {});
    spyOn(api.history, "navigate").mockRejectedValue(new Error("network"));

    await store.undoHistory();

    expect(store.state.historyCurrentIndex).toBe(1);
  });
});

describe("useAppStore – recordHistory branching", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("passes trim_after_id and truncates local history when recording after undo", async () => {
    const entries = [
      makeHistoryEntry("h0", 0),
      makeHistoryEntry("h1", 1),
      makeHistoryEntry("h2", 2),
    ];
    const store = await setupStore({ historyEntries: entries });
    spyOn(api.history, "navigate").mockResolvedValue({
      success: true,
      objects: [],
    });

    await store.undoHistory();
    expect(store.state.historyCurrentIndex).toBe(1);

    const historyAddSpy = spyOn(api.history, "add").mockResolvedValue(
      makeHistoryEntry("h-new", 999),
    );

    await store.recordHistory("create_object", "Added object");

    const [, payload] = historyAddSpy.mock.calls[0] as [
      string,
      { trim_after_id?: string },
    ];
    expect(payload.trim_after_id).toBe("h1");
    expect(store.state.historyEntries.map((entry) => entry.id)).toEqual([
      "h0",
      "h1",
      "h-new",
    ]);
    expect(store.state.historyCurrentIndex).toBe(2);
  });

  test("omits trim_after_id when already at the latest history entry", async () => {
    const store = await setupStore({
      historyEntries: [makeHistoryEntry("h0", 0), makeHistoryEntry("h1", 1)],
    });
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

describe("useAppStore – project view actions", () => {
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

  test("loadProjects populates state.projects and shows the dashboard", async () => {
    const projects = [makeProject("p1", 3000), makeProject("p2", 1000)];
    const store = await setupProjectStore(projects);

    expect(store.state.projects).toEqual(projects);
    expect(store.state.showProjectsDashboard).toBe(true);
  });

  test("openProjectsDashboard always closes the modal and restores the projects view", () => {
    const store = useAppStore();
    store.setShowProjectsModal(true);
    store.setShowProjectsDashboard(false);

    store.openProjectsDashboard();

    expect(store.state.showProjectsModal).toBe(false);
    expect(store.state.showProjectsDashboard).toBe(true);
  });

  test("renameProject updates the record and moves it to the front", async () => {
    const p1 = makeProject("p1", 1000);
    const p2 = makeProject("p2", 2000);
    const store = await setupProjectStore([p2, p1]);

    const renamed = { ...p1, name: "Renamed Project", updated_at: 9999 };
    const updateSpy = spyOn(api.projects, "update").mockResolvedValue(renamed);

    await store.renameProject("p1", "Renamed Project");

    expect(updateSpy).toHaveBeenCalledWith("p1", { name: "Renamed Project" });
    expect(store.state.projects[0]?.id).toBe("p1");
    expect(store.state.projects[0]?.name).toBe("Renamed Project");
  });

  test("saveThumbnail updates the project and keeps the freshest one first", async () => {
    const p1 = makeProject("p1", 1000);
    const p2 = makeProject("p2", 2000);
    const store = await setupProjectStore([p2, p1]);

    const withThumb = {
      ...p1,
      thumbnail: "data:image/jpeg;base64,abc",
      updated_at: 9999,
    };
    const updateSpy = spyOn(api.projects, "update").mockResolvedValue(
      withThumb,
    );

    await store.saveThumbnail("p1", "data:image/jpeg;base64,abc");

    expect(updateSpy).toHaveBeenCalledWith("p1", {
      thumbnail: "data:image/jpeg;base64,abc",
    });
    expect(store.state.projects[0]?.id).toBe("p1");
    expect(store.state.projects[0]?.thumbnail).toBe(
      "data:image/jpeg;base64,abc",
    );
  });

  test("duplicateProject prepends the duplicated project copy", async () => {
    const p1 = makeProject("p1", 1000);
    const store = await setupProjectStore([p1]);
    const copy = {
      ...makeProject("p1-copy", 2000),
      name: "Project p1 (kopia)",
    };
    const duplicateSpy = spyOn(api.projects, "duplicate").mockResolvedValue(
      copy,
    );

    const result = await store.duplicateProject("p1");

    expect(duplicateSpy).toHaveBeenCalledWith("p1");
    expect(result.id).toBe("p1-copy");
    expect(store.state.projects[0]?.id).toBe("p1-copy");
  });
});
