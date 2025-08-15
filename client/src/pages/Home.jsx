import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "../utils/buttons.css";

export default function Home() {
  const cities = useMemo(
    () => ["Paris", "Tokyo", "New York", "Amsterdam", "London", "Tel Aviv", "Rome", "Lisbon", "Barcelona", "Copenhagen"],
    []
  );

  const [bg, setBg] = useState("");
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  const loadNext = useCallback(async () => {
    const q = cities[idxRef.current % cities.length];
    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(q)}&kind=city&strict=1&sig=${Date.now()}`);
      if (!res.ok) throw new Error("image fetch failed");
      const j = await res.json();
      if (j?.src) setBg(j.src);
    } catch {
      // ignore error
    } finally {
      idxRef.current = (idxRef.current + 1) % cities.length;
    }
  }, [cities]);

  useEffect(() => {
    loadNext();
    timerRef.current = setInterval(loadNext, 7000);
    return () => clearInterval(timerRef.current);
  }, [loadNext]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Hero image section */}
      <div
        style={{
          width: "100%",
          flex: "0 0 70vh",
          position: "relative",
          background: bg
            ? `url(${bg}) center/cover no-repeat`
            : "linear-gradient(180deg,#f5f5f7,#e9e9f1)",
          transition: "background-image 500ms ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.35))",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            color: "#fff",
            maxWidth: 980,
            padding: "0 1.25rem",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 44, fontWeight: 800 }}>Trip Planner</h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: 18, opacity: 0.95 }}>
            Adventure made easy — smart AI routes for your bike and walking trips, all saved for you.
          </p>
        </div>
      </div>

      {/* Start exploring section */}
      <section style={{ textAlign: "center", padding: "2rem 1rem" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Start exploring</h2>
        <p style={{ fontSize: 16, marginBottom: "1.5rem", color: "#334155" }}>
          Generate an itinerary in seconds, preview routes and weather, and save your favorite trips.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link to="/new" className="btn btn-chip btn-lg is-slate">Plan a trip</Link>
          <Link to="/trips" className="btn btn-chip btn-lg is-slate">View trips</Link>
        </div>
      </section>
    </main>
  );
}