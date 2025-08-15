// components/TripMap.jsx
import { useMemo, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { dayColors } from "../utils/colors";

// default leaflet icon (used only if we don't pass a custom one)
const defaultIcon = L.icon({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

/* ---------- helpers ---------- */
function geojsonToLatLngs(geojson) {
  const coords = Array.isArray(geojson?.coordinates) ? geojson.coordinates : null;
  if (!coords) return [];
  return coords
    .map(([lng, lat]) => [lat, lng])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function toLatLngs(geojson, points) {
  const fromGeo = geojsonToLatLngs(geojson);
  if (fromGeo.length) return fromGeo;
  if (Array.isArray(points) && points.length) {
    return points
      .filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lon))
      .map(p => [p.lat, p.lon]);
  }
  return [];
}

function FitBoundsEffect({ latlngs }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !latlngs?.length) return;
    if (latlngs.length === 1) map.setView(latlngs[0], 13, { animate: false });
    else map.fitBounds(latlngs, { padding: [30, 30], animate: false });
  }, [map, latlngs]);
  return null;
}

function toBounds(latlngs) {
  if (!latlngs.length) return null;
  let minLat = latlngs[0][0], maxLat = latlngs[0][0];
  let minLng = latlngs[0][1], maxLng = latlngs[0][1];
  for (const [lat, lng] of latlngs) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [[minLat, minLng], [maxLat, maxLng]];
}

// distance + nearest index on a polyline
const toRad = (x) => (x * Math.PI) / 180;
function haversine(a, b) {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}
function nearestIndexOnLine(lineLL, targetLL) {
  if (!Array.isArray(lineLL) || lineLL.length === 0) return 0;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < lineLL.length; i++) {
    const d = haversine(lineLL[i], targetLL);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// single definition!
function createColoredMarker(color) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 0 4px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/* ---------- component ---------- */
export default function TripMap({
  geojson,
  points = [],
  days = [],
  height = 360,
}) {
  const latlngs = useMemo(() => toLatLngs(geojson, points), [geojson, points]);
  const bounds = useMemo(() => toBounds(latlngs), [latlngs]);
  const center = useMemo(
    () => (latlngs[0] ? latlngs[0] : [32.0853, 34.7818]),
    [latlngs]
  );

  // name -> day index map (start/waypoints/end)
  const nameToDay = useMemo(() => {
    const m = new Map();
    (days || []).forEach((d, idx) => {
      const names = [d.start, ...(d.waypoints || []), d.end]
        .map(s => (s || "").trim())
        .filter(Boolean);
      names.forEach(n => m.set(n.toLowerCase(), idx));
    });
    return m;
  }, [days]);

  // day-colored route slices (fallback to full polyline if none)
  const daySlices = useMemo(() => {
    if (!latlngs.length || !Array.isArray(days) || days.length === 0) return [];

    const byName = new Map(
      (points || [])
        .filter(p => p?.name && Number.isFinite(p.lat) && Number.isFinite(p.lon))
        .map(p => [p.name.trim().toLowerCase(), [p.lat, p.lon]])
    );

    const sequences = days.map(d => {
      const names = [d.start, ...(d.waypoints || []), d.end]
        .map(s => (s || "").trim())
        .filter(Boolean);
      return names
        .map(n => byName.get(n.toLowerCase()))
        .filter(Boolean);
    });

    const out = [];
    sequences.forEach((seq, iDay) => {
      const color = dayColors[iDay % dayColors.length];
      for (let i = 0; i < seq.length - 1; i++) {
        const a = seq[i], b = seq[i + 1];
        const ia = nearestIndexOnLine(latlngs, a);
        const ib = nearestIndexOnLine(latlngs, b);
        const start = Math.min(ia, ib);
        const end = Math.max(ia, ib);
        if (end - start < 1) continue;
        out.push({ color, coords: latlngs.slice(start, end + 1) });
      }
    });

    return out;
  }, [latlngs, days, points]);

  const showFallbackLine = !daySlices.length && latlngs.length > 1;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ height }}>
        <MapContainer
          center={center}
          zoom={13}
          bounds={bounds || undefined}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBoundsEffect latlngs={latlngs} />

          {showFallbackLine && <Polyline positions={latlngs} />}
          {daySlices.map((seg, i) => (
            <Polyline
              key={`seg-${i}`}
              positions={seg.coords}
              pathOptions={{ color: seg.color, weight: 5, opacity: 0.95 }}
            />
          ))}

          {Array.isArray(points) && points.map((p, i) => {
            if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) return null;
            const key = (p.name || "").trim().toLowerCase();
            const dayIdx = nameToDay.has(key) ? nameToDay.get(key) : null;
            const color = dayIdx != null ? dayColors[dayIdx % dayColors.length] : "#64748b";
            return (
              <Marker
                key={`${p.name || "pt"}-${i}`}
                position={[p.lat, p.lon]}
                icon={createColoredMarker(color)}
              >
                <Popup>
                  <div style={{ fontWeight: 700 }}>
                    {i === 0 ? "Start" : i === points.length - 1 ? "End" : `Stop ${i}`}
                  </div>
                  <div>{p.name || `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`}</div>
                  {dayIdx != null ? <div style={{ marginTop: 4 }}>Day {dayIdx + 1}</div> : null}
                </Popup>
                <Tooltip direction="top">
                  {p.name || `Point ${i + 1}`} {dayIdx != null ? `(Day ${dayIdx + 1})` : ""}
                </Tooltip>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
