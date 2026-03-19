export type JsonObject = Record<string, unknown>;
export type SqlValue = string | number | bigint | boolean | Uint8Array | null;

export function toSqlValue(value: SqlValue | undefined) {
  return value ?? null;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export async function parseJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function parseObjectBody<T>(req: Request): Promise<Partial<T>> {
  const value = await parseJson(req);
  return isJsonObject(value) ? (value as Partial<T>) : {};
}

export async function parseArrayBody<T>(req: Request): Promise<T[]> {
  const value = await parseJson(req);
  return Array.isArray(value) ? (value as T[]) : [];
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function cors(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
