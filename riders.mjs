// /api/riders  GET: everyone · POST: add/update yourself · DELETE ?id&key: remove yourself
import { getStore } from "@netlify/blobs";

const ROLES = ["give", "need", "sorted"];
const clean = (s, n) => String(s ?? "").replace(/[<>]/g, "").trim().slice(0, n);
const round = (x) => Math.round(Number(x) * 1000) / 1000; // ~100 m, never an exact doorstep
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  const store = getStore({ name: "riders", consistency: "strong" });
  try {
    if (req.method === "GET") {
      const { blobs } = await store.list();
      const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
      return json(all.filter(Boolean).map(({ key, ...pub }) => pub));
    }

    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const id = clean(b.id, 60), key = clean(b.key, 60);
      if (!/^[\w-]{8,60}$/.test(id) || !key) return json({ error: "Missing id" }, 400);
      const name = clean(b.name, 40);
      if (!name) return json({ error: "Name missing" }, 400);
      const lat = round(b.lat), lng = round(b.lng);
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
        return json({ error: "Location missing" }, 400);

      const prev = await store.get(id, { type: "json" });
      if (prev && prev.key !== key) return json({ error: "Not yours" }, 403);

      const role = ROLES.includes(b.role) ? b.role : "sorted";
      const rec = {
        id, key, name, area: clean(b.area, 60), lat, lng, role,
        seats: role === "give" ? Math.max(1, Math.min(7, parseInt(b.seats) || 1)) : 0,
        phone: clean(b.phone, 20).replace(/[^\d+]/g, ""),
        updated: Date.now(),
      };
      await store.setJSON(id, rec);
      const { key: _k, ...pub } = rec;
      return json(pub);
    }

    if (req.method === "DELETE") {
      const u = new URL(req.url);
      const id = u.searchParams.get("id"), key = u.searchParams.get("key");
      const prev = id && (await store.get(id, { type: "json" }));
      if (prev && prev.key !== key) return json({ error: "Not yours" }, 403);
      if (id) await store.delete(id);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch {
    return json({ error: "Server error" }, 500);
  }
};

export const config = { path: "/api/riders" };
