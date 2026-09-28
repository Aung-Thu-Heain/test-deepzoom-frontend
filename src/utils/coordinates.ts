import OpenSeadragon from 'openseadragon';

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Coordinate conversion helpers.
 *
 * IMPORTANT: only normalized coordinates (0.0 - 1.0 relative to the image)
 * are ever saved to the backend. Everything else is derived per-render frame
 * from the live OpenSeadragon viewport, so overlays stay pinned during
 * pan / zoom / resize.
 */

export function imageToNormalized(imageX: number, imageY: number, imageWidth: number, imageHeight: number): Point2D {
  return {
    x: imageWidth > 0 ? imageX / imageWidth : 0,
    y: imageHeight > 0 ? imageY / imageHeight : 0,
  };
}

export function normalizedToImage(nx: number, ny: number, imageWidth: number, imageHeight: number): Point2D {
  return { x: nx * imageWidth, y: ny * imageHeight };
}

export function imageToScreen(
  viewer: OpenSeadragon.Viewer,
  imageX: number,
  imageY: number,
  imageWidth: number,
  imageHeight: number,
): Point2D {
  const n = imageToNormalized(imageX, imageY, imageWidth, imageHeight);
  return normalizedToScreen(viewer, n.x, n.y);
}

export function screenToImage(
  viewer: OpenSeadragon.Viewer,
  screenX: number,
  screenY: number,
  imageWidth: number,
  imageHeight: number,
): Point2D {
  const n = screenToNormalized(viewer, screenX, screenY);
  return normalizedToImage(n.x, n.y, imageWidth, imageHeight);
}

export function screenToNormalized(viewer: OpenSeadragon.Viewer, screenX: number, screenY: number): Point2D {
  const p = viewer.viewport.pointFromPixel(new OpenSeadragon.Point(screenX, screenY), true);
  return { x: p.x, y: p.y };
}

export function normalizedToScreen(viewer: OpenSeadragon.Viewer, nx: number, ny: number): Point2D {
  const p = viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(nx, ny), true);
  return { x: p.x, y: p.y };
}

/** Convert a normalized rectangle to a screen rectangle. */
export function normalizedRectToScreenRect(viewer: OpenSeadragon.Viewer, r: Rect): Rect {
  const a = normalizedToScreen(viewer, r.x, r.y);
  const b = normalizedToScreen(viewer, r.x + r.width, r.y + r.height);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** Convert a screen rectangle to a normalized rectangle (drag direction safe). */
export function screenRectToNormalizedRect(viewer: OpenSeadragon.Viewer, r: Rect): Rect {
  const a = screenToNormalized(viewer, r.x, r.y);
  const b = screenToNormalized(viewer, r.x + r.width, r.y + r.height);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** How many screen pixels one full-resolution image pixel currently occupies. */
export function imageScale(viewer: OpenSeadragon.Viewer): number {
  const a = viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(0, 0), true);
  const b = viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(1, 1), true);
  return (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 2;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

/** Distance from a point to the nearest EDGE of a rectangle (0 if inside). */
export function distanceToRectEdge(px: number, py: number, r: Rect): number {
  if (pointInRect(px, py, r)) return 0;
  const left = distanceToSegment(px, py, r.x, r.y, r.x, r.y + r.height);
  const right = distanceToSegment(px, py, r.x + r.width, r.y, r.x + r.width, r.y + r.height);
  const top = distanceToSegment(px, py, r.x, r.y, r.x + r.width, r.y);
  const bottom = distanceToSegment(px, py, r.x, r.y + r.height, r.x + r.width, r.y + r.height);
  return Math.min(left, right, top, bottom);
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}