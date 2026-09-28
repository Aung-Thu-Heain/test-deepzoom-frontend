import { api } from './client';
import type { Plan } from '../types/plan';

export interface UploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
}

export async function getUploadUrl(filename: string): Promise<UploadUrlResponse> {
  const { data } = await api.post<UploadUrlResponse>('/plans/upload-url', { filename });
  return data;
}

export async function completeUpload(name: string, s3Key: string): Promise<Plan> {
  const { data } = await api.post<Plan>('/plans/upload-complete', { name, s3Key });
  return data;
}

export async function getPlan(planId: number): Promise<Plan> {
  const { data } = await api.get<Plan>(`/plans/${planId}`);
  return data;
}