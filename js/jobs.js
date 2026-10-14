// Analysis job client. Live mode talks to the analysis API:
//   POST {apiBase}/api/analyze        -> { job_id }
//   GET  {apiBase}/api/jobs/{job_id}  -> { status: 'queued'|'running'|'done'|'error', step: 0..4, report_id }
// In demo mode (config.apiMode === 'demo') the same contract is mocked in the browser, because the
// model is not hosted: steps advance every ~1.1s and the report is one of the existing analysed clips.
import { getJSON } from './site.js';

export const STEPS = ['Uploaded', 'Detecting players', 'Tracking ball', 'Measuring mechanics', 'Building report'];
const STEP_MS = 1100;
const POLL_MS = 1500;
const mock = new Map();

async function cfg() {
  const c = await getJSON('config');
  return { demo: c.apiMode === 'demo', base: (c.apiBase || '').replace(/\/$/, '') };
}

// source: a File, or a demo session id string ('s1' | 's2' | 'f1').
export async function createJob(source, meta = {}) {
  const { demo, base } = await cfg();
  if (demo) {
    const id = `demo-${Date.now().toString(36)}`;
    mock.set(id, { t0: Date.now(), report_id: typeof source === 'string' ? source : 's2' });
    return { job_id: id };
  }
  let res;
  if (typeof source === 'string') {
    res = await fetch(`${base}/api/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo_id: source, ...meta }),
    });
  } else {
    const fd = new FormData();
    fd.append('video', source);
    Object.entries(meta).forEach(([k, v]) => fd.append(k, v ?? ''));
    res = await fetch(`${base}/api/analyze`, { method: 'POST', body: fd });
  }
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res.json();
}

export async function getJob(id) {
  const { demo, base } = await cfg();
  if (demo) {
    const j = mock.get(id);
    if (!j) return { status: 'error', step: 0, error: 'Unknown job' };
    const step = Math.min(STEPS.length - 1, Math.floor((Date.now() - j.t0) / STEP_MS));
    const finished = Date.now() - j.t0 >= STEP_MS * STEPS.length;
    return { status: finished ? 'done' : step === 0 ? 'queued' : 'running', step, report_id: finished ? j.report_id : null };
  }
  const res = await fetch(`${base}/api/jobs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json();
}

// Calls onUpdate(job) on every change; resolves with the final job, rejects on error.
export function pollJob(id, onUpdate = () => {}) {
  return new Promise((resolve, reject) => {
    let last = '';
    const tick = async () => {
      try {
        const job = await getJob(id);
        const sig = `${job.status}:${job.step}`;
        if (sig !== last) { last = sig; onUpdate(job); }
        if (job.status === 'done') return resolve(job);
        if (job.status === 'error') return reject(new Error(job.error || 'Analysis failed'));
        const { demo } = await cfg();
        setTimeout(tick, demo ? 250 : POLL_MS);
      } catch (e) { reject(e); }
    };
    tick();
  });
}
