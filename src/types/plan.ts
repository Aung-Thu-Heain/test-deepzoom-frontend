export type PlanStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface PlanPage {
  id: number;
  pageNumber: number;
  width: number;
  height: number;
  dziUrl: string;
  thumbnailUrl?: string | null;
}

export interface Plan {
  id: number;
  name: string;
  status: PlanStatus;
  pageCount: number | null;
  pages: PlanPage[];
}