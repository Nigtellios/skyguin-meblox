import type { SceneClickTarget } from "../../composables/useScene";

export const CANVAS_CLICK_DRAG_THRESHOLD_PX = 5;

export type PointerGestureState = {
  startX: number;
  startY: number;
  exceededDragThreshold: boolean;
};

type PointerCoordinates = Pick<MouseEvent, "clientX" | "clientY">;

export function beginPointerGesture(
  event: PointerCoordinates,
): PointerGestureState {
  return {
    startX: event.clientX,
    startY: event.clientY,
    exceededDragThreshold: false,
  };
}

export function updatePointerGesture(
  gesture: PointerGestureState | null,
  event: PointerCoordinates,
  thresholdPx = CANVAS_CLICK_DRAG_THRESHOLD_PX,
): PointerGestureState | null {
  if (!gesture || gesture.exceededDragThreshold) {
    return gesture;
  }

  const dx = event.clientX - gesture.startX;
  const dy = event.clientY - gesture.startY;

  if (Math.hypot(dx, dy) >= thresholdPx) {
    return {
      ...gesture,
      exceededDragThreshold: true,
    };
  }

  return gesture;
}

export function wasPointerDrag(gesture: PointerGestureState | null): boolean {
  return gesture?.exceededDragThreshold ?? false;
}

export function shouldDeselectFromCanvasClick(options: {
  gesture: PointerGestureState | null;
  clickTarget: SceneClickTarget;
  isMultiSelect: boolean;
}): boolean {
  if (options.isMultiSelect || wasPointerDrag(options.gesture)) {
    return false;
  }

  return (
    options.clickTarget.type === "floor" ||
    options.clickTarget.type === "background"
  );
}
