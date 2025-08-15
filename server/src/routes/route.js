const express = require("express");
const router = express.Router();
const { routeOSRM } = require("../utils/osrm");

router.get("/ping", (req, res) => {
  res.json({
    ok: true,
    osrm_url: process.env.OSRM_URL || "not set",
    osrm_profile: process.env.OSRM_PROFILE || "auto",
    ts: new Date().toISOString(),
  });
});

router.post("/", async (req, res) => {
  try {
    const { mode = "walk", points = [], roundTrip = false } = req.body || {};
    const withCoords = (Array.isArray(points) ? points : []).filter(
      (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon)
    );
    if (withCoords.length < 2) {
      return res.status(400).json({ message: "Need at least 2 points with lat/lon" });
    }

    const out = await routeOSRM(mode, withCoords, { roundTrip });
    if (!out) {
      return res.status(502).json({ message: "OSRM routing failed (no route)", detail: { mode, roundTrip } });
    }

    return res.json({
      geojson: out.geojson,
      distance_km: out.distance_km,
      duration_min: out.duration_min,
      profile: out.profileUsed || null,
    });
  } catch (e) {
    res.status(500).json({ message: e.message || "Route error" });
  }
});

module.exports = router;
