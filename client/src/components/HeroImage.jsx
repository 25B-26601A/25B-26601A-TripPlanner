import { useEffect, useState } from "react";
import { api } from "../utils/api";

export default function HeroImage({
  query,
  src,
  alt,
  credit,                   // <-- NEW
  className = "",
  style = {},
  height = 260
}) {
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  // If src is provided, skip fetching; otherwise fetch by query
  useEffect(() => {
    if (src) return;
    let on = true;
    async function run() {
      if (!query) { setPhoto(null); return; }
      setLoading(true);
      try {
        const res = await api.images.pick(query);
        if (on) setPhoto(res || null);
      } catch {
        if (on) setPhoto(null);
      } finally {
        if (on) setLoading(false);
      }
    }
    run();
    return () => { on = false; };
  }, [query, src]);

  const photoSrc = src || photo?.src;
  const photoAlt = alt || photo?.alt || query || "Trip photo";

  // Prefer explicit credit prop when src is given; else use fetched photo credit
  const cred = src ? credit : (photo?.credit || credit);

  return (
    <figure
      className={className}
      style={{
        height,
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        background: "linear-gradient(180deg,#f5f5f7, #ececf1)",
        ...style,
      }}
    >
      {photoSrc ? (
        <img
          src={photoSrc}
          alt={photoAlt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            color: "#666",
            fontWeight: 700,
          }}
        >
          {loading ? "Loading image…" : (query || "Image")}
        </div>
      )}

      {/* Credits badge (shows if we have credit either from prop or fetched) */}
      {cred && (cred.provider || cred.author || cred.username) ? (
        <figcaption
          style={{
            position: "absolute",
            right: 10,
            bottom: 8,
            background: "rgba(0,0,0,0.48)",
            color: "#fff",
            fontSize: 12,
            borderRadius: 8,
            padding: "4px 8px",
            display: "flex",
            gap: 8,
            alignItems: "center",
            maxWidth: "90%",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
          title={`${cred.provider || "Photo"} • ${cred.author || cred.username || "Source"}`}
        >
          {/* Photographer / provider link (if available) */}
          {cred.link ? (
            <a
              href={cred.link}
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {cred.provider || "Photo"} • {cred.author || cred.username || "Source"}
            </a>
          ) : (
            <span>
              {cred.provider || "Photo"} • {cred.author || cred.username || "Source"}
            </span>
          )}

          {/* Direct image/source link if provided (opens original) */}
          {cred.source ? (
            <a
              href={cred.source}
              target="_blank"
              rel="noreferrer"
              aria-label="Open original image"
              title="Open original image"
              style={{
                color: "inherit",
                textDecoration: "underline",
                opacity: 0.9
              }}
            >
              image
            </a>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}