// Proxy vers l'API Gemini : la cle reste sur le serveur (variable GEMINI_API_KEY dans Netlify),
// elle n'apparait jamais dans le code du site ni dans le navigateur des visiteurs.

const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
const MAX_TOKENS = 1200;
const MAX_BODY = 100000;

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: { code: 405, message: 'Method not allowed' } });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: { code: 500, message: 'GEMINI_API_KEY manquante sur le serveur' } });

  // Refuse les appels venant d'autres sites
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host) {
    return json(403, { error: { code: 403, message: 'Origine non autorisee' } });
  }

  const model = new URL(req.url).searchParams.get('model');
  if (!MODELS.includes(model)) return json(404, { error: { code: 404, message: 'Model not found' } });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { error: { code: 413, message: 'Requete trop longue' } });

  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: { code: 400, message: 'JSON invalide' } }); }

  const cfg = body.generationConfig || {};
  const payload = {
    systemInstruction: body.systemInstruction,
    contents: Array.isArray(body.contents) ? body.contents.slice(-10) : [],
    generationConfig: { ...cfg, maxOutputTokens: Math.min(Number(cfg.maxOutputTokens) || MAX_TOKENS, MAX_TOKENS) },
  };

  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key),
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } });
};
