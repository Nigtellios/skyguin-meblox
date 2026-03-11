export {};

const port = 4310;
const appUrl = `http://127.0.0.1:${port}`;
const apiUrl = `${appUrl}/api/projects`;
const STABILITY_CHECK_DURATION_MS = 5_500;

function ensureOk(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForHealthyServer(url: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
    } catch {
      // server still booting
    }

    await Bun.sleep(250);
  }

  throw new Error(`Server did not become healthy within ${timeoutMs}ms.`);
}

const serverProcess = Bun.spawn({
  cmd: ["bun", "run", "server/index.ts"],
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdout: "pipe",
  stderr: "pipe",
});

try {
  const initialResponse = await waitForHealthyServer(apiUrl, 15_000);
  ensureOk(initialResponse.ok, "Initial health check failed.");

  await Bun.sleep(STABILITY_CHECK_DURATION_MS);
  ensureOk(
    serverProcess.exitCode === null,
    "Server exited before 5.5 seconds elapsed.",
  );

  const finalResponse = await fetch(appUrl);
  ensureOk(finalResponse.ok, "Final app availability check failed.");

  const html = await finalResponse.text();
  ensureOk(
    html.includes("Meblox"),
    "Expected built application HTML was not served.",
  );
} finally {
  if (serverProcess.pid) {
    process.kill(serverProcess.pid, "SIGTERM");
  }
  await serverProcess.exited;
}
