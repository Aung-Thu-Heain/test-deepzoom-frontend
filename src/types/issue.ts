export type IssueStatus = 'open' | 'in_progress' | 'resolved';
export type IssuePriority = 'low' | 'medium' | 'high';

export interface Issue {
  id: number;
  planPageId: number;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  /** normalized 0.0 - 1.0 */
  x: number;
  /** normalized 0.0 - 1.0 */
  y: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueInput {
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  x: number;
  y: number;
}