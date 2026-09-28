interface Props {
  pageCount: number;
  current: number;
  onChange: (pageNumber: number) => void;
}

export function PageSelector({ pageCount, current, onChange }: Props) {
  return (
    <span className="page-selector" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--muted)' }}>Page:</span>
      <button disabled={current <= 1} onClick={() => onChange(current - 1)}>
        ‹
      </button>
      <b>
        {current} / {pageCount}
      </b>
      <button disabled={current >= pageCount} onClick={() => onChange(current + 1)}>
        ›
      </button>
    </span>
  );
}