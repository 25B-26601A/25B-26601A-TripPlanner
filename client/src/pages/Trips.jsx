// pages/Trips.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import "../utils/buttons.css";

export default function Trips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [view, setView] = useState("gallery");
  const [q, setQ] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  useEffect(() => {
    let on = true;
    async function run() {
      if (!user) { setLoading(false); return; }
      try {
        const data = await api.trips.list();
        if (on) setTrips(Array.isArray(data) ? data : []);
      } catch (e) {
        if (on) setErr(e.message || "Failed to load trips");
      } finally {
        if (on) setLoading(false);
      }
    }
    run();
    return () => { on = false; };
  }, [user]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byQuery = (t) => {
      if (!needle) return true;
      const hay = [t.title, t.summary, t.notes, t.destination?.name, t.mode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    };
    const byMode = (t) => (modeFilter === "all" ? true : (t.mode || "").toLowerCase() === modeFilter);
    const sorted = [...trips].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    return sorted.filter(byQuery).filter(byMode);
  }, [trips, q, modeFilter]);

  if (!user) {
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Your trips</h1>
          <p>Please <Link to="/login">log in</Link> to view your trips.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Your trips</h1>
        <Link
          to="/new"
          className="btn btn-chip btn-lg is-slate"
          style={{ textDecoration: "none" }}
        >
          New Trip
        </Link>
      </header>

      <section className="btn-group" style={{ marginBottom: 8 }}>
        <button onClick={() => setView("gallery")} className={`btn btn-outline ${view === "gallery" ? "is-active" : ""}`}>Gallery</button>
        <button onClick={() => setView("list")} className={`btn btn-outline ${view === "list" ? "is-active" : ""}`}>List</button>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(260px,460px) auto", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, destination, notes…"
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", width: "100%", background: "#fff" }}
        />
        <div className="btn-group" style={{ justifySelf: "end" }}>
          <button onClick={() => setModeFilter("all")} className={`btn btn-chip btn-lg is-slate ${modeFilter === "all" ? "is-active" : ""}`}>All</button>
          <button onClick={() => setModeFilter("walk")} className={`btn btn-chip btn-lg is-green ${modeFilter === "walk" ? "is-active" : ""}`}>Walk</button>
          <button onClick={() => setModeFilter("bike")} className={`btn btn-chip btn-lg is-blue ${modeFilter === "bike" ? "is-active" : ""}`}>Bike</button>
        </div>
      </section>

      {loading ? (
        <p>Loading…</p>
      ) : err ? (
        <div style={{ color: "#b00020", background: "#ffe8ea", padding: "0.6rem 0.8rem", borderRadius: 10 }}>{err}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "1rem", border: "1px dashed #e5e7eb", borderRadius: 12 }}>
          No trips match your filters.
        </div>
      ) : view === "gallery" ? (
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
            listStyle: "none",
            padding: 0,
          }}
        >
          {filtered.map((t) => (
            <li key={t._id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              <Link to={`/trips/${t._id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div style={{ height: 140, background: "#f3f4f6", position: "relative" }}>
                  {t?.image?.src ? (
                    <img
                      src={t.image.src}
                      alt={t.image.alt || t.destination?.name || "Trip"}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#64748b", fontWeight: 700 }}>
                      {t.destination?.name || "Trip"}
                    </div>
                  )}
                  {t.mode ? (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 900,
                        background: t.mode === "bike" ? "rgba(37,99,235,0.12)" : "rgba(5,150,105,0.12)",
                        color: t.mode === "bike" ? "#1d4ed8" : "#059669",
                        border: 0,
                        textTransform: "capitalize",
                      }}
                    >
                      {t.mode}
                    </span>
                  ) : null}
                </div>
                <div style={{ padding: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
                    {t.title || "Untitled trip"}
                  </h3>
                  <p style={{ margin: "6px 0 8px", color: "#475569" }}>
                    {t.destination?.name || "Unknown"}
                    {Number.isFinite(t.total_distance_km) ? ` • ${t.total_distance_km.toFixed(1)} km` : ""}
                    {Array.isArray(t.days) ? ` • ${t.days.length} day${t.days.length > 1 ? "s" : ""}` : ""}
                  </p>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {t.updatedAt || t.createdAt ? new Date(t.updatedAt || t.createdAt).toLocaleDateString() : ""}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) 100px 120px 120px",
              gap: 8,
              padding: "10px 12px",
              fontWeight: 700,
              background: "#f8fafc",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div>Title</div>
            <div>Destination</div>
            <div>Mode</div>
            <div>Distance</div>
            <div>Updated</div>
          </div>

          {filtered.map((t) => (
            <Link
              to={`/trips/${t._id}`}
              key={t._id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) 100px 120px 120px",
                gap: 8,
                padding: "12px",
                textDecoration: "none",
                color: "inherit",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div
                  style={{
                    width: 44,
                    height: 32,
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "#f3f4f6",
                    flex: "0 0 auto",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {t?.image?.src ? (
                    <img
                      src={t.image.src}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div style={{ fontWeight: 700 }}>{t.title || "Untitled trip"}</div>
              </div>

              <div style={{ color: "#475569" }}>{t.destination?.name || "—"}</div>

              <div style={{ textTransform: "capitalize", color: "#111" }}>
                {t.mode || "—"}
              </div>

              <div style={{ color: "#475569" }}>
                {Number.isFinite(t.total_distance_km) ? `${t.total_distance_km.toFixed(1)} km` : "—"}
              </div>

              <div style={{ color: "#6b7280" }}>
                {t.updatedAt || t.createdAt ? new Date(t.updatedAt || t.createdAt).toLocaleDateString() : "—"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
