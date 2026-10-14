// Vercel serverless function: POST /api/register
// Validates a session registration and, when FORM_WEBHOOK is set, forwards it (e.g. to a form
// service, Zapier/Make hook or CRM). Every submission is also written to the function log.
//
// Note: Vercel's filesystem is read-only at runtime, so unlike dev_server.py this cannot append
// to data/submissions.json. Use FORM_WEBHOOK (or a database) to keep submissions.

const PASSES = ['single', '5-pack', '10-pack', 'membership'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(b) {
  const errors = {};
  const str = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!str(b.athlete, 120)) errors.athlete = 'Athlete name is required.';
  if (!str(b.level, 60)) errors.level = 'Age group is required.';
  if (!str(b.email, 200) || !EMAIL.test(b.email.trim())) errors.email = 'A valid parent email is required.';
  if (!str(b.phone, 40) || b.phone.replace(/\D/g, '').length < 7) errors.phone = 'A valid phone number is required.';
  if (!PASSES.includes(b.pass)) errors.pass = 'Choose a pass type.';
  if (b.notes != null && (typeof b.notes !== 'string' || b.notes.length > 2000)) errors.notes = 'Notes are too long.';
  return errors;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Body must be JSON' }); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: 'Body must be a JSON object' });
  }

  const errors = validate(body);
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, errors });

  const submission = { type: 'register', receivedAt: new Date().toISOString(), ...body };
  console.log('[register]', JSON.stringify(submission));

  if (process.env.FORM_WEBHOOK) {
    try {
      const r = await fetch(process.env.FORM_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!r.ok) console.error('[register] webhook responded', r.status);
    } catch (err) {
      console.error('[register] webhook failed', err);
    }
  }

  return res.status(200).json({ ok: true });
}
