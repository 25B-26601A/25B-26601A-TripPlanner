// components/TripSummary.jsx
import { Link } from "react-router-dom";
import { MapPin, Route, Calendar } from "lucide-react";

export default function TripSummary({ trip, showBack = false }) {
  if (!trip) return null;

  const title = trip.title || "Trip";
  const dest = trip.destination?.name || "—";
  const daysCount = Array.isArray(trip.days) ? trip.days.length : 0;
  const distance = Number.isFinite(trip.total_distance_km) ? trip.total_distance_km.toFixed(1) : "—";
  const mode = trip.mode || "—";
  const stops = Array.isArray(trip.map_points) ? trip.map_points.length : 0;

  const isBike = mode.toLowerCase() === "bike";
  const tagStyles = {
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 16,
    lineHeight: 1,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    border: `1px solid ${isBike ? "rgba(37,99,235,.45)" : "rgba(16,185,129,.45)"}`,
    background: isBike ? "rgba(37,99,235,.18)" : "rgba(16,185,129,.20)",
    color: isBike ? "#1d4ed8" : "#047857",
  };

  return (
    <div className="card" style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={tagStyles}>{mode}</span>
          {showBack ? (
            <Link to="/trips" className="btn" style={{ textDecoration: "none" }}>
              Back to trips
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, color: "#475569" }}>
        <MapPin size={16} /> <span>{dest}</span>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
        <div style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: 10, background: "#fafafa", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Distance</div>
          <div style={{ fontWeight: 700 }}>{distance} km</div>
        </div>
        <div style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: 10, background: "#fafafa", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Days</div>
          <div style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Calendar size={16} /> {daysCount}
          </div>
        </div>
        <div style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: 10, background: "#fafafa", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Stops</div>
          <div style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Route size={16} /> {stops}
          </div>
        </div>
      </div>

      {trip.summary ? (
        <p style={{ marginTop: 12, color: "#334155", lineHeight: 1.5 }}>{trip.summary}</p>
      ) : null}
    </div>
  );
}
