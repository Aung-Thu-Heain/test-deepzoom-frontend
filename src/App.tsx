import { useState } from 'react';
import { getPlan } from './api/plans';
import type { Plan } from './types/plan';
import { PdfUploader } from './components/PdfUploader';
import { ProcessingStatus } from './components/ProcessingStatus';
import { PlanViewer } from './components/PlanViewer';

type Phase = 'idle' | 'processing' | 'ready' | 'failed';

export default function App() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  const handleUploaded = (p: Plan) => {
    setPlan(p);
    setPhase('processing');
  };

  const handleStatus = (p: Plan) => {
    setPlan(p);
    if (p.status === 'ready') setPhase('ready');
    else if (p.status === 'failed') setPhase('failed');
    else setPhase('processing');
  };

  const handleOpen = async (planId: number) => {
    try {
      const p = await getPlan(planId);
      setPlan(p);
      handleStatus(p);
    } catch (e) {
      alert(`Could not open plan ${planId}: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fieldwire-style drawing PoC</h1>
        <span className="tag">demo only</span>
      </header>

      <div className="app-body">
        {phase === 'idle' && <PdfUploader onUploaded={handleUploaded} onOpen={handleOpen} />}

        {(phase === 'processing' || phase === 'failed') && plan && (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 560 }}>
              {phase === 'failed' ? (
                <div className="card">
                  <h2>Processing failed.</h2>
                  <p className="sub">
                    Check <code>backend/storage/logs/laravel.log</code> for the detailed error.
                  </p>
                  <button className="primary" onClick={() => setPhase('idle')}>
                    ← Back to upload
                  </button>
                </div>
              ) : (
                <ProcessingStatus planId={plan.id} onStatus={handleStatus} />
              )}
            </div>
          </div>
        )}

        {phase === 'ready' && plan && <PlanViewer plan={plan} onBack={() => setPhase('idle')} />}
      </div>
    </div>
  );
}