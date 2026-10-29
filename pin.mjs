// /api/pin?url=<google maps link> -> { lat, lng }. Follows short maps.app.goo.gl links server-side.
const ALLOWED = /^(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)$/i;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function extract(s) {
  if (!s) return null;
  try { s = decodeURIComponent(s); } catch {}
  const pats = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|daddr|destination)=(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/,
    /\/(?:search|place|dir)\/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/,
  ];
  for (const p of pats) { const m = s.match(p); if (m) return { lat: +m[1], lng: +m[2] }; }
  return null;
}

export default async (req) => {
  try {
    const raw = new URL(req.url).searchParams.get("url") || "";
    const m = raw.match(/https?:\/\/\S+/);
    if (!m) return json({ error: "That doesn't look like a link" }, 400);
    let u = new URL(m[0]);
    if (!ALLOWED.test(u.hostname)) return json({ error: "Paste a Google Maps link" }, 400);
    let hit = extract(u.href);
    for (let i = 0; i < 5 && !hit; i++) {
      const r = await fetch(u.href, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } });
      const loc = r.headers.get("location");
      if (loc) { u = new URL(loc, u); if (!ALLOWED.test(u.hostname)) break; hit = extract(u.href); }
      else { hit = extract(await r.text()); break; }
    }
    return hit ? json(hit) : json({ error: "Couldn't read a location from that pin. Tap Enter Location instead." }, 422);
  } catch {
    return json({ error: "Couldn't open that link" }, 500);
  }
};

export const config = { path: "/api/pin" };
