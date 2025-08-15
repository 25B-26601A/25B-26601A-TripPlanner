// pages/NewTrip.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import TripMap from "../components/TripMap";
import HeroImage from "../components/HeroImage";
import WeatherCard from "../components/WeatherCard";
import TripSummary from "../components/TripSummary";
import TripItinerary from "../components/TripItinerary";
import TripStepper from "../components/TripStepper";
import "./NewTrip.css";

export default function NewTrip() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState("walk");

  const [planning, setPlanning] = useState(false);
  const [planErr, setPlanErr] = useState("");
  const [plan, setPlan] = useState(null);

  const [imageQuery, setImageQuery] = useState("");
  const [hero, setHero] = useState(null);

  const [saveTitle, setSaveTitle] = useState("");
  const [saveSummary, setSaveSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saveOk, setSaveOk] = useState(false);

  async function handlePlan(e) {
    e.preventDefault();
    setPlanErr("");
    setPlanning(true);
    setPlan(null);
    setHero(null);
    try {
      const body = { destination: destination.trim(), notes: notes.trim(), mode, title: "" };
      const p = await api.trips.ai(body);
      setPlan(p);
      const q = p?.destination?.name || destination || "travel";
      setImageQuery(q);
      try {
        const res = await fetch(`/api/images?q=${encodeURIComponent(q)}&kind=city&strict=1`);
        if (res.ok) {
          const img = await res.json();
          if (img?.src) setHero(img);
        }
      } catch {}
      setSaveTitle(p?.title || `Trip to ${q}`);
      setSaveSummary(p?.summary || notes || "");
    } catch (e) {
      setPlanErr(e.message || "Failed to plan trip");
    } finally {
      setPlanning(false);
    }
  }

  function handleCancelAll() {
    setPlanErr("");
    setPlan(null);
    setDestination("");
    setNotes("");
    setMode("walk");
    setHero(null);
    setImageQuery("");
    setSaveTitle("");
    setSaveSummary("");
    setSaveErr("");
    setSaveOk(false);
  }

  async function handleSave() {
    setSaveErr("");
    setSaveOk(false);
    setSaving(true);
    try {
      const title = (saveTitle || plan?.title || "Untitled trip").trim();
      const summary = String(saveSummary || plan?.summary || "").trim().slice(0, 200);
      const joinedNotes = Array.isArray(plan?.notes) ? plan.notes.join(" • ") : String(plan?.notes || "");
      const destObj = plan?.destination?.name ? {
        name: plan.destination.name,
        ...(Number.isFinite(plan.destination.lat) ? { lat: plan.destination.lat } : {}),
        ...(Number.isFinite(plan.destination.lon) ? { lon: plan.destination.lon } : {}),
      } : undefined;
      let image;
      if (hero?.src) image = { src: hero.src, alt: hero.alt || (imageQuery || plan?.destination?.name || "").trim(), credit: hero.credit || null };
      else if (plan?.image?.src) image = plan.image;
      const payload = {
        title,
        summary,
        notes: joinedNotes,
        mode: plan?.mode || "walk",
        destination: destObj,
        image,
        days: Array.isArray(plan?.days) ? plan.days : [],
        map_points: Array.isArray(plan?.map_points) ? plan.map_points : [],
        place_descriptions: Array.isArray(plan?.place_descriptions) ? plan.place_descriptions : [],
        total_distance_km: Number.isFinite(plan?.total_distance_km) ? plan.total_distance_km : null,
        ...(plan?.route ? { route: plan.route } : {}),
      };
      const created = await api.trips.create(payload);
      setSaveOk(true);
      nav(`/trips/${created._id}`);
    } catch (e) {
      setSaveErr(e.message || "Failed to create trip");
    } finally {
      setSaving(false);
    }
  }

  if (!plan) {
    return (
      <main className="page narrow">
        <h1 className="h1">Plan a new trip</h1>
        {planErr && <div className="alert error">{planErr}</div>}
        <form onSubmit={handlePlan} className="grid gap">
          <label className="grid gap-6">
            <span className="label">Destination</span>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g., Tel Aviv" required className="input" />
          </label>
          <label className="grid gap-6">
            <span className="label">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="preferences, highlights, constraints…" rows={4} className="input textarea" />
          </label>
          <label className="grid gap-6">
            <span className="label">Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="input select">
              <option value="walk">Walk</option>
              <option value="bike">Bike</option>
            </select>
          </label>
          <div className="row">
            <button type="submit" disabled={planning} className="btn">{planning ? "Generating…" : "Plan"}</button>
            <button type="button" onClick={handleCancelAll} className="btn">Cancel</button>
          </div>
        </form>
      </main>
    );
  }

  const lat0 = plan?.map_points?.[0]?.lat;
  const lon0 = plan?.map_points?.[0]?.lon;
  const tripForSummary = { ...plan, title: saveTitle || plan.title || (plan.destination?.name ? `Trip to ${plan.destination.name}` : "Trip"), summary: saveSummary || plan.summary || "" };
  const placeDescriptions = Array.isArray(plan.place_descriptions) ? plan.place_descriptions : [];

  return (
    <main className="page wide">
      <section className="planForm">
        <h1 className="h1">Plan a new trip</h1>
        {planErr && <div className="alert error">{planErr}</div>}
        <form onSubmit={handlePlan} className="grid gap max-720">
          <label className="grid gap-6">
            <span className="label">Destination</span>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g., Tel Aviv" required className="input" />
          </label>
          <label className="grid gap-6">
            <span className="label">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="add notes and regenerate…" rows={4} className="input textarea" />
          </label>
          <label className="grid gap-6">
            <span className="label">Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="input select">
              <option value="walk">Walk</option>
              <option value="bike">Bike</option>
            </select>
          </label>
          <div className="row">
            <button type="submit" disabled={planning} className="btn">{planning ? "Generating…" : "Re-generate"}</button>
            <button type="button" onClick={handleCancelAll} className="btn">Reset</button>
          </div>
        </form>
      </section>

      <section className="card">
        <HeroImage src={hero?.src} query={imageQuery} alt={hero?.alt || plan?.destination?.name} credit={hero?.credit} height={280} />
      </section>

      <TripSummary trip={tripForSummary} />

      <TripMap
        geojson={plan?.route?.geojson}
        points={plan?.map_points}
        days={plan?.days}
        height={360}
      />

      {lat0 && lon0 ? <WeatherCard lat={lat0} lon={lon0} days={3} /> : null}

      <TripStepper days={plan?.days || []} mode={plan?.mode} />

      <TripItinerary days={plan?.days || []} mode={plan?.mode} />

      {Array.isArray(placeDescriptions) && placeDescriptions.length > 0 ? (
        <section className="card">
          <h2 className="h2">Places along the route</h2>
          <ul className="placesList">
            {placeDescriptions.map((p, i) => {
              const name = typeof p === "object" ? (p.name || `Stop ${i + 1}`) : `Stop ${i + 1}`;
              const summary = typeof p === "object" ? (p.summary || "") : String(p || "");
              return (
                <li key={i} className="placeItem">
                  <div className="placeName">{name}</div>
                  {summary ? <div className="placeSummary">{summary}</div> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {user ? (
        <section className="card">
          <h2 className="h2">Save</h2>
          {saveErr && <div className="alert error">{saveErr}</div>}
          {saveOk && <div className="alert success">Saved</div>}
          <div className="grid gap">
            <label className="grid gap-6">
              <span className="label">Title</span>
              <input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="Trip title" className="input" />
            </label>
            <label className="grid gap-6">
              <span className="label">Summary</span>
              <textarea value={saveSummary} onChange={(e) => setSaveSummary(e.target.value)} rows={3} placeholder="Short summary" className="input textarea" />
            </label>
            <div className="row">
              <button type="button" onClick={handleSave} disabled={saving} className="btn">{saving ? "Saving…" : "Save trip"}</button>
              <button type="button" onClick={handleCancelAll} className="btn">Cancel</button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
