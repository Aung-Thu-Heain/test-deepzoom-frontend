import { Arrow, Line, Rect, Text } from 'react-konva';
import type OpenSeadragon from 'openseadragon';
import type { Annotation, AnnotationGeometry, AnnotationStyle, AnnotationType } from '../types/annotation';
import {
  imageScale,
  normalizedRectToScreenRect,
  normalizedToScreen,
  type Point2D,
  type Rect as Rect2D,
} from '../utils/coordinates';

export type Draft =
  | {
      kind: 'draw';
      type: AnnotationType;
      start: Point2D;
      end: Point2D;
      points: Point2D[];
      style: AnnotationStyle;
    }
  | {
      kind: 'edit';
      annotationId: number;
      type: AnnotationType;
      geometry: AnnotationGeometry;
      style: AnnotationStyle;
    };

export interface AnnotationLayerProps {
  viewer: OpenSeadragon.Viewer;
  annotations: Annotation[];
  draft: Draft | null;
  selectedId: number | null;
}

interface RenderShapeArgs {
  viewer: OpenSeadragon.Viewer;
  type: AnnotationType;
  geometry: AnnotationGeometry;
  style: AnnotationStyle;
  scale: number;
  selected?: boolean;
}

const getRect = (geometry: AnnotationGeometry): Rect2D =>
  geometry as { x: number; y: number; width: number; height: number };

const getArrow = (geometry: AnnotationGeometry): { x1: number; y1: number; x2: number; y2: number } =>
  geometry as { x1: number; y1: number; x2: number; y2: number };

const getPoints = (geometry: AnnotationGeometry): Array<[number, number]> =>
  (geometry as { points: Array<[number, number]> }).points ?? [];

/**
 * Renders every shape in SCREEN space, derived from the live OpenSeadragon
 * viewport each frame. All stored geometry stays normalized.
 */
export function AnnotationLayer({ viewer, annotations, draft, selectedId }: AnnotationLayerProps) {
  const scale = imageScale(viewer);

  const shapes = annotations
    .filter((a) => !(draft?.kind === 'edit' && draft.annotationId === a.id))
    .map((a) => (
      <RenderShape
        key={a.id}
        viewer={viewer}
        type={a.type}
        geometry={a.geometry}
        style={a.style}
        scale={scale}
        selected={selectedId === a.id}
      />
    ));

  if (draft) {
    if (draft.kind === 'edit') {
      shapes.push(
        <RenderShape
          key="draft-edit"
          viewer={viewer}
          type={draft.type}
          geometry={draft.geometry}
          style={{ ...draft.style, dash: [6, 4] }}
          scale={scale}
          selected
        />,
      );
    } else {
      const type = draft.type;
      const geometry: AnnotationGeometry =
        type === 'rectangle'
          ? {
              x: Math.min(draft.start.x, draft.end.x),
              y: Math.min(draft.start.y, draft.end.y),
              width: Math.abs(draft.end.x - draft.start.x),
              height: Math.abs(draft.end.y - draft.start.y),
            }
          : type === 'arrow'
            ? { x1: draft.start.x, y1: draft.start.y, x2: draft.end.x, y2: draft.end.y }
            : { points: draft.points.map((p) => [p.x, p.y]) };
      shapes.push(
        <RenderShape
          key="draft-draw"
          viewer={viewer}
          type={type}
          geometry={geometry}
          style={{ ...draft.style, dash: [6, 4] }}
          scale={scale}
        />,
      );
    }
  }

  return <>{shapes}</>;
}

function RenderShape({ viewer, type, geometry, style, scale, selected }: RenderShapeArgs) {
  const stroke = (style.stroke as string) ?? '#e53935';
  const strokeWidth = (((style.strokeWidth as number) ?? 3) * scale) as number;
  const dash = (style.dash as number[] | undefined) ?? undefined;

  let node: React.ReactNode = null;

  if (type === 'rectangle' || type === 'text') {
    const r = normalizedRectToScreenRect(viewer, getRect(geometry));
    if (type === 'text') {
      const fontSize = (((style.fontSize as number) ?? 40) * scale) as number;
      node = (
        <>
          <Rect
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            fill={(style.fill as string) ?? 'rgba(255,255,255,0.55)'}
            stroke={stroke}
            strokeWidth={strokeWidth}
            dash={dash}
          />
          <Text
            x={r.x}
            y={r.y}
            text={(style.text as string) ?? ''}
            fontSize={fontSize}
            fill={(style.fill as string) ?? '#1a1a1a'}
            fontFamily={(style.fontFamily as string) ?? 'sans-serif'}
          />
        </>
      );
    } else {
      node = (
        <Rect x={r.x} y={r.y} width={r.width} height={r.height} stroke={stroke} strokeWidth={strokeWidth} dash={dash} />
      );
    }
  } else if (type === 'arrow') {
    const a = getArrow(geometry);
    const p1 = normalizedToScreen(viewer, a.x1, a.y1);
    const p2 = normalizedToScreen(viewer, a.x2, a.y2);
    node = (
      <Arrow
        points={[p1.x, p1.y, p2.x, p2.y]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        pointerLength={20 * scale}
        pointerWidth={12 * scale}
      />
    );
  } else {
    // freehand
    const pts = getPoints(geometry).flatMap(([x, y]) => {
      const p = normalizedToScreen(viewer, x, y);
      return [p.x, p.y];
    });
    node = (
      <Line
        points={pts}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        lineCap="round"
        lineJoin="round"
      />
    );
  }

  return (
    <>
      {node}
      {selected && <SelectionBox viewer={viewer} type={type} geometry={geometry} />}
    </>
  );
}

function SelectionBox({ viewer, type, geometry }: { viewer: OpenSeadragon.Viewer; type: AnnotationType; geometry: AnnotationGeometry }) {
  const r = boundsOf(viewer, type, geometry);
  if (!r) return null;
  return (
    <Rect
      x={r.x - 4}
      y={r.y - 4}
      width={r.width + 8}
      height={r.height + 8}
      stroke="#2f81f7"
      strokeWidth={1.5}
      dash={[5, 4]}
      listening={false}
    />
  );
}

function boundsOf(viewer: OpenSeadragon.Viewer, type: AnnotationType, geometry: AnnotationGeometry): Rect2D | null {
  if (type === 'rectangle' || type === 'text') return normalizedRectToScreenRect(viewer, getRect(geometry));
  if (type === 'arrow') {
    const a = getArrow(geometry);
    const p1 = normalizedToScreen(viewer, a.x1, a.y1);
    const p2 = normalizedToScreen(viewer, a.x2, a.y2);
    return {
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      width: Math.abs(p2.x - p1.x),
      height: Math.abs(p2.y - p1.y),
    };
  }
  const pts = getPoints(geometry);
  if (pts.length === 0) return null;
  const screen = pts.map(([x, y]) => normalizedToScreen(viewer, x, y));
  const xs = screen.map((p) => p.x);
  const ys = screen.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}