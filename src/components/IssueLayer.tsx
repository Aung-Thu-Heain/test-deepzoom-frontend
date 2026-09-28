import { Circle, Group, Text } from 'react-konva';
import type OpenSeadragon from 'openseadragon';
import type { Issue, IssueStatus } from '../types/issue';
import { normalizedToScreen } from '../utils/coordinates';

const PIN_COLORS: Record<IssueStatus, string> = {
  open: '#e5484d',
  in_progress: '#fb8c00',
  resolved: '#46a758',
};

interface Props {
  viewer: OpenSeadragon.Viewer;
  issues: Issue[];
  selectedId: number | null;
}

/**
 * Issue pins are drawn at the normalized position via the live viewport
 * conversion, so they stay attached to the drawing while panning / zooming.
 * The pin itself keeps a fixed SCREEN size so it stays readable.
 */
export function IssueLayer({ viewer, issues, selectedId }: Props) {
  return (
    <>
      {issues.map((issue) => {
        const p = normalizedToScreen(viewer, issue.x, issue.y);
        const selected = selectedId === issue.id;
        const color = PIN_COLORS[issue.status] ?? '#e5484d';
        return (
          <Group key={issue.id} x={p.x} y={p.y}>
            {selected && <Circle x={0} y={0} radius={17} fill="rgba(47,129,247,0.25)" />}
            <Circle x={0} y={0} radius={selected ? 13 : 10} fill={color} stroke="#ffffff" strokeWidth={2} />
            <Text
              x={-6}
              y={-5}
              width={12}
              align="center"
              text={String(issue.id)}
              fontSize={10}
              fontStyle="bold"
              fill="#ffffff"
            />
          </Group>
        );
      })}
    </>
  );
}