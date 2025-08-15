import { useEffect, useState } from "react";

export default function WeatherCard({ lat, lon, startDate, days = 3, heading }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  function addDays(ymd, n) {
    const [y, m, d] = ymd.split("-").map((v) => parseInt(v, 10));
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    const y2 = dt.getFullYear();
    const m2 = String(dt.getMonth() + 1).padStart(2, "0");
    const d2 = String(dt.getDate()).padStart(2, "0");
    return `${y2}-${m2}-${d2}`;
  }

  function codeToEmoji(w) {
    if (w == null) return "🌤️";
    if (w === 0) return "☀️";
    if ([1].includes(w)) return "🌤️";
    if ([2].includes(w)) return "⛅️";
    if ([3].includes(w)) return "☁️";
    if ([45, 48].includes(w)) return "🌫️";
    if ([51, 53, 55, 61, 63, 65].includes(w)) return "🌧️";
    if ([56, 57, 66, 67, 80, 81, 82].includes(w)) return "🌦️";
    if ([71, 73, 75, 77, 85, 86].includes(w)) return "❄️";
    if ([95, 96, 99].includes(w)) return "⛈️";
    return "🌤️";
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr("");
      setData(null);
      try {
        const baseStart = startDate || new Date().toISOString().slice(0, 10);
        const start = addDays(baseStart, 1);
        const end = addDays(start, Math.max(0, days - 1));
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
          `&timezone=auto&start_date=${start}&end_date=${end}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json?.daily?.time?.length) throw new Error("No forecast data");
        if (!cancelled) setData(json.daily);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Weather fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (lat != null && lon != null) run();
    else { setLoading(false); setErr("Missing weather parameters"); }
    return () => { cancelled = true; };
  }, [lat, lon, startDate, days]);

  if (loading) return <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>Loading weather…</div>;
  if (err) return <div className="error" style={{ marginTop: 6 }}>{err}</div>;
  if (!data) return null;

  const items = data.time.map((t, i) => ({
    date: t,
    tmin: data.temperature_2m_min?.[i],
    tmax: data.temperature_2m_max?.[i],
    pop: data.precipitation_probability_max?.[i],
    code: data.weathercode?.[i],
  }));

  return (
    <div
      className="card"
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 10 }}>
        {heading || `${items.length}-Day Forecast`}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          gap: 12,
        }}
      >
        {items.map((it) => {
          const dt = new Date(it.date);
          const label = dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          return (
            <div
              key={it.date}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #f1f5f9",
                background: "#fafafa",
                display: "grid",
                placeItems: "center",
                gap: 6,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
              <div style={{ fontSize: 26 }}>{codeToEmoji(it.code)}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {Math.round(it.tmax)}° / {Math.round(it.tmin)}°
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                POP {it.pop != null ? `${it.pop}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
