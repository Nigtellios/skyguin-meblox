import { describe, expect, mock, spyOn, test } from "bun:test";
import {
  captureProjectThumbnail,
  saveProjectThumbnail,
  saveProjectThumbnailIfNeeded,
} from "../projectThumbnails";

describe("projectThumbnails", () => {
  test("captureProjectThumbnail returns null when captureScreenshot exists but is not callable", () => {
    const logger = mock(() => undefined);

    expect(
      captureProjectThumbnail({ captureScreenshot: true }, logger),
    ).toBeNull();
    expect(logger).not.toHaveBeenCalled();
  });

  test("captureProjectThumbnail uses the direct exposed method when available", () => {
    const sceneCanvasRef = {
      captureScreenshot() {
        return "data:image/jpeg;base64,direct";
      },
    };

    expect(captureProjectThumbnail(sceneCanvasRef)).toBe(
      "data:image/jpeg;base64,direct",
    );
  });

  test("captureProjectThumbnail falls back to Vue's internal exposed object", () => {
    const sceneCanvasRef = {
      $: {
        exposed: {
          captureScreenshot() {
            return "data:image/jpeg;base64,exposed";
          },
        },
      },
    };

    expect(captureProjectThumbnail(sceneCanvasRef)).toBe(
      "data:image/jpeg;base64,exposed",
    );
  });

  test("captureProjectThumbnail logs and returns null when capture throws", () => {
    const logger = mock(() => undefined);

    const screenshot = captureProjectThumbnail(
      {
        captureScreenshot() {
          throw new Error("webgl lost");
        },
      },
      logger,
    );

    expect(screenshot).toBeNull();
    expect(logger).toHaveBeenCalledTimes(1);
    expect(
      (logger as unknown as { mock: { calls: Array<[string, unknown]> } }).mock
        .calls[0]?.[0],
    ).toBe("Failed to capture project thumbnail:");
  });

  test("saveProjectThumbnail persists the captured thumbnail", async () => {
    const saveThumbnail = mock(async () => undefined);

    await saveProjectThumbnail({
      projectId: "p1",
      sceneCanvasRef: {
        captureScreenshot() {
          return "data:image/jpeg;base64,thumb";
        },
      },
      saveThumbnail,
    });

    expect(saveThumbnail).toHaveBeenCalledTimes(1);
    expect(saveThumbnail).toHaveBeenCalledWith(
      "p1",
      "data:image/jpeg;base64,thumb",
    );
  });

  test("saveProjectThumbnail swallows save errors so project switching is not blocked", async () => {
    const logger = mock(() => undefined);
    const saveThumbnail = mock(async () => {
      throw new Error("db offline");
    });

    expect(
      saveProjectThumbnail({
        projectId: "p1",
        sceneCanvasRef: {
          captureScreenshot() {
            return "data:image/jpeg;base64,thumb";
          },
        },
        saveThumbnail,
        logger,
      }),
    ).resolves.toBeUndefined();

    expect(saveThumbnail).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(
      (logger as unknown as { mock: { calls: Array<[string, unknown]> } }).mock
        .calls[0]?.[0],
    ).toBe("Failed to save project thumbnail:");
  });

  test("saveProjectThumbnailIfNeeded skips saving while the dashboard is visible", async () => {
    const sceneCanvasRef = {
      captureScreenshot() {
        return "data:image/jpeg;base64,thumb";
      },
    };
    const captureSpy = spyOn(sceneCanvasRef, "captureScreenshot");
    const saveThumbnail = mock(async () => undefined);

    await saveProjectThumbnailIfNeeded({
      projectId: "p1",
      showProjectsDashboard: true,
      sceneCanvasRef,
      saveThumbnail,
    });

    expect(captureSpy).not.toHaveBeenCalled();
    expect(saveThumbnail).not.toHaveBeenCalled();
  });
});
