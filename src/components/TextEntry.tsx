import { useState } from 'react';
import type { Point2D } from '../utils/coordinates';

interface Props {
  /** screen position for the popover */
  pos: Point2D;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function TextEntry({ pos, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState('');

  return (
    <div className="text-entry" style={{ left: pos.x, top: pos.y }}>
      <input
        autoFocus
        value={value}
        placeholder="Annotation text…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onSubmit(value.trim());
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()}>
        OK
      </button>
    </div>
  );
}