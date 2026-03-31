type SceneCanvasLike =
  | {
      captureScreenshot?: unknown;
      $?: {
        exposed?: {
          captureScreenshot?: unknown;
        } | null;
      } | null;
    }
  | null
  | undefined;

type ThumbnailLogger = (message: string, error: unknown) => void;

type SaveProjectThumbnailOptions = {
  projectId: string | null;
  sceneCanvasRef: SceneCanvasLike;
  saveThumbnail: (projectId: string, thumbnail: string) => Promise<unknown>;
  logger?: ThumbnailLogger;
};

type SaveProjectThumbnailIfNeededOptions = SaveProjectThumbnailOptions & {
  showProjectsDashboard: boolean;
};

function resolveCaptureScreenshot(
  sceneCanvasRef: SceneCanvasLike,
): (() => unknown) | null {
  if (!sceneCanvasRef || typeof sceneCanvasRef !== "object") {
    return null;
  }

  if (typeof sceneCanvasRef.captureScreenshot === "function") {
    return sceneCanvasRef.captureScreenshot.bind(sceneCanvasRef);
  }

  const exposed = sceneCanvasRef.$?.exposed;
  if (typeof exposed?.captureScreenshot === "function") {
    return exposed.captureScreenshot.bind(exposed);
  }

  return null;
}

export function captureProjectThumbnail(
  sceneCanvasRef: SceneCanvasLike,
  logger: ThumbnailLogger = console.error,
): string | null {
  const captureScreenshot = resolveCaptureScreenshot(sceneCanvasRef);
  if (!captureScreenshot) {
    return null;
  }

  try {
    const screenshot = captureScreenshot();
    if (typeof screenshot !== "string" || screenshot.length === 0) {
      return null;
    }

    return screenshot;
  } catch (error) {
    logger("Failed to capture project thumbnail:", error);
    return null;
  }
}

export async function saveProjectThumbnail({
  projectId,
  sceneCanvasRef,
  saveThumbnail,
  logger = console.error,
}: SaveProjectThumbnailOptions): Promise<void> {
  if (!projectId) {
    return;
  }

  const dataUrl = captureProjectThumbnail(sceneCanvasRef, logger);
  if (!dataUrl) {
    return;
  }

  try {
    await saveThumbnail(projectId, dataUrl);
  } catch (error) {
    logger("Failed to save project thumbnail:", error);
  }
}

export async function saveProjectThumbnailIfNeeded({
  showProjectsDashboard,
  ...options
}: SaveProjectThumbnailIfNeededOptions): Promise<void> {
  if (showProjectsDashboard) {
    return;
  }

  await saveProjectThumbnail(options);
}
