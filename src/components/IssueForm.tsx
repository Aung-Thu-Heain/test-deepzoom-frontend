import { useState } from 'react';
import { createIssue, updateIssue } from '../api/issues';
import type { Issue, IssueInput, IssuePriority, IssueStatus } from '../types/issue';

interface Props {
  pageId: number;
  /** create mode: normalized position where the pin goes */
  position?: { x: number; y: number };
  /** edit mode: the existing issue */
  initial?: Issue;
  onClose: () => void;
  onSaved: (issue: Issue) => void;
}

const STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved'];
const PRIORITIES: IssuePriority[] = ['low', 'medium', 'high'];

export function IssueForm({ pageId, position, initial, onClose, onSaved }: Props) {
  const editing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<IssueStatus>(initial?.status ?? 'open');
  const [priority, setPriority] = useState<IssuePriority>(initial?.priority ?? 'medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input: IssueInput = {
        title: title.trim(),
        description: description.trim() || '',
        status,
        priority,
        x: position ? position.x : (initial!.x as number),
        y: position ? position.y : (initial!.y as number),
      };
      const saved = initial ? await updateIssue(initial.id, input) : await createIssue(pageId, input);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save issue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? `Edit Issue #${initial!.id}` : 'Create Issue'}</h3>

        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Missing electrical outlet" />

        <label>Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes…"
        />

        <div className="row">
          <div>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as IssuePriority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}