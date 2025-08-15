const { routeOSRM } = require("../utils/osrm");
const mongoose = require("mongoose");
const Trip = require("../models/Trip");
const { groqChatJSON } = require("../utils/groq");

const fetchFn = (typeof fetch === "function")
  ? fetch
  : ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

const IS_FAST = process.env.NODE_ENV === "test" || process.env.NO_NETWORK === "1";
// ----------------- helpers -----------------
const toRad = (d) => (d * Math.PI) / 180;
function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = toRad((b[0] ?? 0) - (a[0] ?? 0));
  const dLon = toRad((b[1] ?? 0) - (a[1] ?? 0));
  const la1 = toRad(a[0] ?? 0), la2 = toRad(b[0] ?? 0);
  const sinDLat = Math.sin(dLat / 2), sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const getUserId = (req) =>
  (req.user?.id || req.user?._id || req.user?.userId || req.userId || null);

// ----- Distance policy -----
const WALK_MIN_KM = 5;
const WALK_MAX_KM = 15;
const BIKE_TARGET_DAILY_KM = 60;
const BIKE_MIN_DAILY_KM = Math.round(BIKE_TARGET_DAILY_KM * 0.75);
const BIKE_MAX_DAILY_KM = Math.round(BIKE_TARGET_DAILY_KM * 1.25);

// Outlier clamp radii around destination center
const MAX_RADIUS_KM_WALK = 12;
const MAX_RADIUS_KM_BIKE = 80;

// Map name -> coords
function mapPointsByName(arr) {
  const m = new Map();
  (Array.isArray(arr) ? arr : []).forEach(p => {
    const name = (p?.name || "").trim();
    const lat = Number(p?.lat), lon = Number(p?.lon);
    if (name && Number.isFinite(lat) && Number.isFinite(lon)) {
      m.set(name.toLowerCase(), { name, lat, lon });
    }
  });
  return m;
}

async function enforceDayDistanceBounds({ mode, days, map_points }) {
  const isWalk = String(mode).toLowerCase() === "walk";
  const bounds = isWalk ? { min: 5, max: 15 } : { min: 45, max: 75 };

  const D = Array.isArray(days) ? days.map(d => ({ ...d })) : [];

  for (const d of D) {
    const coords = [d.start, ...(d.waypoints || []), d.end]
      .map(n => (map_points || []).find(p => p.name === n))
      .filter(Boolean)
      .map(p => [p.lat, p.lon]);

    let dist = 0;
    for (let i = 1; i < coords.length; i++) {
      dist += haversineKm(coords[i - 1], coords[i]);
    }

    if (dist < bounds.min) d.distance_km = bounds.min;
    else if (dist > bounds.max) d.distance_km = bounds.max;
    else d.distance_km = dist;
  }
  return D;
}

function clampOutliers(points, centerLatLon, mode) {
  const maxKm = String(mode).toLowerCase() === "walk" ? MAX_RADIUS_KM_WALK : MAX_RADIUS_KM_BIKE;
  const A = Array.isArray(points) ? points : [];
  return A.map(p => {
    const name = (p?.name || "").trim();
    const lat = Number.isFinite(p?.lat) ? p.lat : null;
    const lon = Number.isFinite(p?.lon) ? p.lon : null;
    if (name && lat !== null && lon !== null && Array.isArray(centerLatLon)) {
      const d = haversineKm([lat, lon], centerLatLon);
      if (!Number.isFinite(d) || d > maxKm) return { name, lat: null, lon: null };
    }
    return { name, lat, lon };
  });
}

function normalizeDestination(input) {
  if (!input) return null;
  if (typeof input === "string") {
    const name = input.trim();
    return name ? { name } : null;
  }
  const name =
    (input.name && String(input.name).trim()) ||
    [input.city, input.country].filter(Boolean).join(", ").trim();
  if (!name) return null;
  const city = input.city ? String(input.city).trim() : undefined;
  const country = input.country ? String(input.country).trim() : undefined;
  const lat = Number.isFinite(input.lat) ? input.lat : undefined;
  const lon = Number.isFinite(input.lon) ? input.lon : undefined;
  return {
    name,
    ...(city && { city }),
    ...(country && { country }),
    ...(lat !== undefined && { lat }),
    ...(lon !== undefined && { lon }),
  };
}

function enforceLinearBike(plan) {
  if (String(plan?.mode).toLowerCase() !== "bike") return plan;
  const days = Array.isArray(plan?.days) ? plan.days : [];
  if (days.length < 1) return plan;

  const start = (days[0]?.start || "").trim().toLowerCase();
  const lastIdx = days.length - 1;
  const end0 = (days[lastIdx]?.end || "").trim().toLowerCase();

  if (start && end0 && start === end0) {
    const alt =
      (days[0]?.waypoints || []).slice().reverse().find(n => n && n.trim().toLowerCase() !== start) ||
      (days[0]?.overnight?.city || "").trim() ||
      (plan.map_points || []).map(p => p?.name).find(n => n && n.trim().toLowerCase() !== start);

    if (alt) {
      days[lastIdx].end = alt;
    }
  }

  if (days[0]?.overnight?.city &&
      days[0].overnight.city.trim().toLowerCase() === start) {
    const wp = (days[0]?.waypoints || []).find(n => n && n.trim().toLowerCase() !== start);
    if (wp) days[0].overnight.city = wp;
  }

  plan.days = days;
  return plan;
}

function normalizeImage(img) {
  if (!img || typeof img !== "object") return null;
  const src = typeof img.src === "string" ? img.src.trim() : "";
  if (!src) return null;
  const alt = typeof img.alt === "string" ? img.alt : null;
  const c = img.credit || null;
  const credit = c && typeof c === "object" ? {
    provider: c.provider || null,
    author: c.author || null,
    username: c.username || null,
    link: c.link || null,
    source: c.source || null,
  } : null;
  return { src, alt, credit };
}

function normalizeMapPoints(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const p of arr) {
    if (!p) continue;
    const name = (p.name || "").trim();
    if (!name) continue;
    const lat = Number.isFinite(p.lat) ? p.lat : null;
    const lon = Number.isFinite(p.lon) ? p.lon : null;
    out.push({ name, lat, lon });
  }
  return out;
}

function namesFromDays(days) {
  const names = new Set();
  const D = Array.isArray(days) ? days : [];
  for (const d of D) {
    if (d?.start) names.add(String(d.start));
    if (Array.isArray(d?.waypoints)) d.waypoints.forEach(w => w && names.add(String(w)));
    if (d?.end) names.add(String(d.end));
  }
  return names;
}

async function geocodeOnce(q, { lang = "he,en", near = null, bboxKm = 50, extraQuery = "" } = {}) {
  let url;
  if (near) {
    const delta = Math.max(0.2, Math.min(1.2, bboxKm / 111));
    const minLat = near[0] - delta, maxLat = near[0] + delta;
    const minLon = near[1] - delta, maxLon = near[1] + delta;
    const q2 = `${q}${extraQuery ? `, ${extraQuery}` : ""}`;
    url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=${encodeURIComponent(lang)}&bounded=1` +
      `&viewbox=${encodeURIComponent(`${minLon},${maxLat},${maxLon},${minLat}`)}&q=${encodeURIComponent(q2)}`;
  } else {
    url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(q + (extraQuery ? `, ${extraQuery}` : ""))}`;
  }
  const res = await fetchFn(url, { headers: { "User-Agent": "TripPlanner/1.1 (server geocode)" } });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr[0]?.lat || !arr[0]?.lon) return null;
  const lat = parseFloat(arr[0].lat), lon = parseFloat(arr[0].lon);
  if (near) {
    const dist = haversineKm([lat, lon], near);
    if (!Number.isFinite(dist) || dist > bboxKm * 2) return null;
  }
  return [lat, lon];
}

async function geocodeDestinationIfNeeded(dest) {
  if (!dest) return { dest, near: null, extra: "" };
  const extra = [dest.name, dest.city, dest.country].filter(Boolean).join(", ");
  if (Number.isFinite(dest.lat) && Number.isFinite(dest.lon)) {
    return { dest, near: [dest.lat, dest.lon], extra };
  }
  try {
    const ans = await geocodeOnce(extra || dest.name, { lang: "he,en" });
    if (ans) { dest.lat = ans[0]; dest.lon = ans[1]; return { dest, near: ans, extra }; }
  } catch {}
  return { dest, near: null, extra };
}

async function searchNearby({ near, query, limit = 5, radiusKm = 20, lang = "he,en" }) {
  if (!near) return [];
  const [lat, lon] = near;
  const delta = Math.max(0.15, Math.min(0.9, radiusKm / 111));
  const minLat = lat - delta, maxLat = lat + delta;
  const minLon = lon - delta, maxLon = lon + delta;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&accept-language=${encodeURIComponent(lang)}&bounded=1&viewbox=${encodeURIComponent(`${minLon},${maxLat},${maxLon},${minLat}`)}&q=${encodeURIComponent(query)}`;
  const res = await fetchFn(url, { headers: { "User-Agent": "TripPlanner/1.1 (server nearby)" } });
  if (!res.ok) return [];
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : [])
    .map(x => ({ name: x.display_name?.split(",")[0] || query, lat: parseFloat(x.lat), lon: parseFloat(x.lon) }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

async function tryExtendWalkDay({ d, byName, destNear, mode }) {
  const start = byName.get((d.start || "").toLowerCase());
  if (!start) return d;

  const candidates = [
    ...(await searchNearby({ near: destNear, query: "promenade", limit: 3, radiusKm: 12 })),
    ...(await searchNearby({ near: destNear, query: "park", limit: 3, radiusKm: 12 })),
    ...(await searchNearby({ near: destNear, query: "trail", limit: 3, radiusKm: 12 })),
  ];

  for (const c of candidates) {
    const seq = [
      { name: d.start, ...(start) },
      { name: c.name, lat: c.lat, lon: c.lon },
      { name: d.start, ...(start) }
    ];
    const out = await routeOSRM(mode, seq, { roundTrip: true });
    if (out?.distance_km && out.distance_km >= WALK_MIN_KM && out.distance_km <= WALK_MAX_KM) {
      d.waypoints = [c.name];
      byName.set(c.name.toLowerCase(), { name: c.name, lat: c.lat, lon: c.lon });
      d.distance_km = Math.round(out.distance_km * 10) / 10;
      return d;
    }
  }
  return d;
}

async function tryExtendBikeDay({ d, byName, destNear, mode, minKm = BIKE_MIN_DAILY_KM, maxKm = BIKE_MAX_DAILY_KM }) {
  const start = byName.get((d.start || "").toLowerCase());
  if (!start) return d;

  const candidates = await searchNearby({ near: destNear, query: "town", limit: 8, radiusKm: 90 });
  for (const c of candidates) {
    const seq = [
      { name: d.start, ...(start) },
      ...(Array.isArray(d.waypoints) ? d.waypoints.map(w => byName.get((w || "").toLowerCase())).filter(Boolean) : []),
      { name: c.name, lat: c.lat, lon: c.lon }
    ];
    const out = await routeOSRM(mode, seq, { roundTrip: false });
    if (out?.distance_km && out.distance_km >= minKm && out.distance_km <= maxKm) {
      d.end = c.name;
      byName.set(c.name.toLowerCase(), { name: c.name, lat: c.lat, lon: c.lon });
      d.distance_km = Math.round(out.distance_km * 10) / 10;
      return d;
    }
  }
  return d;
}

async function buildPointsFromDays(days, provided = [], destInfo = { near: null, extra: "" }) {
  const byName = new Map();
  for (const p of normalizeMapPoints(provided)) {
    byName.set(p.name, { name: p.name, lat: p.lat, lon: p.lon });
  }
  const names = Array.from(namesFromDays(days));
  for (const raw of names) {
    const name = String(raw).trim();
    if (!name) continue;
    const existing = byName.get(name);
    if (existing && Number.isFinite(existing.lat) && Number.isFinite(existing.lon)) continue;

    let found = null;
    const tries = [
      () => geocodeOnce(name, { lang: "he,en", near: destInfo.near, bboxKm: 50, extraQuery: destInfo.extra }),
      () => geocodeOnce(name, { lang: "en", near: destInfo.near, bboxKm: 50, extraQuery: destInfo.extra }),
      () => geocodeOnce(name, { lang: "he,en" }),
      () => geocodeOnce(name, { lang: "en" }),
    ];
    for (const t of tries) { try { const ans = await t(); if (ans) { found = ans; break; } } catch {} }
    byName.set(name, { name, lat: found ? found[0] : null, lon: found ? found[1] : null });
    await new Promise(r => setTimeout(r, 220));
  }
  return Array.from(byName.values());
}

function normalizePlaceDescriptions(arr) {
  const out = [];
  const A = Array.isArray(arr) ? arr : [];
  for (const d of A) {
    const name = typeof d?.name === "string" ? d.name.trim() : "";
    const summary = typeof d?.summary === "string" ? d.summary.trim() : "";
    const url = typeof d?.url === "string" ? d.url.trim() : "";
    const lang = typeof d?.lang === "string" ? d.lang.trim().slice(0, 8) : "";
    if (name && summary) {
      out.push({
        name,
        summary,
        ...(url && { url }),
        ...(lang && { lang }),
      });
    }
  }
  return out.slice(0, 100);
}

function namesFromPlan(plan) {
  const s = new Set();
  (Array.isArray(plan?.map_points) ? plan.map_points : []).forEach(p => p?.name && s.add(String(p.name)));
  (Array.isArray(plan?.days) ? plan.days : []).forEach(d => {
    if (d?.start) s.add(String(d.start));
    if (Array.isArray(d?.waypoints)) d.waypoints.forEach(w => w && s.add(String(w)));
    if (d?.end) s.add(String(d.end));
  });
  return Array.from(s);
}

async function groqWriteDescriptionsFromNames({ destination, mode, names, highlights }) {
  if (!Array.isArray(names) || !names.length) return [];

  const payload = {
    destination,
    mode,
    places: names.slice(0, 12),
    highlights: Array.isArray(highlights) ? highlights.slice(0, 20) : []
  };

  const system = `
  You are a concise, accurate travel copywriter.

  Write a short 2–4 sentence blurb for EACH place name in the input.
  STRICT RULES:
  - Output exactly ONE item per input name, in the SAME ORDER.
  - Do NOT add, drop, merge, or rename places.
  - If a name is unknown, write a generic travel-friendly blurb without inventing specifics.
  - STRICT OUTPUT: return ONLY this JSON object:
    {"items":[{"name":"<exact input>","summary":"<2-4 sentences>"}]}
  - No markdown, no extra text, no trailing commas.
  `.trim();

  const user = JSON.stringify(payload);

  const resp = await groqChatJSON({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.35,
    max_tokens: 1400
  });

  const items = Array.isArray(resp?.items)
    ? resp.items
    : (Array.isArray(resp) ? resp : []);

  return normalizePlaceDescriptions(items);
}

async function computeRouteFor({ mode, map_points }) {
  const pts = (Array.isArray(map_points) ? map_points : [])
    .filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lon));
  if (pts.length < 2) return null;
  const roundTrip = String(mode || "").toLowerCase() === "walk";
  const out = await routeOSRM(mode, pts, { roundTrip });
  return {
    geojson: out.geojson,
    distance_km: out.distance_km,
    duration_min: out.duration_min,
    profile: out.profileUsed || null,
  };
}

function buildPlanMessages({ destination, description = "", mode }) {
  const system = `
You are an expert outdoor trip planner. Produce realistic routes a normal person could actually do.

OUTPUT RULES
- Respond ONLY with JSON matching the schema below. No extra text.
- Use real towns/parks/roads/trails.
- If not sure of exact coordinates, set lat/lon to null (NEVER invent).

THEME / INTERESTS
- Read "User notes" and bias choices accordingly (e.g., nature, romantic, food, history).
- Prefer scenic and safe routes that match the requested vibe.

GEOGRAPHIC CONSISTENCY (VERY IMPORTANT)
- Keep every place (start/end/waypoints/map_points) inside the destination city/metro or immediate region.
- walk: ALL points within ~10 km of destination center AND form a LOOP (start = finish).
- bike: Entire route within ~70 km of destination center; total distance ≲ 120 km (≈60/day). Linear, not a loop.

MODE RULES
- walk: 1 day LOOP (start=finish), total 5–15 km, pedestrian-friendly.
- bike: 2 days, ~60 km per day, **LINEAR point-to-point (NOT a loop)**:
  • Day 1: start near the destination city; end in a different town/village; include overnight with lodging suggestion.
  • Day 2: start from the overnight town and **finish in a different town/village than the Day-1 start**.

SCHEMA (STRICT)
{
  "destination": string,
  "mode": "bike" | "walk",
  "total_distance_km": number,
  "days": [
    {
      "day": number,
      "distance_km": number,
      "start": string,
      "end": string,
      "waypoints": [string],
      "overnight": { "city": string, "lodging_suggestion": string } | null,
      "highlights": [string]
    }
  ],
  "map_points": [ { "name": string, "lat": number|null, "lon": number|null } ],
  "notes": [string]
}
`.trim();

  const user = `
Destination: "${destination}"
Mode: "${mode}"
User notes (optional): "${description}"

Follow the schema exactly. Keep every point geographically near the destination as specified above.
`.trim();

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

async function computeDailyDistancesOSRM({ mode, days, map_points }) {
  const byName = mapPointsByName(map_points);
  const D = Array.isArray(days) ? days : [];
  const isWalk = String(mode || "").toLowerCase() === "walk";

  let total = 0;
  const outDays = [];

  for (const d of D) {
    const seqNames = [d?.start, ...(Array.isArray(d?.waypoints) ? d.waypoints : []), d?.end]
      .filter(Boolean)
      .map(String);

    const seqPts = seqNames
      .map(n => byName.get(n.toLowerCase()))
      .filter(Boolean);

    let dist = (typeof d?.distance_km === "number" ? d.distance_km : null);

    if (seqPts.length >= 2) {
      const roundTrip = isWalk;
      try {
        const r = await routeOSRM(mode, seqPts, { roundTrip });
        if (r && Number.isFinite(r.distance_km)) {
          dist = Math.round(r.distance_km * 10) / 10;
        }
      } catch (e) {
        console.warn("[OSRM/day] failed:", e.message);
      }
    }

    total += Number.isFinite(dist) ? dist : 0;
    outDays.push({ ...d, distance_km: dist });
  }

  const totalRounded = Math.round(total * 10) / 10;
  return { days: outDays, total_distance_km: totalRounded };
}

// ----------------- Service API (each receives req,res) -----------------

async function listTrips(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const trips = await Trip.find({ user: userId }).sort({ createdAt: -1 });
  res.json(trips);
}

async function createTrip(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const rawKey = String(req.get("Idempotency-Key") || req.get("X-Idempotency-Key") || req.body?.idem_key || "").trim();
    const idemKey = rawKey ? `${userId}:${rawKey}` : null;

    let {
      title, summary, notes = "", mode, destination, image,
      days = [], total_distance_km = null, map_points = [],
      place_descriptions: placeDescFromClient
    } = req.body || {};
    notes = typeof notes === "string" ? notes : (Array.isArray(notes) ? notes.join(" • ") : "")

    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
    if (!summary || !String(summary).trim()) return res.status(400).json({ message: "Summary is required" });
    if (String(summary).length > 200) return res.status(400).json({ message: "Summary must be ≤ 200 characters" });
    if (!["bike", "walk"].includes(mode)) return res.status(400).json({ message: "Invalid mode" });

    if (idemKey) {
      const existing = await Trip.findOne({ idem_key: idemKey });
      if (existing) return res.status(200).json(existing);
    }

    if (IS_FAST) {
      const dest = normalizeDestination(destination) || normalizeDestination(title);
      const img = normalizeImage(image);
      const pointsFinal = normalizeMapPoints(map_points);
      const cleanDays = Array.isArray(days) ? days.map(d => ({
        day: Number(d.day) || 1,
        start: String(d.start || "").trim(),
        end: String(d.end || "").trim(),
        waypoints: Array.isArray(d.waypoints) ? d.waypoints.map(String) : [],
        distance_km: Number.isFinite(d.distance_km) ? d.distance_km : null,
        overnight: d.overnight && typeof d.overnight === "object"
          ? { city: String(d.overnight.city || "").trim(), lodging_suggestion: String(d.overnight.lodging_suggestion || "").trim() }
          : null,
        highlights: Array.isArray(d.highlights) ? d.highlights.map(String) : []
      })) : [];

      if (!Number.isFinite(total_distance_km)) {
        total_distance_km = cleanDays.reduce((s, d) => s + (Number.isFinite(d.distance_km) ? d.distance_km : 0), 0);
        if (!Number.isFinite(total_distance_km) || total_distance_km <= 0) total_distance_km = null;
      }

      try {
        const trip = await Trip.create({
          user: userId,
          title: title.trim(),
          notes,
          mode,
          summary: String(summary).trim(),
          destination: dest || { name: title.trim() },
          image: img || null,
          total_distance_km,
          days: cleanDays,
          map_points: pointsFinal,
          place_descriptions: normalizePlaceDescriptions(placeDescFromClient || []),
          ...(idemKey ? { idem_key: idemKey } : {})
        });
        return res.status(201).json(trip);
      } catch (e) {
        if (e?.code === 11000 && idemKey) {
          const existing = await Trip.findOne({ idem_key: idemKey });
          if (existing) return res.status(200).json(existing);
        }
        throw e;
      }
    }

    const dest = normalizeDestination(destination) || normalizeDestination(title);
    if (!dest) return res.status(400).json({ message: "Destination is required" });

    const destInfo = await geocodeDestinationIfNeeded(dest);
    const img = normalizeImage(image);
    const provided = normalizeMapPoints(map_points);

    const basePoints = provided.length ? provided : await buildPointsFromDays(days, [], destInfo);
    const pointsClamped = clampOutliers(basePoints, destInfo.near, mode);
    const pointsFinal = await buildPointsFromDays(days, pointsClamped, destInfo);

    let route = null;
    try {
      route = await computeRouteFor({ mode, map_points: pointsFinal });
    } catch (e) {
      console.warn("[/api/trips] overall route compute failed:", e.message);
      route = null;
    }

    days = await enforceDayDistanceBounds({
      mode,
      days: days || [],
      map_points: pointsFinal || [],
      destNear: destInfo.near
    });

    if (mode === "bike") {
      const tmpPlan = { mode, days, map_points: pointsFinal };
      enforceLinearBike(tmpPlan);
      days = tmpPlan.days;
    }

    try {
      const osrmDaily = await computeDailyDistancesOSRM({
        mode,
        days,
        map_points: pointsFinal
      });
      days = osrmDaily.days;
      total_distance_km = osrmDaily.total_distance_km;
    } catch (e) {}

    try {
      const trip = await Trip.create({
        user: userId,
        title: title.trim(),
        notes,
        mode,
        summary: String(summary).trim(),
        destination: destInfo.dest,
        image: img || null,
        total_distance_km: Number.isFinite(total_distance_km)
          ? total_distance_km
          : (route?.distance_km ?? null),
        days,
        map_points: pointsFinal,
        place_descriptions: normalizePlaceDescriptions(placeDescFromClient || []),
        ...(route ? { route } : {}),
        ...(idemKey ? { idem_key: idemKey } : {})
      });
      return res.status(201).json(trip);
    } catch (e) {
      if (e?.code === 11000 && idemKey) {
        const existing = await Trip.findOne({ idem_key: idemKey });
        if (existing) return res.status(200).json(existing);
      }
      throw e;
    }
  } catch (e) {
    res.status(500).json({ message: "Failed to create trip" });
  }
}

async function aiPlan(req, res) {
  try {
    const { destination, notes = "", mode, title } = req.body || {};
    if (!destination || !String(destination).trim())
      return res.status(400).json({ message: "destination is required" });
    if (!["bike", "walk"].includes(mode))
      return res.status(400).json({ message: "mode must be 'bike' or 'walk'" });

    const planMsgs = buildPlanMessages({
      destination: String(destination).trim(),
      description: String(notes || ""),
      mode,
    });
    const plan = await groqChatJSON({ messages: planMsgs, temperature: 0.35, max_tokens: 2000 });
    if (!plan || typeof plan !== "object" || !Array.isArray(plan.days)) {
      return res.status(502).json({ message: "Bad model output", data: plan });
    }

    if (mode === "walk" && plan.days.length !== 1) plan.days = plan.days.slice(0, 1);
    if (mode === "bike" && plan.days.length !== 2) plan.days = plan.days.slice(0, 2);

    enforceLinearBike(plan);
    if (!Array.isArray(plan.map_points)) plan.map_points = [];
    if (!Array.isArray(plan.notes)) plan.notes = [];

    const destNorm = normalizeDestination(plan.destination || destination) || { name: String(destination) };
    const destInfo = await geocodeDestinationIfNeeded(destNorm);

    const cleaned = clampOutliers(plan.map_points || [], destInfo.near, mode);
    const biasedResolved = await buildPointsFromDays(plan.days || [], cleaned, destInfo);
    plan.map_points = biasedResolved;

    plan.days = await enforceDayDistanceBounds({
      mode,
      days: plan.days || [],
      map_points: plan.map_points || [],
      destNear: destInfo.near
    });

    try {
      const osrmDaily = await computeDailyDistancesOSRM({
        mode,
        days: plan.days || [],
        map_points: plan.map_points || []
      });
      plan.days = osrmDaily.days;
      plan.total_distance_km = osrmDaily.total_distance_km;
    } catch (e) {
      console.warn("[/api/trips/ai] daily OSRM compute failed:", e.message);
    }

    try {
      const route = await computeRouteFor({ mode, map_points: plan.map_points || [] });
      if (route) plan.route = route;
    } catch (e) {
      console.warn("[/api/trips/ai] overall route failed:", e.message);
    }

    const mapNames = (Array.isArray(plan.map_points) ? plan.map_points : [])
      .map(p => p?.name)
      .filter(Boolean);
    const fallbackNames = namesFromPlan(plan);
    const names = (mapNames.length ? mapNames : fallbackNames).slice(0, 12);

    const groqDescs = await groqWriteDescriptionsFromNames({
      destination: plan.destination || String(destination),
      mode,
      names,
      highlights: []
    });

    plan.place_descriptions = groqDescs;
    plan.title = (title || plan.destination || String(destination)).trim();

    return res.status(200).json(plan);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "AI planning failed" });
  }
}

async function getTrip(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid trip id" });

  const trip = await Trip.findOne({ _id: id, user: userId });
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  res.json(trip);
}

async function updateTrip(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid trip id" });

    const curr = await Trip.findOne({ _id: id, user: userId }).select("destination mode map_points days");
    if (!curr) return res.status(404).json({ message: "Trip not found" });

    const update = {};
    let mustRecompute = false;
    let daysChanged = false;

    if (typeof req.body.title === "string") update.title = req.body.title.trim();
    if (typeof req.body.summary === "string") {
      const s = req.body.summary.trim();
      if (!s) return res.status(400).json({ message: "Summary cannot be empty" });
      if (s.length > 200) return res.status(400).json({ message: "Summary must be ≤ 200 characters" });
      update.summary = s;
    }
    if (typeof req.body.notes === "string") update.notes = req.body.notes;

    if (typeof req.body.mode === "string") {
      if (!["bike", "walk"].includes(req.body.mode)) return res.status(400).json({ message: "Invalid mode" });
      update.mode = req.body.mode;
      mustRecompute = true;
    }

    if (req.body.total_distance_km !== undefined) {
      update.total_distance_km = Number.isFinite(req.body.total_distance_km) ? req.body.total_distance_km : null;
    }

    if (req.body.destination !== undefined) {
      const dest = normalizeDestination(req.body.destination);
      if (!dest) return res.status(400).json({ message: "Invalid destination" });
      const destInfo = await geocodeDestinationIfNeeded(dest);
      update.destination = destInfo.dest;
    }

    if (req.body.days !== undefined) {
      update.days = Array.isArray(req.body.days) ? req.body.days : [];
      daysChanged = true;
      mustRecompute = true;
    }

    if (req.body.map_points !== undefined) {
      update.map_points = normalizeMapPoints(req.body.map_points);
      mustRecompute = true;
    } else if (daysChanged) {
      const destInfo = await geocodeDestinationIfNeeded(update.destination || curr.destination || null);
      update.map_points = await buildPointsFromDays(update.days || [], [], destInfo);
      mustRecompute = true;
    }

    if (req.body.place_descriptions !== undefined) {
      update.place_descriptions = normalizePlaceDescriptions(req.body.place_descriptions);
    }

    if (req.body.image !== undefined) update.image = normalizeImage(req.body.image);

    if (mustRecompute) {
      const finalMode = update.mode ?? curr.mode;
      const basePoints = update.map_points ?? curr.map_points;
      let finalDays = update.days ?? curr.days;

      const destInfo = await geocodeDestinationIfNeeded(update.destination || curr.destination || null);

      const clamped = clampOutliers(basePoints, destInfo.near, finalMode);
      const finalPoints2 = await buildPointsFromDays(finalDays || [], clamped, destInfo);

      finalDays = await enforceDayDistanceBounds({
        mode: finalMode,
        days: finalDays || [],
        map_points: finalPoints2 || [],
        destNear: destInfo.near
      });

      if (finalMode === "bike") {
        const tmpPlan = { mode: finalMode, days: finalDays, map_points: finalPoints2 };
        enforceLinearBike(tmpPlan);
        finalDays = tmpPlan.days;
      }

      let route = null;
      try {
        route = await computeRouteFor({ mode: finalMode, map_points: finalPoints2 });
      } catch (e) {
        console.warn("[/api/trips] update route compute failed:", e.message);
      }
      update.route = route || { geojson: null, distance_km: null, duration_min: null, profile: null };


      try {
        const osrmDaily = await computeDailyDistancesOSRM({
          mode: finalMode,
          days: finalDays || [],
          map_points: finalPoints2 || []
        });
        update.days = osrmDaily.days;
        if (req.body.total_distance_km === undefined) {
          update.total_distance_km = osrmDaily.total_distance_km ?? route?.distance_km ?? null;
        }
      } catch (e) {}
    }

    const trip = await Trip.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: update },
      { new: true }
    );

    if (!trip) return res.status(404).json({ message: "Trip not found" });
    res.json(trip);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update trip" });
  }
}

async function deleteTrip(req, res) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid trip id" });

  const deleted = await Trip.findOneAndDelete({ _id: id, user: userId });
  if (!deleted) return res.status(404).json({ message: "Trip not found" });
  res.json({ ok: true });
}

module.exports = {
  // HTTP handlers
  listTrips,
  createTrip,
  aiPlan,
  getTrip,
  updateTrip,
  deleteTrip,
};
