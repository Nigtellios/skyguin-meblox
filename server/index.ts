import { startServer } from "./app";
import { getDatabase } from "./db/database";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;
const server = startServer(getDatabase(), port);

console.log(
  `🪵 Skyguin Meblox server running on http://localhost:${server.port}`,
);
