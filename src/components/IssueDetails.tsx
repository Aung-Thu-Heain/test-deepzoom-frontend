import type { Issue } from '../types/issue';

interface Props {
  issue: Issue;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function IssueDetails({ issue, onClose, onEdit, onDelete }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Issue #{issue.id}</h3>

        <p style={{ fontSize: 16, fontWeight: 600, margin: '4px 0 0' }}>{issue.title}</p>

        <div className="issue-detail-grid">
          <span className="k">Status</span>
          <span>
            <span className={`badge ${issue.status}`}>{issue.status}</span>
          </span>
          <span className="k">Priority</span>
          <span>{issue.priority}</span>
          <span className="k">Location</span>
          <span>
            ({issue.x.toFixed(3)}, {issue.y.toFixed(3)}) normalized
          </span>
          {issue.description && (
            <>
              <span className="k">Notes</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{issue.description}</span>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="danger" onClick={onDelete}>
            Delete
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>
            Close
          </button>
          <button className="primary" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}