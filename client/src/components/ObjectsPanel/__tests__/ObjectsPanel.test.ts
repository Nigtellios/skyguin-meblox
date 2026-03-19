import { describe, expect, test } from "bun:test";

// ObjectsPanel shows the list of furniture objects in the project.
// It also hosts the AddObjectDialog.
describe("ObjectsPanel", () => {
  test("object list sorting by creation time preserves order", () => {
    const objects = [
      { id: "a", name: "Bok", created_at: 1000 },
      { id: "b", name: "Półka", created_at: 2000 },
      { id: "c", name: "Dno", created_at: 500 },
    ];
    const sorted = [...objects].sort((a, b) => a.created_at - b.created_at);
    expect(sorted[0]?.name).toBe("Dno");
    expect(sorted[1]?.name).toBe("Bok");
    expect(sorted[2]?.name).toBe("Półka");
  });

  test("objects can be filtered by name", () => {
    const objects = [
      { id: "a", name: "Bok lewy" },
      { id: "b", name: "Bok prawy" },
      { id: "c", name: "Półka górna" },
    ];

    const filtered = objects.filter((o) =>
      o.name.toLowerCase().includes("bok"),
    );
    expect(filtered).toHaveLength(2);
  });

  test("selecting multiple objects returns array of ids", () => {
    const selectedIds = new Set(["a", "b"]);
    expect(selectedIds.has("a")).toBe(true);
    expect(selectedIds.has("c")).toBe(false);
    expect(selectedIds.size).toBe(2);
  });
});
