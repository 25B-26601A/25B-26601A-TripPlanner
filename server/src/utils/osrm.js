const fetchFn = (typeof fetch === "function")
  ? fetch
  : ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

const OSRM_URL = (process.env.OSRM_URL || "http://localhost:5001").replace(/\/+$/, "");

const PROFILE_CANDIDATES = {
  walk: ["walking", "foot"],
  bike: ["cycling", "bike"],
};

const ENV_PROFILE = (process.env.OSRM_PROFILE || "").trim().toLowerCase();

function normPoint(p) {
  const lat = Number(p?.lat);
  const lon = Number(p?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, name: (p?.name || "").trim() };
}

function coordString(points) {
  return points.map(({ lat, lon }) => `${lon},${lat}`).join(";");
}

async function tryRoute(profile, coords) {
  const url =
    `${OSRM_URL}/route/v1/${profile}/${coordString(coords)}` +
    `?alternatives=false&steps=false&geometries=geojson&overview=full&annotations=duration,distance`;

  const r = await fetchFn(url);
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} on ${profile} -> ${text.slice(0, 200)}`);
  }
  const j = await r.json();
  const route = j?.routes?.[0];
  if (!route?.geometry?.type || !Array.isArray(route?.geometry?.coordinates)) {
    throw new Error(`No route geometry for profile ${profile}`);
  }

  return {
    geojson: route.geometry,
    distance_km: Number(route.distance) / 1000 || null,
    duration_min: Number(route.duration) / 60 || null,
    profileUsed: profile,
  };
}

async function routeOSRM(mode = "walk", points = [], { roundTrip = false } = {}) {
  const m = (mode || "walk").toLowerCase();
  const inPts = (Array.isArray(points) ? points : [])
    .map(normPoint)
    .filter(Boolean);

  if (inPts.length < 2) {
    return null;
  }

  let coords = inPts.slice();
  if (roundTrip) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (!first || !last || first.lat !== last.lat || first.lon !== last.lon) {
      coords = coords.concat([{ ...first }]);
    }
  }

  const candidates = [];
  if (ENV_PROFILE) candidates.push(ENV_PROFILE);
  const pref = PROFILE_CANDIDATES[m] || [];
  for (const p of pref) if (!candidates.includes(p)) candidates.push(p);

  let lastErr = null;
  for (const profile of candidates) {
    try {
      const out = await tryRoute(profile, coords);
      if (out) return out;
    } catch (e) {
      lastErr = e;
      console.warn(`[OSRM] ${profile} failed:`, e.message);
    }
  }

  if (lastErr) {
    console.error("[OSRM] All profiles failed:", lastErr.message);
  }
  return null;
}

module.exports = { routeOSRM };
