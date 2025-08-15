// components/TripItinerary.jsx
export default function TripItinerary({ days = [], mode }) {
  if (!Array.isArray(days) || days.length === 0) return null;

  const totalKm = days.reduce(
    (sum, d) => sum + (Number.isFinite(d?.distance_km) ? d.distance_km : 0),
    0
  );

  return (
    <div className="card" style={{ marginTop: 16, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
      <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 18 }}>
        Daily plan • {totalKm.toFixed(1)} km total
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {days.map((d, i) => {
          const dayNum = d.day ?? i + 1;
          const km = Number.isFinite(d?.distance_km) ? d.distance_km.toFixed(1) : null;

          const showSleep = mode === "bike" && i === 0;
          const sleepVal = showSleep ? (d.lodging || d.sleep || d.end || null) : null;

          return (
            <div key={i} style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: 12, background: "#fafafa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>Day {dayNum}</div>
                {km ? <div style={{ fontSize: 13, color: "#64748b" }}>{km} km</div> : null}
              </div>

              <div style={{ fontSize: 14, marginTop: 6 }}>
                <strong>Start:</strong> {d.start || "—"} {d.end ? <> • <strong>End:</strong> {d.end}</> : null}
              </div>

              {sleepVal ? (
                <div style={{ fontSize: 14, marginTop: 6 }}>
                  <strong>Sleep:</strong> {sleepVal}
                  {d.lodging && d.lodging !== sleepVal ? <> • {d.lodging}</> : null}
                </div>
              ) : null}

              {Array.isArray(d.highlights) && d.highlights.length > 0 ? (
                <div style={{ marginTop: 6 }}>
                  <strong>Highlights:</strong>
                  <ul style={{ marginTop: 4, paddingLeft: 18, color: "#475569" }}>
                    {d.highlights.map((h, j) => <li key={j}>{h}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
