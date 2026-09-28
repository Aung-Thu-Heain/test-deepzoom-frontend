export type AnnotationType = 'rectangle' | 'arrow' | 'freehand' | 'text';

/**
 * All coordinates are NORMALIZED (0.0 - 1.0) relative to the full-resolution
 * rendered page image. Screen coordinates are never stored.
 */
export type AnnotationGeometry =
  | { x: number; y: number; width: number; height: number } // rectangle / text
  | { x1: number; y1: number; x2: number; y2: number } // arrow
  | { points: Array<[number, number]> }; // freehand

/**
 * Sizes (strokeWidth, fontSize) are expressed in full-resolution image pixels,
 * so they scale correctly while the user zooms.
 */
export interface AnnotationStyle {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  [key: string]: unknown;
}

export interface Annotation {
  id: number;
  planPageId: number;
  type: AnnotationType;
  currentVersion: number;
  geometry: AnnotationGeometry;
  style: AnnotationStyle;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnotationVersion {
  id: number;
  annotationId: number;
  version: number;
  geometry: AnnotationGeometry;
  style: AnnotationStyle;
  createdAt?: string;
}