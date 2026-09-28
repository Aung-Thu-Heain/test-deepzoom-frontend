import { api } from './client';
import type { Issue, IssueInput } from '../types/issue';

export async function listIssues(pageId: number): Promise<Issue[]> {
  const { data } = await api.get<Issue[]>(`/plan-pages/${pageId}/issues`);
  return data;
}

export async function createIssue(pageId: number, input: IssueInput): Promise<Issue> {
  const { data } = await api.post<Issue>(`/plan-pages/${pageId}/issues`, input);
  return data;
}

export async function getIssue(issueId: number): Promise<Issue> {
  const { data } = await api.get<Issue>(`/issues/${issueId}`);
  return data;
}

export async function updateIssue(issueId: number, input: Partial<IssueInput>): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${issueId}`, input);
  return data;
}

export async function deleteIssue(issueId: number): Promise<void> {
  await api.delete(`/issues/${issueId}`);
}