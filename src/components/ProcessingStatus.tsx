import { useEffect, useRef, useState } from 'react';
import { getPlan } from '../api/plans';
import type { Plan } from '../types/plan';

interface Props {
  planId: number;
  onStatus: (plan: Plan) => void;
}

/**
 * Polls GET /api/plans/{id} every 2 seconds while the job is processing.
 * No WebSockets - simple polling only.
 */
export function ProcessingStatus({ planId, onStatus }: Props) {
  const [message, setMessage] = useState('Queued… starting PDF processing');
  const [failed, setFailed] = useState(false);
  const stoppedRef = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    let cancelled = false;
    stoppedRef.current = false;

    const tick = async () => {
      if (cancelled || stoppedRef.current) return;
      try {
        const plan = await getPlan(planId);
        if (cancelled || stoppedRef.current) return;

        if (plan.status === 'processing') {
          setMessage('PDF → S3 → Poppler → libvips → Deep Zoom tiles…');
        } else if (plan.status === 'failed') {
          setMessage('Processing failed.');
          setFailed(true);
          stoppedRef.current = true;
          onStatusRef.current(plan);
        } else {
          setMessage(`Ready — ${plan.pageCount ?? 0} page(s).`);
          stoppedRef.current = true;
          onStatusRef.current(plan);
        }
      } catch {
        // transient network error; the interval keeps polling
      }
    };

    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [planId]);

  return (
    <div className="card">
      <div className="status-wrap">
        {failed ? (
          <div style={{ fontSize: 28 }}>⚠️</div>
        ) : (
          <div className="spinner" />
        )}
        <h2>{failed ? 'Processing failed.' : 'Processing your plan…'}</h2>
        <p className="sub">{message}</p>
        {failed && (
          <p className="sub">
            Check <code>backend/storage/logs/laravel.log</code> for the full error. You can upload again.
          </p>
        )}
      </div>
    </div>
  );
}