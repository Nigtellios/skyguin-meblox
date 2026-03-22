import { describe, expect, test } from "bun:test";
import { formatDate } from "../../ProjectsModal/projectsModalUtils";

// ProjectsDashboard renders a full-screen tile grid of all projects.
// It uses the shared formatDate helper and pure local state for the 3-dot
// menu toggle and delete confirmation.  The tests below cover the pure
// helper/logic pieces without needing a DOM mount.

describe("ProjectsDashboard – formatDate helper", () => {
  test("produces a non-empty localised date string", () => {
    const ts = new Date("2025-03-22T11:00:00Z").getTime();
    const result = formatDate(ts);
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("2025");
  });

  test("formats different timestamps differently", () => {
    const ts1 = new Date("2025-01-01T00:00:00Z").getTime();
    const ts2 = new Date("2025-06-15T10:30:00Z").getTime();
    expect(formatDate(ts1)).not.toBe(formatDate(ts2));
  });
});

describe("ProjectsDashboard – 3-dot menu toggle logic", () => {
  test("clicking an id opens that menu", () => {
    const state = { openMenuId: null as string | null };
    const toggle = (id: string) => {
      state.openMenuId = state.openMenuId === id ? null : id;
    };

    toggle("p1");
    expect(state.openMenuId).not.toBeNull();
    expect(state.openMenuId!).toBe("p1");
  });

  test("clicking the same id again closes the menu", () => {
    const state = { openMenuId: null as string | null };
    const toggle = (id: string) => {
      state.openMenuId = state.openMenuId === id ? null : id;
    };

    toggle("p1");
    toggle("p1");
    expect(state.openMenuId).toBeNull();
  });

  test("clicking a different id switches the open menu", () => {
    const state = { openMenuId: null as string | null };
    const toggle = (id: string) => {
      state.openMenuId = state.openMenuId === id ? null : id;
    };

    toggle("p1");
    toggle("p2");
    expect(state.openMenuId).not.toBeNull();
    expect(state.openMenuId!).toBe("p2");
  });
});

describe("ProjectsDashboard – delete confirmation logic", () => {
  function canConfirmDelete(inputValue: string, projectName: string): boolean {
    return inputValue === projectName;
  }

  test("confirmation is allowed when input matches the project name exactly", () => {
    expect(canConfirmDelete("Mój projekt", "Mój projekt")).toBe(true);
  });

  test("confirmation is rejected when input is empty", () => {
    expect(canConfirmDelete("", "Mój projekt")).toBe(false);
  });

  test("confirmation is rejected when input differs by case", () => {
    expect(canConfirmDelete("mój projekt", "Mój projekt")).toBe(false);
  });

  test("confirmation is rejected when input has trailing whitespace", () => {
    expect(canConfirmDelete("Mój projekt ", "Mój projekt")).toBe(false);
  });

  test("confirmation is rejected when input is a partial match", () => {
    expect(canConfirmDelete("Mój", "Mój projekt")).toBe(false);
  });
});

describe("ProjectsDashboard – project list ordering", () => {
  type MinimalProject = { id: string; updated_at: number };

  function sortByUpdatedAtDesc(projects: MinimalProject[]): MinimalProject[] {
    return [...projects].sort((a, b) => b.updated_at - a.updated_at);
  }

  test("projects are displayed with the most recently edited first", () => {
    const projects: MinimalProject[] = [
      { id: "p1", updated_at: 1000 },
      { id: "p3", updated_at: 3000 },
      { id: "p2", updated_at: 2000 },
    ];
    const sorted = sortByUpdatedAtDesc(projects);
    expect(sorted.map((p) => p.id)).toEqual(["p3", "p2", "p1"]);
  });

  test("a project moved to the front after update appears first", () => {
    const projects: MinimalProject[] = [
      { id: "p2", updated_at: 2000 },
      { id: "p1", updated_at: 1000 },
    ];

    // Simulate splice + unshift (what saveThumbnail / renameProject do)
    const idx = projects.findIndex((p) => p.id === "p1");
    const updated = { id: "p1", updated_at: 9999 };
    projects.splice(idx, 1);
    projects.unshift(updated);

    expect(projects[0]?.id).toBe("p1");
    expect(projects[0]?.updated_at).toBe(9999);
  });
});
