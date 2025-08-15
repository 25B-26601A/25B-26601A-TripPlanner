// Polyfill-safe fetch
const fetchFn = (typeof fetch === "function")
  ? fetch
  : ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

// ---------- utils ----------
function enrichQuery(raw, kind) {
  if (!raw) return "travel landmark";
  return kind === "city"
    ? `${raw} city skyline cityscape landmark architecture downtown waterfront panorama`
    : `${raw} travel landmark`;
}

// Softer BAD list (keeps junk down but not the root cause)
const BAD = new Set([
  "logo","illustration","vector","graphic","typography","text","sign","poster","banner","advertisement","brand",
  "emblem","coat of arms","flag","seal","badge",
  "food","meal","burger","pizza","sandwich","drink","coffee",
  "car","motorcycle"
]);
const GOOD = new Set([
  "skyline","city","cityscape","architecture","building","buildings",
  "downtown","old town","historic","landmark","panorama","street","urban",
  "waterfront","harbor","harbour","port","beach","bridge","square","river","park"
]);

function normalizeCredit({ provider, author, username, link, source }) {
  return { provider, author: author || null, username: username || null, link: link || null, source: source || null };
}

function containsNeedle(candidate, needlesLower) {
  if (!needlesLower?.length) return false;
  const fields = [
    candidate.alt,
    candidate.text,
    candidate?.credit?.author,
    candidate?.credit?.source,
    candidate?.credit?.link,
    candidate.src
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return needlesLower.some(n => n && fields.includes(n));
}

function scoreCandidate(candidate, needlesLower) {
  let s = 0;
  const t = (candidate.text || "").toLowerCase();

  for (const b of BAD) if (t.includes(b)) s -= 3;
  for (const g of GOOD) if (t.includes(g)) s += 2;

  const ratio = (candidate.width || 0) / (candidate.height || 1);
  if (ratio >= 1.3 && ratio <= 2.2) s += 1; // landscape
  if (candidate.width >= 1200) s += 1;

  const p = candidate.provider;
  if (p === "pexels") s += 1.0;
  else if (p === "unsplash") s += 0.8;

  if (needlesLower?.length) {
    if (containsNeedle(candidate, needlesLower)) s += 5;
    else s -= 0.5;
  }
  return s;
}

function pickBest(cands, needlesLower) {
  if (!Array.isArray(cands) || !cands.length) return null;
  cands = cands.filter(c => {
    const ratio = (c.width || 0) / (c.height || 1);
    return ratio >= 1.3 && ratio <= 2.2;
  });
  cands.forEach(c => { c.__score = scoreCandidate(c, needlesLower); });
  cands.sort((a, b) => b.__score - a.__score);
  return cands[0];
}

function dedupe(cands) {
  const seen = new Set();
  return (cands || []).filter(c => {
    const key = `${c.src}|${c.credit?.provider || ""}`;
    if (!c.src || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseBool(v) {
  const s = String(v ?? "").toLowerCase();
  return ["1","true","yes","y","on"].includes(s);
}

function needleVariants(raw) {
  const q = (raw || "").trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const parts = lower.split(",").map(s => s.trim()).filter(Boolean);
  const uniq = new Set([lower, ...parts]);
  return Array.from(uniq);
}

function setNoCache(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
}

// ---------- providers (Pexels & Unsplash API) ----------
async function pexelsCandidates(query, kind) {
  const key = process.env.PEXELS_KEY;
  if (!key) return [];
  const url =
    "https://api.pexels.com/v1/search" +
    `?query=${encodeURIComponent(enrichQuery(query, kind))}&per_page=20&orientation=landscape`;
  const r = await fetchFn(url, { headers: { Authorization: key } });
  if (!r.ok) return [];
  const json = await r.json();
  const arr = Array.isArray(json?.photos) ? json.photos : [];
  return arr.map(p => ({
    src: p.src?.large2x || p.src?.large || p.src?.original,
    alt: p.alt || query,
    width: p.width || 0,
    height: p.height || 0,
    text: [p.alt, p.photographer].filter(Boolean).join(" "),
    provider: "pexels",
    credit: normalizeCredit({
      provider: "pexels",
      author: p.photographer,
      link: p.url
    })
  })).filter(x => !!x.src);
}

async function unsplashCandidates(query, kind) {
  const key = process.env.UNSPLASH_KEY;
  if (!key) return []; // Source fallback handled separately
  const enriched = enrichQuery(query, kind);
  const url =
    "https://api.unsplash.com/search/photos" +
    `?query=${encodeURIComponent(enriched)}` +
    "&per_page=20&orientation=landscape&order_by=relevant&content_filter=high";
  const r = await fetchFn(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!r.ok) return [];
  const json = await r.json();
  const arr = Array.isArray(json?.results) ? json.results : [];
  return arr.map(p => ({
    src: p.urls?.regular,
    alt: p.alt_description || query,
    width: p.width || 0,
    height: p.height || 0,
    text: [p.alt_description, p.description, ...(p.tags || []).map(t => t?.title)].filter(Boolean).join(" "),
    provider: "unsplash",
    credit: normalizeCredit({
      provider: "unsplash",
      author: p.user?.name,
      username: p.user?.username,
      link: p.links?.html
    })
  })).filter(x => !!x.src);
}

// ---------- robust Unsplash Source (server resolves redirect) ----------
async function resolveUnsplashSource(raw, kind) {
  const enriched = enrichQuery(raw, kind);
  const bases = [
    `https://source.unsplash.com/featured/800x450/?${encodeURIComponent(enriched)}`,
    `https://source.unsplash.com/800x450/?${encodeURIComponent(enriched)}`
  ];
  for (const base of bases) {
    for (let i = 0; i < 3; i++) {
      const sig = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const url = `${base}&sig=${sig}`;
      try {
        // Don’t auto-follow; capture Location header
        const resp = await fetchFn(url, { method: "GET", redirect: "manual" });
        const loc = resp.headers.get("location");
        if (resp.status >= 300 && resp.status < 400 && loc) {
          const finalUrl = loc.startsWith("http") ? loc : `https://source.unsplash.com${loc}`;
          return {
            src: finalUrl,
            alt: raw,
            credit: normalizeCredit({ provider: "unsplash" })
          };
        }
        if (resp.ok && (resp.headers.get("content-type") || "").startsWith("image/")) {
          return {
            src: url,
            alt: raw,
            credit: normalizeCredit({ provider: "unsplash" })
          };
        }
      } catch { /* next sig */ }
    }
  }
  return null;
}

// ---------- Wikipedia fallback (only if we still have nothing) ----------
async function wikiImage(raw) {
  const langs = ["en", "de", "he"]; // try English, German, Hebrew
  for (const lang of langs) {
    try {
      const u = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(raw)}`;
      const r = await fetchFn(u, { headers: { "User-Agent": "TripPlanner/1.0 (server image fallback)" } });
      if (!r.ok) continue;
      const j = await r.json();
      const src = j?.originalimage?.source || j?.thumbnail?.source;
      if (!src) continue;
      return {
        src,
        alt: j?.title || raw,
        credit: normalizeCredit({
          provider: "wikipedia",
          source: j?.content_urls?.desktop?.page || j?.content_urls?.mobile?.page || null
        })
      };
    } catch { /* try next lang */ }
  }
  return null;
}

// ---------- HTTP handler ----------
async function getImage(req, res) {
  try {
    const raw = (req.query.q || req.query.query || "travel").trim();
    const kind = (req.query.kind || "city").toLowerCase();
    const strictParam = parseBool(req.query.strict);

    const needles = needleVariants(raw);

    const all = [];
    const push = (arr) => Array.isArray(arr) && arr.forEach(x => all.push(x));

    // Prefer API results (reliable)
    push(await pexelsCandidates(raw, kind).catch(() => []));
    push(await unsplashCandidates(raw, kind).catch(() => []));

    let candidates = dedupe(all);

    // STRICT: require destination mention; else try Unsplash Source, then Wikipedia
    if (strictParam) {
      const strictMatches = candidates.filter(c => containsNeedle(c, needles));
      if (strictMatches.length) {
        candidates = strictMatches;
      } else {
        const srcResolved = await resolveUnsplashSource(raw, kind);
        if (srcResolved) {
          setNoCache(res);
          return res.status(200).json({
            src: srcResolved.src,
            alt: srcResolved.alt || raw,
            credit: srcResolved.credit || null
          });
        }
        const wiki = await wikiImage(raw);
        setNoCache(res);
        if (wiki) {
          return res.status(200).json({
            src: wiki.src,
            alt: wiki.alt || raw,
            credit: wiki.credit || null
          });
        }
        // fall through to scoring if both failed
      }
    }

    let best = pickBest(candidates, needles);

    if (!best) {
      // final fallbacks: Unsplash Source, then Wikipedia
      best = await resolveUnsplashSource(raw, kind);
      if (!best) best = await wikiImage(raw);
      if (!best) {
        setNoCache(res);
        return res.status(502).json({ message: "No image available" });
      }
    }

    setNoCache(res);
    return res.json({
      src: best.src,
      alt: best.alt || raw,
      credit: best.credit || null
    });
  } catch (e) {
    console.error(e);
    setNoCache(res);
    res.status(500).json({ message: e.message || "Image fetch error" });
  }
}

module.exports = {
  getImage,
};
