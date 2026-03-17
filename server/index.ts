import { startServer } from "./app";
import { getDatabase } from "./db/database";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;
const debugMode = process.env.LOG_LEVEL === "debug";
const server = startServer(getDatabase(), port, debugMode);

console.log(
  `🪵 Skyguin Meblox server running on http://localhost:${server.port}${debugMode ? " [DEBUG]" : ""}`,
);
