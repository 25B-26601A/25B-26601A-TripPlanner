// pages/TripDetails.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import TripMap from "../components/TripMap";
import HeroImage from "../components/HeroImage";
import WeatherCard from "../components/WeatherCard";
import TripSummary from "../components/TripSummary";
import TripItinerary from "../components/TripItinerary";
import TripStepper from "../components/TripStepper";
import "./NewTrip.css";

export default function TripDetails({ trip: tripProp }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [trip, setTrip] = useState(tripProp || null);
  const [err, setErr] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (tripProp) return;
    let on = true;
    async function run() {
      try {
        const t = await api.trips.get(id);
        if (on) setTrip(t);
      } catch (e) {
        if (on) setErr(e.message || "Failed to load trip");
      }
    }
    run();
    return () => { on = false; };
  }, [id, tripProp]);

  async function handleDelete() {
    if (!trip?._id) return;
    const ok = window.confirm("Delete this trip?");
    if (!ok) return;
    setDeleting(true);
    try {
      if (api?.trips?.remove) {
        await api.trips.remove(trip._id);
      } else {
        await fetch(`/api/trips/${trip._id}`, { method: "DELETE" });
      }
      nav("/trips");
    } catch (e) {
      setErr(e.message || "Failed to delete trip");
      setDeleting(false);
    }
  }

  if (err) {
    return (
      <main className="page narrow">
        <div className="alert error">{err}</div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="page narrow">
        <h1 className="h1">Trip</h1>
        <div className="muted">Loading…</div>
      </main>
    );
  }

  const lat0 = trip?.map_points?.[0]?.lat;
  const lon0 = trip?.map_points?.[0]?.lon;
  const placeDescriptions = Array.isArray(trip.place_descriptions) ? trip.place_descriptions : [];

  return (
    <main className="page wide">
      <section className="card">
        <div className="row space">
          <Link to="/trips" className="btn linkish">Back to trips</Link>
          <button className="btn" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete trip"}</button>
        </div>
      </section>

      <section className="card">
        <HeroImage
          src={trip?.image?.src}
          alt={trip?.image?.alt || trip?.destination?.name}
          credit={trip?.image?.credit}
          query={!trip?.image?.src ? trip?.destination?.name : undefined}
          height={280}
        />
      </section>

      <TripSummary trip={trip} />

      <TripMap
        geojson={trip?.route?.geojson}
        points={trip?.map_points}
        days={trip?.days}
        height={360}
      />

      {lat0 && lon0 ? <WeatherCard lat={lat0} lon={lon0} days={3} /> : null}

      <TripStepper days={trip?.days || []} mode={trip?.mode} />

      <TripItinerary days={trip?.days || []} mode={trip?.mode} />

      {Array.isArray(placeDescriptions) && placeDescriptions.length > 0 ? (
        <section className="card">
          <h2 className="h2">Places along the route</h2>
          <ul className="placesList">
            {placeDescriptions.map((p, i) => {
              const name = typeof p === "object" ? p.name || `Stop ${i + 1}` : `Stop ${i + 1}`;
              const summary = typeof p === "object" ? p.summary || "" : String(p || "");
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
    </main>
  );
}
