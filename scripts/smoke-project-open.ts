import { chromium } from "playwright";

type Project = { id: string; name: string; thumbnail?: string | null };
type FurnitureObject = { id: string; name: string };

const uiUrl = process.env.MEBLOX_UI_URL ?? "http://127.0.0.1:5173";
const apiUrl = process.env.MEBLOX_API_URL ?? "http://127.0.0.1:3001/api";
const projectName = `Smoke Project ${Date.now()}`;

async function assertReachable(url: string, label: string) {
  const response = await fetch(url).catch(() => null);
  if (!response) {
    throw new Error(
      `${label} is not reachable at ${url}. Start the matching local server first.`,
    );
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`API ${init?.method ?? "GET"} ${path} failed: ${message}`);
  }

  return (await response.json()) as T;
}

async function createProjectFixture() {
  const project = await request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name: projectName }),
  });

  const object = await request<FurnitureObject>(
    `/projects/${project.id}/objects`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Smoke Cabinet",
        width: 600,
        height: 720,
        depth: 560,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        color: "#8B7355",
      }),
    },
  );

  return { project, object };
}

async function deleteProjectFixture(projectId: string) {
  await fetch(`${apiUrl}/projects/${projectId}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

async function waitForProjectThumbnail(projectId: string, timeoutMs = 10_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const projects = await request<Project[]>("/projects");
    const project = projects.find((item) => item.id === projectId);
    if (project?.thumbnail) {
      return project.thumbnail;
    }

    await Bun.sleep(250);
  }

  throw new Error(
    `Project ${projectId} thumbnail was not saved within ${timeoutMs}ms.`,
  );
}

async function readCanvasMetrics(page: import("playwright").Page) {
  return page.locator("canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    return {
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
  });
}

function assertCanvasMetrics(metrics: Record<string, number>) {
  if (
    metrics.width <= 0 ||
    metrics.height <= 0 ||
    metrics.clientWidth <= 0 ||
    metrics.clientHeight <= 0 ||
    metrics.rectWidth <= 0 ||
    metrics.rectHeight <= 0
  ) {
    throw new Error(
      `Canvas has invalid size after opening project: ${JSON.stringify(metrics)}`,
    );
  }
}

async function readCanvasSnapshot(page: import("playwright").Page) {
  return page.locator("canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const dataUrl = canvas.toDataURL("image/png");

    return {
      dataUrl,
      length: dataUrl.length,
    };
  });
}

function assertCanvasSnapshot(snapshot: { dataUrl: string; length: number }) {
  if (!snapshot.dataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("Canvas snapshot did not return a PNG data URL.");
  }

  if (snapshot.length < 1_000) {
    throw new Error(
      `Canvas snapshot is unexpectedly small and suggests the renderer did not paint: ${snapshot.length}`,
    );
  }
}

async function openProjectFromDashboard(
  page: import("playwright").Page,
  project: Project,
) {
  const projectTile = page
    .locator("button")
    .filter({ hasText: project.name })
    .first();
  await projectTile.waitFor({ state: "visible" });
  await projectTile.click();
  await page.getByText(project.name, { exact: true }).waitFor();
  await page.locator("canvas").waitFor({ state: "visible" });
  await page.locator('button[title="Wróć do projektów"]').waitFor();
}

async function run() {
  await assertReachable(uiUrl, "Frontend UI");
  await assertReachable(`${apiUrl}/projects`, "Backend API");

  const { project } = await createProjectFixture();
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--use-gl=angle",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
      console.error("Page error:", error);
    });
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error") {
        consoleErrors.push(text);
      }
      if (message.type() === "warning") {
        consoleWarnings.push(text);
      }
    });

    await page.goto(uiUrl, { waitUntil: "networkidle" });

    await openProjectFromDashboard(page, project);

    const initialCanvasMetrics = await readCanvasMetrics(page);
    assertCanvasMetrics(initialCanvasMetrics);
    const initialCanvasSnapshot = await readCanvasSnapshot(page);
    assertCanvasSnapshot(initialCanvasSnapshot);

    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error("Canvas bounding box is not available.");
    }

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const backgroundClickPosition = {
      x: 60,
      y: Math.max(120, box.height * 0.25),
    };
    const deselectButton = page.locator('button[title="Odznacz"]');

    await page.mouse.click(centerX, centerY);
    await deselectButton.waitFor();

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 140, centerY - 90, { steps: 12 });
    await page.mouse.up();
    await deselectButton.waitFor();

    await canvas.click({ position: backgroundClickPosition });
    await page.getByRole("button", { name: "Dodaj element" }).waitFor();
    await deselectButton.waitFor({ state: "detached" });

    await page.locator('button[title="Wróć do projektów"]').click();
    await page.getByText("Wybierz projekt lub utwórz nowy").waitFor();

    const savedThumbnail = await waitForProjectThumbnail(project.id);
    if (!savedThumbnail.startsWith("data:image/jpeg;base64,")) {
      throw new Error("Saved project thumbnail is not a JPEG data URL.");
    }

    const projectTile = page
      .locator("button")
      .filter({ hasText: project.name })
      .first();
    const thumbnailImage = projectTile.locator("img");
    await thumbnailImage.waitFor();
    const thumbnailSrc = await thumbnailImage.getAttribute("src");
    if (thumbnailSrc !== savedThumbnail) {
      throw new Error(
        "Dashboard thumbnail does not match the saved project thumbnail.",
      );
    }

    await openProjectFromDashboard(page, project);

    await page.locator('button[title="Projekty"]').click();
    await page.getByText("Wybierz projekt lub utwórz nowy").waitFor();

    await openProjectFromDashboard(page, project);

    const reopenedCanvasMetrics = await readCanvasMetrics(page);
    assertCanvasMetrics(reopenedCanvasMetrics);
    const reopenedCanvasSnapshot = await readCanvasSnapshot(page);
    assertCanvasSnapshot(reopenedCanvasSnapshot);

    const shadowDeprecationWarnings = consoleWarnings.filter((message) =>
      message.includes("PCFSoftShadowMap has been deprecated"),
    );

    if (shadowDeprecationWarnings.length > 0) {
      throw new Error(
        `Unexpected shadow deprecation warning(s): ${shadowDeprecationWarnings.join(" | ")}`,
      );
    }

    if (pageErrors.length > 0) {
      throw new Error(`Page errors detected: ${pageErrors.join(" | ")}`);
    }

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors detected: ${consoleErrors.join(" | ")}`);
    }

    console.log("Smoke test passed.", {
      initialCanvasMetrics,
      initialCanvasSnapshotLength: initialCanvasSnapshot.length,
      reopenedCanvasMetrics,
      reopenedCanvasSnapshotLength: reopenedCanvasSnapshot.length,
      savedThumbnailLength: savedThumbnail.length,
    });
  } finally {
    await browser.close();
    await deleteProjectFixture(project.id);
  }
}

await run();
