export {};

const port = 4310;
const apiUrl = `http://127.0.0.1:${port}/api/projects`;
const STARTUP_TIMEOUT_MS = 30_000;

async function waitForHealthyServer(url: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // server still booting
    }

    await Bun.sleep(250);
  }

  throw new Error(`Server did not respond within ${timeoutMs}ms (${url}).`);
}

const serverProcess = Bun.spawn({
  cmd: ["bun", "run", "server/index.ts"],
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdout: "inherit",
  stderr: "inherit",
});

try {
  await waitForHealthyServer(apiUrl, STARTUP_TIMEOUT_MS);

  if (serverProcess.exitCode !== null) {
    throw new Error(
      `Server crashed during startup (exit code ${serverProcess.exitCode}).`,
    );
  }

  console.log("Server started successfully.");
} finally {
  if (serverProcess.pid) {
    process.kill(serverProcess.pid, "SIGTERM");
  }
  await serverProcess.exited;
}
