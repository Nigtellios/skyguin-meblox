import type { Database } from "bun:sqlite";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { registerComponentRoutes } from "./controllers/components/components";
import { registerHistoryRoutes } from "./controllers/history/history";
import { registerMaterialRoutes } from "./controllers/materials/materials";
import { registerObjectRoutes } from "./controllers/objects/objects";
import { registerProjectRoutes } from "./controllers/projects/projects";
import { registerRelationRoutes } from "./controllers/relations/relations";
import { createRouter } from "./utils/db";
import { cors, json } from "./utils/http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_PATH = resolve(join(__dirname, "../client/dist"));

export function createFetchHandler(database: Database, debugMode = false) {
  const { addRoute, routes } = createRouter();

  registerProjectRoutes(addRoute, database);
  registerObjectRoutes(addRoute, database);
  registerComponentRoutes(addRoute, database);
  registerRelationRoutes(addRoute, database);
  registerHistoryRoutes(addRoute, database);
  registerMaterialRoutes(addRoute, database);

  return async function fetch(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const startTime = debugMode ? Date.now() : 0;

    if (debugMode) {
      console.log(`[DEBUG] → ${req.method} ${pathname}`);
    }

    if (req.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    if (pathname.startsWith("/api/")) {
      for (const route of routes) {
        if (route.method !== req.method) {
          continue;
        }

        const match = pathname.match(route.pattern);
        if (!match) {
          continue;
        }

        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          const value = match[index + 1];
          if (value !== undefined) {
            params[name] = value;
          }
        });

        try {
          const response = cors(await route.handler(req, params));
          if (debugMode) {
            console.log(
              `[DEBUG] ← ${req.method} ${pathname} ${response.status} (${Date.now() - startTime}ms)`,
            );
          }
          return response;
        } catch (error) {
          console.error("Route error:", error);
          if (debugMode) {
            console.error(
              `[DEBUG] ✗ ${req.method} ${pathname} 500 (${Date.now() - startTime}ms)`,
            );
          }
          return cors(json({ error: "Internal server error" }, 500));
        }
      }

      if (debugMode) {
        console.warn(`[DEBUG] ← ${req.method} ${pathname} 404 (not found)`);
      }
      return cors(json({ error: "Not found" }, 404));
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const resolvedStaticPath = resolve(DIST_PATH, relativePath);
    const isInsideDist =
      resolvedStaticPath === DIST_PATH ||
      resolvedStaticPath.startsWith(`${DIST_PATH}${sep}`);

    if (isInsideDist) {
      const staticFile = Bun.file(resolvedStaticPath);
      if (await staticFile.exists()) {
        return cors(new Response(staticFile));
      }
    }

    const indexFile = Bun.file(join(DIST_PATH, "index.html"));
    if (await indexFile.exists()) {
      return cors(
        new Response(indexFile, {
          headers: { "Content-Type": "text/html" },
        }),
      );
    }

    return cors(json({ error: "Not found" }, 404));
  };
}

export function startServer(
  database: Database,
  port = 3001,
  debugMode = false,
) {
  return Bun.serve({
    port,
    fetch: createFetchHandler(database, debugMode),
  });
}
