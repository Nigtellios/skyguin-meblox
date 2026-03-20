/**
 * Formats a Unix millisecond timestamp into a Polish locale date/time string
 * for display in the projects list.
 */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Default project name shown in the creation prompt. */
export const DEFAULT_PROJECT_NAME = "Nowy projekt";
