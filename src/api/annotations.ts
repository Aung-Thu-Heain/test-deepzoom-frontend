import { api } from './client';
import type {
  Annotation,
  AnnotationGeometry,
  AnnotationStyle,
  AnnotationType,
  AnnotationVersion,
} from '../types/annotation';

export async function listAnnotations(pageId: number): Promise<Annotation[]> {
  const { data } = await api.get<Annotation[]>(`/plan-pages/${pageId}/annotations`);
  return data;
}

export async function createAnnotation(
  pageId: number,
  type: AnnotationType,
  geometry: AnnotationGeometry,
  style: AnnotationStyle,
): Promise<Annotation> {
  const { data } = await api.post<Annotation>(`/plan-pages/${pageId}/annotations`, {
    type,
    geometry,
    style,
  });
  return data;
}

export async function updateAnnotation(
  annotationId: number,
  geometry: AnnotationGeometry,
  style: AnnotationStyle,
): Promise<Annotation> {
  const { data } = await api.patch<Annotation>(`/annotations/${annotationId}`, {
    geometry,
    style,
  });
  return data;
}

export async function getAnnotationVersions(annotationId: number): Promise<AnnotationVersion[]> {
  const { data } = await api.get<AnnotationVersion[]>(`/annotations/${annotationId}/versions`);
  return data;
}

export async function deleteAnnotation(annotationId: number): Promise<void> {
  await api.delete(`/annotations/${annotationId}`);
}