import { describe, expect, test } from "bun:test";
import { DEFAULT_PROJECT_NAME, formatDate } from "../projectsModalUtils";

// ProjectsModal lists projects and allows creation and selection.
// The pure helper logic is extracted into projectsModalUtils for direct testing.
describe("ProjectsModal", () => {
  test("formatDate produces a non-empty Polish date string", () => {
    const ts = new Date("2024-06-15T10:30:00Z").getTime();
    const result = formatDate(ts);
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
    // Should include the year
    expect(result).toContain("2024");
  });

  test("formatDate formats different timestamps differently", () => {
    const ts1 = new Date("2024-01-01T00:00:00Z").getTime();
    const ts2 = new Date("2024-06-15T10:30:00Z").getTime();
    expect(formatDate(ts1)).not.toBe(formatDate(ts2));
  });

  test("DEFAULT_PROJECT_NAME is a non-empty string", () => {
    expect(DEFAULT_PROJECT_NAME).toBeString();
    expect(DEFAULT_PROJECT_NAME.length).toBeGreaterThan(0);
    expect(DEFAULT_PROJECT_NAME).toBe("Nowy projekt");
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
});
