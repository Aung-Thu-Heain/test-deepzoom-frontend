export type ToolMode = 'select' | 'rectangle' | 'arrow' | 'freehand' | 'text' | 'issue';

const MODES: Array<{ id: ToolMode; label: string }> = [
  { id: 'select', label: 'Select' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'freehand', label: 'Freehand' },
  { id: 'text', label: 'Text' },
  { id: 'issue', label: 'Issue' },
];

interface Props {
  mode: ToolMode;
  onChange: (mode: ToolMode) => void;
}

export function AnnotationToolbar({ mode, onChange }: Props) {
  return (
    <div className="toolbar">
      {MODES.map((m) => (
        <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => onChange(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  );
}