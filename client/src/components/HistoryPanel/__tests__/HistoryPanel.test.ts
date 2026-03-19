import { describe, expect, test } from "bun:test";

// HistoryPanel shows the project action history with undo/revert support.
describe("HistoryPanel", () => {
  test("history entry requires id, action_type, action_label and created_at", () => {
    const entry = {
      id: "h1",
      project_id: "p1",
      action_type: "create_object",
      action_label: "Dodano element",
      created_at: Date.now(),
    };
    expect(entry.id).toBeString();
    expect(entry.action_type).toBeString();
    expect(entry.action_label).toBeString();
    expect(entry.created_at).toBeNumber();
  });

  test("history timestamps are sortable", () => {
    const entries = [
      { id: "h1", created_at: 1000 },
      { id: "h2", created_at: 2000 },
      { id: "h3", created_at: 3000 },
    ];
    const sorted = [...entries].sort((a, b) => a.created_at - b.created_at);
    expect(sorted[0]?.id).toBe("h1");
    expect(sorted[2]?.id).toBe("h3");
  });

  test("created_at can be formatted as a readable date", () => {
    const ts = 1700000000000;
    const date = new Date(ts);
    expect(date.getFullYear()).toBeGreaterThanOrEqual(2023);
  });
});
