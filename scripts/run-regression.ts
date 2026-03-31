export {};

const apiUrl = "http://127.0.0.1:3001/api/projects";
const uiUrl = "http://127.0.0.1:5173";

type SpawnedProcess = ReturnType<typeof Bun.spawn>;

function assertRunning(process: SpawnedProcess, label: string) {
  if (process.exitCode !== null) {
    throw new Error(`${label} exited before becoming healthy.`);
  }
}

async function waitForHealthyServer(
  url: string,
  label: string,
  process: SpawnedProcess,
  timeoutMs = 20_000,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    assertRunning(process, label);

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // service is still booting
    }

    await Bun.sleep(250);
  }

  throw new Error(
    `${label} did not become healthy within ${timeoutMs}ms (${url}).`,
  );
}

async function stopProcess(process: SpawnedProcess | null | undefined) {
  if (!process) return;
  if (process.exitCode === null) {
    process.kill();
  }
  await process.exited;
}

const backend = Bun.spawn({
  cmd: ["bun", "run", "server/index.ts"],
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: "3001",
  },
  stdout: "inherit",
  stderr: "inherit",
});

const frontend = Bun.spawn({
  cmd: [
    "bunx",
    "vite",
    "--config",
    "client/vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
  ],
  cwd: process.cwd(),
  env: process.env,
  stdout: "inherit",
  stderr: "inherit",
});

try {
  await waitForHealthyServer(apiUrl, "Backend API", backend);
  await waitForHealthyServer(uiUrl, "Frontend UI", frontend);

  const regression = Bun.spawn({
    cmd: ["bun", "run", "scripts/smoke-project-open.ts"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      MEBLOX_UI_URL: uiUrl,
      MEBLOX_API_URL: "http://127.0.0.1:3001/api",
    },
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await regression.exited;
  if (exitCode !== 0) {
    throw new Error(`Playwright regression failed with exit code ${exitCode}.`);
  }
} finally {
  await stopProcess(frontend);
  await stopProcess(backend);
}
