import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "../../../db/database";
import type { HistoryRow, ProjectRow } from "../../../types";
import { createHistoryHandlers } from "../history";

let tempDir: string;
let database: ReturnType<typeof createDatabase>;
let projectId: string;

function cleanupTempDir() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

beforeEach(async () => {
  cleanupTempDir();
  tempDir = mkdtempSync(join(tmpdir(), "meblox-history-test-"));
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

describe("history controller", () => {
  test("lists history (empty initially)", async () => {
    const handlers = createHistoryHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/history`,
    );
    const response = await handlers.getHistory(req, { projectId });
    expect(response.status).toBe(200);
    const history = (await response.json()) as HistoryRow[];
    expect(history).toHaveLength(0);
  });

  test("adds a history entry", async () => {
    const handlers = createHistoryHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/history`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "create_object",
          action_label: "Dodano element",
          snapshot: "[]",
        }),
      },
    );
    const response = await handlers.addHistory(req, { projectId });
    expect(response.status).toBe(201);
    const entry = (await response.json()) as HistoryRow;
    expect(entry.action_type).toBe("create_object");
    expect(entry.action_label).toBe("Dodano element");
    expect(entry.id).toBeString();
  });

  test("history does not include snapshot field in GET", async () => {
    const handlers = createHistoryHandlers(database);
    const addReq = new Request(
      `http://app.local/api/projects/${projectId}/history`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "test",
          action_label: "Test",
          snapshot: '[{"id":"obj1"}]',
        }),
      },
    );
    await handlers.addHistory(addReq, { projectId });

    const listReq = new Request(
      `http://app.local/api/projects/${projectId}/history`,
    );
    const response = await handlers.getHistory(listReq, { projectId });
    const history = (await response.json()) as HistoryRow[];
    expect(history).toHaveLength(1);
    expect((history[0] as { snapshot?: string }).snapshot).toBeUndefined();
  });

  test("trims history to 100 entries maximum", async () => {
    const handlers = createHistoryHandlers(database);
    for (let i = 0; i < 110; i++) {
      const req = new Request(
        `http://app.local/api/projects/${projectId}/history`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action_type: "test",
            action_label: `Wpis ${i}`,
            snapshot: "[]",
          }),
        },
      );
      await handlers.addHistory(req, { projectId });
    }

    const listReq = new Request(
      `http://app.local/api/projects/${projectId}/history`,
    );
    const response = await handlers.getHistory(listReq, { projectId });
    const history = (await response.json()) as HistoryRow[];
    expect(history).toHaveLength(100);
  });

  test("returns 404 when reverting non-existent history entry", async () => {
    const handlers = createHistoryHandlers(database);
    const req = new Request(
      `http://app.local/api/projects/${projectId}/history/non-existent/revert`,
      { method: "POST" },
    );
    const response = await handlers.revertHistory(req, {
      projectId,
      historyId: "non-existent",
    });
    expect(response.status).toBe(404);
  });

  test("navigate restores objects without deleting future history entries", async () => {
    const handlers = createHistoryHandlers(database);

    // Add two history entries (with empty snapshot to avoid NOT NULL issues in test)
    const addEntry = async (label: string) => {
      const resp = await handlers.addHistory(
        new Request(`http://app.local/api/projects/${projectId}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action_type: "test",
            action_label: label,
            snapshot: "[]",
          }),
        }),
        { projectId },
      );
      return (await resp.json()) as HistoryRow;
    };

    const entryA = await addEntry("Entry A");
    await addEntry("Entry B");

    // Navigate back to A (undo-style: no future entries deleted)
    const navResp = await handlers.navigateHistory(
      new Request(
        `http://app.local/api/projects/${projectId}/history/${entryA.id}/navigate`,
        { method: "POST" },
      ),
      { projectId, historyId: entryA.id },
    );
    expect(navResp.status).toBe(200);
    const navResult = (await navResp.json()) as {
      success: boolean;
      objects: { id: string }[];
    };
    expect(navResult.success).toBe(true);

    // Both history entries still exist (navigate does NOT delete future ones)
    const listResp = await handlers.getHistory(
      new Request(`http://app.local/api/projects/${projectId}/history`),
      { projectId },
    );
    const entries = (await listResp.json()) as HistoryRow[];
    expect(entries.length).toBe(2);
  });

  test("navigate returns 404 for non-existent entry", async () => {
    const handlers = createHistoryHandlers(database);
    const response = await handlers.navigateHistory(
      new Request(
        `http://app.local/api/projects/${projectId}/history/non-existent/navigate`,
        { method: "POST" },
      ),
      { projectId, historyId: "non-existent" },
    );
    expect(response.status).toBe(404);
  });

  test("addHistory with trim_after_id removes future entries before inserting", async () => {
    const handlers = createHistoryHandlers(database);

    const addEntry = async (label: string) => {
      const resp = await handlers.addHistory(
        new Request(`http://app.local/api/projects/${projectId}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action_type: "test",
            action_label: label,
            snapshot: "[]",
          }),
        }),
        { projectId },
      );
      return (await resp.json()) as HistoryRow;
    };

    const entryA = await addEntry("A");
    await addEntry("B");
    await addEntry("C");

    // Now add a new entry with trim_after_id = entryA, simulating an action taken after undoing to A
    await handlers.addHistory(
      new Request(`http://app.local/api/projects/${projectId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "test",
          action_label: "D",
          snapshot: "[]",
          trim_after_id: entryA.id,
        }),
      }),
      { projectId },
    );

    const listResp = await handlers.getHistory(
      new Request(`http://app.local/api/projects/${projectId}/history`),
      { projectId },
    );
    const entries = (await listResp.json()) as HistoryRow[];
    const labels = entries.map((e) => e.action_label);

    // A is kept, B and C were trimmed, D was added
    expect(labels).toContain("A");
    expect(labels).toContain("D");
    expect(labels).not.toContain("B");
    expect(labels).not.toContain("C");
  });
});
