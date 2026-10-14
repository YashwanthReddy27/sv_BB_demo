// Vercel serverless function: POST /api/contact
// Validates the contact form, forwards it to FORM_WEBHOOK (if set), logs it, and returns { ok: true }.
const INTERESTS = ['Small Group', 'Private', 'Team', 'Academy', 'Camps', ''];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Invalid JSON' }); }
  }
  body = body || {};
  const clean = (v, max) => String(v ?? '').trim().slice(0, max);
  const data = {
    name: clean(body.name, 120),
    email: clean(body.email, 200),
    phone: clean(body.phone, 40),
    interest: clean(body.interest, 40),
    message: clean(body.message, 4000),
  };
  const errors = {};
  if (!data.name) errors.name = 'Name is required';
  if (!EMAIL.test(data.email)) errors.email = 'A valid email is required';
  if (!INTERESTS.includes(data.interest)) errors.interest = 'Unknown interest';
  if (!data.message) errors.message = 'Message is required';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  const entry = { ...data, receivedAt: new Date().toISOString() };
  console.log('contact form', JSON.stringify(entry));

  if (process.env.FORM_WEBHOOK) {
    try {
      const r = await fetch(process.env.FORM_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
      });
      if (!r.ok) console.error('contact webhook failed', r.status);
    } catch (e) {
      console.error('contact webhook error', e);
    }
  }
  return res.status(200).json({ ok: true });
}
