import { useRef, useState } from 'react';
import { completeUpload, getUploadUrl } from '../api/plans';
import type { Plan } from '../types/plan';

interface Props {
  onUploaded: (plan: Plan) => void;
  onOpen: (planId: number) => Promise<void>;
}

export function PdfUploader({ onUploaded, onOpen }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function planName(filename: string): string {
    const base = filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();
    return base.length > 0 ? base : filename;
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // 1. Laravel issues a presigned S3 PUT URL
      const { uploadUrl, s3Key } = await getUploadUrl(file.name);

      // 2. React PUTs the PDF directly to S3 (never through Laravel)
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!res.ok) throw new Error(`Direct S3 upload failed: ${res.status} ${res.statusText}`);

      // 3. Notify Laravel, which creates the plan + queues processing
      const plan = await completeUpload(planName(file.name), s3Key);
      onUploaded(plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function openPlan() {
    const id = Number(openId);
    if (!Number.isInteger(id) || id < 1) return;
    await onOpen(id);
  }

  return (
    <div className="card">
      <h2>Upload a construction PDF</h2>
      <p className="sub">
        Proof of concept. The PDF goes straight to S3, then Laravel processes it in the background with
        Poppler and libvips.
      </p>

      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped && dropped.type === 'application/pdf') setFile(dropped);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p>{file ? file.name : 'Click or drop a PDF here'}</p>
        {!file && <p style={{ color: 'var(--muted)', fontSize: 12 }}>.pdf only</p>}
      </div>

      {file && (
        <div className="file-chip">
          <span>{file.name}</span>
          <button onClick={() => setFile(null)} disabled={busy}>
            Remove
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <button className="primary" onClick={upload} disabled={!file || busy} style={{ width: '100%' }}>
        {busy ? 'Uploading…' : 'Upload to S3 & process'}
      </button>

      <div className="open-existing">
        <input
          type="number"
          min={1}
          placeholder="Plan ID…"
          value={openId}
          onChange={(e) => setOpenId(e.target.value)}
        />
        <button onClick={openPlan} disabled={!openId}>
          Open plan
        </button>
      </div>
    </div>
  );
}