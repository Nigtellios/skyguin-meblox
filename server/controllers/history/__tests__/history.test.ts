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
});
