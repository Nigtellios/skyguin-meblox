import type { Database } from "bun:sqlite";
import type { Route, RouteHandler } from "../types";
import type { SqlValue } from "./http";

export function getOne<T>(
  database: Database,
  sql: string,
  ...params: SqlValue[]
) {
  return database.query(sql).get(...params) as T | null;
}

export function getAll<T>(
  database: Database,
  sql: string,
  ...params: SqlValue[]
) {
  return database.query(sql).all(...params) as T[];
}

export function createRouter() {
  const routes: Route[] = [];

  function addRoute(method: string, path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    const pattern = new RegExp(
      "^" +
        path.replace(/:([^/]+)/g, (_match, name: string) => {
          paramNames.push(name);
          return "([^/]+)";
        }) +
        "$",
    );
    routes.push({ method, pattern, paramNames, handler });
  }

  return { addRoute, routes };
}
