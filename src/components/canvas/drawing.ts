import { SpaceColors } from '@/constants/theme';

/** Pen colours that read well on both the light and the dark canvas. */
export const DrawColors = SpaceColors.slice(0, 5);
export const DrawStrokeWidth = 4;

/** A finished stroke, ready to be saved as a drawing item. */
export type Stroke = {
  /** Canvas position of the item's top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** [x0, y0, x1, y1, ...] relative to the item's top-left corner. */
  points: number[];
};

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Turns points in canvas coordinates into an item box plus points relative to
 * it. The box is padded by half the stroke width on every side so round caps
 * are not clipped. Returns null when there is nothing to draw.
 */
export function toStroke(canvasPoints: number[], strokeWidth: number): Stroke | null {
  if (canvasPoints.length < 4) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < canvasPoints.length; i += 2) {
    minX = Math.min(minX, canvasPoints[i]);
    maxX = Math.max(maxX, canvasPoints[i]);
    minY = Math.min(minY, canvasPoints[i + 1]);
    maxY = Math.max(maxY, canvasPoints[i + 1]);
  }
  const pad = strokeWidth / 2;
  const x = Math.floor(minX - pad);
  const y = Math.floor(minY - pad);
  const points: number[] = [];
  for (let i = 0; i + 1 < canvasPoints.length; i += 2) {
    points.push(round(canvasPoints[i] - x), round(canvasPoints[i + 1] - y));
  }
  // Same sizing rule as the server: furthest point plus the stroke width.
  return {
    x,
    y,
    width: Math.ceil(round(maxX - x) + strokeWidth),
    height: Math.ceil(round(maxY - y) + strokeWidth),
    points,
  };
}

/**
 * SVG path through the points. Each recorded point is a control point and the
 * curve passes through the midpoints, which smooths out finger jitter.
 */
export function pointsToPath(points: number[]): string {
  const count = Math.floor(points.length / 2);
  if (count === 0) return '';
  let d = `M${points[0]} ${points[1]}`;
  if (count === 1) return `${d}l0.01 0`;
  for (let i = 1; i < count - 1; i++) {
    const x = points[i * 2];
    const y = points[i * 2 + 1];
    const midX = round((x + points[i * 2 + 2]) / 2);
    const midY = round((y + points[i * 2 + 3]) / 2);
    d += `Q${x} ${y} ${midX} ${midY}`;
  }
  return `${d}L${points[count * 2 - 2]} ${points[count * 2 - 1]}`;
}
