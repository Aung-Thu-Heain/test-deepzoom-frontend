import { useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';
import { Layer, Stage } from 'react-konva';
import type { Plan, PlanPage } from '../types/plan';
import type { Annotation, AnnotationGeometry, AnnotationStyle, AnnotationType } from '../types/annotation';
import type { Issue } from '../types/issue';
import { createAnnotation, deleteAnnotation, getAnnotationVersions, listAnnotations, updateAnnotation } from '../api/annotations';
import { createIssue, deleteIssue, listIssues } from '../api/issues';
import { errorMessage } from '../api/client';
import {
  clamp01,
  distanceToRectEdge,
  distanceToSegment,
  normalizedRectToScreenRect,
  normalizedToScreen,
  pointInRect,
  screenToNormalized,
  type Point2D,
  type Rect,
} from '../utils/coordinates';
import { PageSelector } from './PageSelector';
import { AnnotationToolbar, type ToolMode } from './AnnotationToolbar';
import { AnnotationLayer, type Draft } from './AnnotationLayer';
import { IssueLayer } from './IssueLayer';
import { IssueForm } from './IssueForm';
import { IssueDetails } from './IssueDetails';
import { TextEntry } from './TextEntry';

interface Props {
  plan: Plan;
  onBack: () => void;
}

type IssueDialog =
  | { kind: 'create'; x: number; y: number }
  | { kind: 'details'; issue: Issue }
  | { kind: 'edit'; issue: Issue }
  | null;

/** Shared shape of the OpenSeadragon canvas pointer events we consume. */
type CanvasPointerEvent =
  | OpenSeadragon.CanvasPressEvent
  | OpenSeadragon.CanvasDragEvent
  | OpenSeadragon.CanvasReleaseEvent
  | OpenSeadragon.CanvasClickEvent;

interface PressState {
  kind: 'draw';
  type: AnnotationType;
  start: Point2D;
  last: Point2D;
  lastScreen: Point2D;
  points: Point2D[];
}

interface DragEditState {
  annotation: Annotation;
  origin: AnnotationGeometry;
  anchor: Point2D;
  moved: boolean;
}

function defaultStyle(type: AnnotationType): AnnotationStyle {
  switch (type) {
    case 'rectangle':
      return { stroke: '#e53935', strokeWidth: 3 };
    case 'arrow':
      return { stroke: '#1e88e5', strokeWidth: 3 };
    case 'freehand':
      return { stroke: '#43a047', strokeWidth: 3 };
    case 'text':
      return { text: '', fontSize: 40, fill: '#1a1a1a' };
  }
}

function isPrimaryPointer(evt: CanvasPointerEvent): boolean {
  const orig = evt.originalEvent as MouseEvent | null | undefined;
  if (orig && typeof orig.button === 'number') return orig.button === 0;
  return true;
}

const HIT_TOLERANCE_PX = 12;
const ISSUE_HIT_RADIUS_PX = 16;

export function PlanViewer({ plan, onBack }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const currentPage: PlanPage | null = plan.pages[pageIndex] ?? null;

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerDivRef = useRef<HTMLDivElement>(null);
  const viewerStateRef = useRef<OpenSeadragon.Viewer | null>(null);

  const [viewer, setViewer] = useState<OpenSeadragon.Viewer | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [, setEpoch] = useState(0);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [mode, setMode] = useState<ToolMode>('select');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [versionCount, setVersionCount] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [issueDialog, setIssueDialog] = useState<IssueDialog>(null);
  const [textDraft, setTextDraft] = useState<Point2D | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Latest values for the OSD event handlers (registered once).
  const modeRef = useRef<ToolMode>(mode);
  modeRef.current = mode;
  const annotationsRef = useRef<Annotation[]>(annotations);
  annotationsRef.current = annotations;
  const issuesRef = useRef<Issue[]>(issues);
  issuesRef.current = issues;
  const currentPageRef = useRef<PlanPage | null>(currentPage);
  currentPageRef.current = currentPage;
  const pressRef = useRef<PressState | null>(null);
  const dragRef = useRef<DragEditState | null>(null);
  const draftRef = useRef<Draft | null>(draft);
  draftRef.current = draft;

  const selectedAnnotation = annotations.find((a) => a.id === selectedId) ?? null;

  // ---- create / destroy the OpenSeadragon viewer ---------------------------
  useEffect(() => {
    if (!viewerDivRef.current) return;

    const v = OpenSeadragon({
      element: viewerDivRef.current,
      showNavigationControl: false,
      maxZoomPixelRatio: 8,
      visibilityRatio: 0.5,
      minZoomImageRatio: 0.1,
    });

    setViewer(v);
    viewerStateRef.current = v;

    return () => {
      v.destroy();
      viewerStateRef.current = null;
      setViewer(null);
    };
  }, []);

  // ---- track container size (Konva stage must match the OSD viewport) ------
  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
      viewerStateRef.current?.forceResize();
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();

    return () => ro.disconnect();
  }, []);

  // ---- load a page: tiles, annotations, issues -----------------------------
  useEffect(() => {
    if (!viewer || !currentPage) return;

    setAnnotations([]);
    setIssues([]);
    setSelectedId(null);
    setDraft(null);
    setIssueDialog(null);
    setTextDraft(null);
    setError(null);

    // Only one page is loaded in the viewer at a time.
    viewer.open(currentPage.dziUrl);

    const onOpen = () => viewer.viewport.goHome(true);
    viewer.addHandler('open', onOpen);

    let cancelled = false;
    Promise.all([listAnnotations(currentPage.id), listIssues(currentPage.id)])
      .then(([ann, iss]) => {
        if (!cancelled) {
          setAnnotations(ann);
          setIssues(iss);
        }
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));

    return () => {
      cancelled = true;
      viewer.removeHandler('open', onOpen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, currentPage?.id]);

  // ---- bump the Konva redraw epoch on viewport changes ----------------------
  useEffect(() => {
    if (!viewer) return;
    const bump = () => setEpoch((e) => e + 1);
    viewer.addHandler('update-viewport', bump);
    viewer.addHandler('resize', bump);
    return () => {
      viewer.removeHandler('update-viewport', bump);
      viewer.removeHandler('resize', bump);
    };
  }, [viewer]);

  // ---- enable/disable OSD mouse navigation per tool mode --------------------
  useEffect(() => {
    if (!viewer) return;
    // Draw modes must receive every drag event themselves;
    // other modes can pan/zoom with the mouse.
    viewer.setMouseNavEnabled(mode === 'select' || mode === 'issue' || mode === 'text');
  }, [viewer, mode]);

  // ---- OpenSeadragon pointer events -> drawing / selection ------------------
  useEffect(() => {
    if (!viewer) return;

    const onPress = (evt: CanvasPointerEvent) => {
      if (!isPrimaryPointer(evt)) return;
      const s = evt.position;
      const n = screenToNormalized(viewer, s.x, s.y);
      const m = modeRef.current;

      pressRef.current = null;
      dragRef.current = null;

      if (m === 'rectangle' || m === 'arrow' || m === 'freehand') {
        pressRef.current = { kind: 'draw', type: m, start: n, last: n, lastScreen: s, points: [n] };
        setDraft({
          kind: 'draw',
          type: m,
          start: n,
          end: n,
          points: [n],
          style: defaultStyle(m),
        });
        return;
      }

      if (m === 'select') {
        // Issue pins are opened on click; don't start a drag on top of them.
        if (hitTestIssue(viewer, issuesRef.current, s.x, s.y)) return;

        const hit = hitTestAnnotation(viewer, annotationsRef.current, s.x, s.y);
        if (hit) {
          setSelectedId(hit.id);
          dragRef.current = { annotation: hit, origin: hit.geometry, anchor: n, moved: false };
          viewer.setMouseNavEnabled(false);
        } else {
          setSelectedId(null);
        }
      }
    };

    const onDrag = (evt: CanvasPointerEvent) => {
      const s = evt.position;
      const n = screenToNormalized(viewer, s.x, s.y);

      const press = pressRef.current;
      if (press && press.kind === 'draw') {
        if (press.type === 'freehand') {
          if (Math.hypot(s.x - press.lastScreen.x, s.y - press.lastScreen.y) >= 3) {
            press.points.push(n);
            press.last = n;
            press.lastScreen = s;
            setDraft({
              kind: 'draw',
              type: 'freehand',
              start: press.start,
              end: n,
              points: [...press.points],
              style: defaultStyle('freehand'),
            });
          }
        } else {
          setDraft({
            kind: 'draw',
            type: press.type,
            start: press.start,
            end: n,
            points: [press.start, n],
            style: defaultStyle(press.type),
          });
        }
        return;
      }

      const drag = dragRef.current;
      if (drag) {
        const delta = { x: n.x - drag.anchor.x, y: n.y - drag.anchor.y };
        if (Math.hypot(delta.x, delta.y) > 0.002) drag.moved = true;
        setDraft({
          kind: 'edit',
          annotationId: drag.annotation.id,
          type: drag.annotation.type,
          geometry: translateGeometry(drag.origin, delta),
          style: drag.annotation.style,
        });
        setSelectedId(drag.annotation.id);
      }
    };

    const onRelease = (evt: CanvasPointerEvent) => {
      const press = pressRef.current;

      if (press && press.kind === 'draw') {
        pressRef.current = null;
        const end = screenToNormalized(viewer, evt.position.x, evt.position.y);
        setDraft(null);

        const m = press.type;
        if (m === 'rectangle') {
          const w = Math.abs(end.x - press.start.x);
          const h = Math.abs(end.y - press.start.y);
          if (w > 0.004 && h > 0.004) {
            void saveAnnotation(m, {
              x: Math.min(press.start.x, end.x),
              y: Math.min(press.start.y, end.y),
              width: w,
              height: h,
            });
          }
        } else if (m === 'arrow') {
          if (Math.hypot(end.x - press.start.x, end.y - press.start.y) > 0.004) {
            void saveAnnotation(m, { x1: press.start.x, y1: press.start.y, x2: end.x, y2: end.y });
          }
        } else {
          const pts = press.points.length >= 2 ? press.points : [press.start, end];
          if (pts.length >= 2) {
            void saveAnnotation(m, { points: pts.map((p) => [clamp01(p.x), clamp01(p.y)]) });
          }
        }
        return;
      }

      const drag = dragRef.current;
      if (drag) {
        viewer.setMouseNavEnabled(true);
        dragRef.current = null;
        const latest = draftRef.current;
        if (drag.moved && latest && latest.kind === 'edit') {
          const a = drag.annotation;
          updateAnnotation(a.id, latest.geometry, a.style)
            .then((updated) => {
              setAnnotations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
              setDraft(null);
            })
            .catch((e) => {
              setDraft(null);
              setError(errorMessage(e));
            });
        } else {
          setDraft(null);
        }
      }
    };

    const onClick = (evt: CanvasPointerEvent) => {
      if (!isPrimaryPointer(evt)) return;
      const s = evt.position;
      const n = screenToNormalized(viewer, s.x, s.y);
      const m = modeRef.current;

      if (m === 'text') {
        setTextDraft(n);
        return;
      }
      if (m === 'issue') {
        setIssueDialog({ kind: 'create', x: clamp01(n.x), y: clamp01(n.y) });
        return;
      }
      if (m === 'select') {
        const hitIssue = hitTestIssue(viewer, issuesRef.current, s.x, s.y);
        if (hitIssue) {
          setSelectedId(null);
          setIssueDialog({ kind: 'details', issue: hitIssue });
          return;
        }
        const hit = hitTestAnnotation(viewer, annotationsRef.current, s.x, s.y);
        setSelectedId(hit ? hit.id : null);
      }
    };

    viewer.addHandler('canvas-press', onPress);
    viewer.addHandler('canvas-drag', onDrag);
    viewer.addHandler('canvas-release', onRelease);
    viewer.addHandler('canvas-click', onClick);

    return () => {
      viewer.removeHandler('canvas-press', onPress);
      viewer.removeHandler('canvas-drag', onDrag);
      viewer.removeHandler('canvas-release', onRelease);
      viewer.removeHandler('canvas-click', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  // ---- annotation helpers ----------------------------------------------------
  function hitTestIssue(v: OpenSeadragon.Viewer, list: Issue[], sx: number, sy: number): Issue | null {
    for (let i = list.length - 1; i >= 0; i--) {
      const issue = list[i];
      const p = normalizedToScreen(v, issue.x, issue.y);
      if (Math.hypot(sx - p.x, sy - p.y) <= ISSUE_HIT_RADIUS_PX) return issue;
    }
    return null;
  }

  function hitTestAnnotation(v: OpenSeadragon.Viewer, list: Annotation[], sx: number, sy: number): Annotation | null {
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      const geo = a.geometry;
      if (a.type === 'rectangle') {
        const r = normalizedRectToScreenRect(v, geo as Rect);
        if (pointInRect(sx, sy, r) || distanceToRectEdge(sx, sy, r) <= HIT_TOLERANCE_PX) return a;
      } else if (a.type === 'text') {
        const r = normalizedRectToScreenRect(v, geo as Rect);
        if (pointInRect(sx, sy, r) || distanceToRectEdge(sx, sy, r) <= HIT_TOLERANCE_PX) return a;
      } else if (a.type === 'arrow') {
        const g = geo as { x1: number; y1: number; x2: number; y2: number };
        const p1 = normalizedToScreen(v, g.x1, g.y1);
        const p2 = normalizedToScreen(v, g.x2, g.y2);
        if (distanceToSegment(sx, sy, p1.x, p1.y, p2.x, p2.y) <= HIT_TOLERANCE_PX) return a;
      } else {
        const pts = (geo as { points: Array<[number, number]> }).points ?? [];
        for (let j = 1; j < pts.length; j++) {
          const a1 = normalizedToScreen(v, pts[j - 1][0], pts[j - 1][1]);
          const a2 = normalizedToScreen(v, pts[j][0], pts[j][1]);
          if (distanceToSegment(sx, sy, a1.x, a1.y, a2.x, a2.y) <= HIT_TOLERANCE_PX) return a;
        }
      }
    }
    return null;
  }

  function translateGeometry(origin: AnnotationGeometry, delta: Point2D): AnnotationGeometry {
    if ('points' in origin) {
      return { points: origin.points.map(([x, y]) => [clamp01(x + delta.x), clamp01(y + delta.y)]) };
    }
    if ('x1' in origin) {
      return {
        x1: clamp01(origin.x1 + delta.x),
        y1: clamp01(origin.y1 + delta.y),
        x2: clamp01(origin.x2 + delta.x),
        y2: clamp01(origin.y2 + delta.y),
      };
    }
    return {
      x: clamp01(origin.x + delta.x),
      y: clamp01(origin.y + delta.y),
      width: origin.width,
      height: origin.height,
    };
  }

  async function saveAnnotation(type: AnnotationType, geometry: AnnotationGeometry) {
    const page = currentPageRef.current;
    if (!page) return;
    try {
      const created = await createAnnotation(page.id, type, geometry, defaultStyle(type));
      setAnnotations((prev) => [...prev, created]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // ---- selection metadata (version history) ---------------------------------
  useEffect(() => {
    if (!selectedId) {
      setVersionCount(0);
      return;
    }
    getAnnotationVersions(selectedId)
      .then((versions) => setVersionCount(versions.length))
      .catch(() => setVersionCount(0));
  }, [selectedId]);

  async function deleteSelected() {
    if (!selectedId) return;
    try {
      await deleteAnnotation(selectedId);
      setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
      setSelectedId(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // ---- issue operations ------------------------------------------------------
  async function handleIssueCreated(issue: Issue) {
    setIssues((prev) => [...prev, issue]);
    setIssueDialog(null);
    setMode('select');
  }

  async function handleIssueUpdated(issue: Issue) {
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? issue : i)));
    setIssueDialog(null);
  }

  async function handleIssueDeleted(id: number) {
    try {
      await deleteIssue(id);
      setIssues((prev) => prev.filter((i) => i.id !== id));
      setIssueDialog(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // ---- text annotation -------------------------------------------------------
  async function handleTextSubmit(text: string) {
    if (!textDraft || !currentPage) return;
    const fontSize = 40;
    const geo = {
      x: textDraft.x,
      y: textDraft.y,
      width: (fontSize * text.length * 0.55) / currentPage.width,
      height: (fontSize * 1.3) / currentPage.height,
    };
    setTextDraft(null);
    const style = { text, fontSize, fill: '#1a1a1a' } as AnnotationStyle;
    try {
      const created = await createAnnotation(currentPage.id, 'text', geo, style);
      setAnnotations((prev) => [...prev, created]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const modeHints: Record<ToolMode, string> = {
    select: 'Pan: drag. Click an annotation to select / drag it to edit. Click a pin for issue details.',
    rectangle: 'Drag on the drawing to draw a rectangle.',
    arrow: 'Drag from start to end to draw an arrow.',
    freehand: 'Drag to draw a freehand line.',
    text: 'Click the drawing to place a text annotation.',
    issue: 'Click the drawing to create an issue.',
  };

  const createDialog = issueDialog?.kind === 'create' ? issueDialog : null;
  const detailsDialog = issueDialog?.kind === 'details' ? issueDialog : null;
  const editDialog = issueDialog?.kind === 'edit' ? issueDialog : null;

  return (
    <div className="plan-viewer">
      <div className="viewer-topbar">
        <button onClick={onBack}>← Plans</button>
        <span className="plan-name">{plan.name}</span>
        {currentPage && (
          <PageSelector
            pageCount={plan.pages.length}
            current={pageIndex + 1}
            onChange={(n) => setPageIndex(n - 1)}
          />
        )}
        <span className="spacer" />
        {selectedAnnotation && (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {selectedAnnotation.type} · v{versionCount}
          </span>
        )}
      </div>

      <AnnotationToolbar mode={mode} onChange={setMode} />

      {selectedAnnotation && (
        <div className="selection-bar">
          <span>
            Selected {selectedAnnotation.type} — current version {selectedAnnotation.currentVersion}
            {versionCount > 1 ? ` (${versionCount} versions in history)` : ''}
          </span>
          <span style={{ flex: 1 }} />
          <button className="danger" onClick={deleteSelected}>
            Delete annotation
          </button>
        </div>
      )}

      {error && <div className="error" style={{ margin: 8 }}>{error}</div>}

      <div className="viewer-wrapper" ref={containerRef}>
        <div className="openseadragon-viewer" ref={viewerDivRef} />

        {viewer && currentPage && size.width > 0 && (
          <Stage
            width={size.width}
            height={size.height}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2 }}
          >
            <Layer listening={false}>
              <AnnotationLayer
                viewer={viewer}
                annotations={annotations}
                draft={draft}
                selectedId={selectedId}
              />
            </Layer>
            <Layer listening={false}>
              <IssueLayer viewer={viewer} issues={issues} selectedId={selectedId} />
            </Layer>
          </Stage>
        )}

        {viewer && textDraft && (
          <TextEntry
            pos={normalizedToScreen(viewer, textDraft.x, textDraft.y)}
            onSubmit={handleTextSubmit}
            onCancel={() => setTextDraft(null)}
          />
        )}

        <div className="viewer-hint">{modeHints[mode]}</div>
      </div>

      {createDialog && currentPage && (
        <IssueForm
          pageId={currentPage.id}
          position={{ x: createDialog.x, y: createDialog.y }}
          onClose={() => setIssueDialog(null)}
          onSaved={handleIssueCreated}
        />
      )}
      {detailsDialog && (
        <IssueDetails
          issue={detailsDialog.issue}
          onClose={() => setIssueDialog(null)}
          onEdit={() => setIssueDialog({ kind: 'edit', issue: detailsDialog.issue })}
          onDelete={() => handleIssueDeleted(detailsDialog.issue.id)}
        />
      )}
      {editDialog && currentPage && (
        <IssueForm
          pageId={currentPage.id}
          initial={editDialog.issue}
          onClose={() => setIssueDialog(null)}
          onSaved={handleIssueUpdated}
        />
      )}
    </div>
  );
}