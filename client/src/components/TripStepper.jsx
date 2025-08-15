// components/TripStepper.jsx
import { dayColors } from "../utils/colors";

function buildStopsFromDays(days) {
  const names = [];
  const dayIndex = [];
  for (let d = 0; d < (days?.length || 0); d++) {
    const seg = days[d] || {};
    const arr = [seg.start, ...(Array.isArray(seg.waypoints) ? seg.waypoints : []), seg.end].filter(Boolean);
    for (const n of arr) {
      const prev = names[names.length - 1];
      if (prev && String(prev) === String(n)) continue;
      names.push(String(n));
      dayIndex.push(d);
    }
  }
  return { names, dayIndex };
}

export default function TripStepper({ days = [], mode = "walk" }) {
  if (!Array.isArray(days) || days.length === 0) return null;

  const { names: stops, dayIndex } = buildStopsFromDays(days);

  const gap = 12;

  return (
    <div style={{ position: "relative", overflow: "hidden", padding: "8px 4px 2px" }}>
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(88px, 1fr)",
          alignItems: "center",
          gap,
        }}
      >
        {stops.map((label, i) => {
          const dIdx = dayIndex[i] ?? 0;
          const color = dayColors[dIdx % dayColors.length];
          const nextColor =
            i < stops.length - 1 ? dayColors[(dayIndex[i + 1] ?? 0) % dayColors.length] : color;

          return (
            <div
              key={`${label}-${i}`}
              style={{
                position: "relative",
                display: "grid",
                justifyItems: "center",
                alignItems: "center",
                gap: 6,
              }}
            >
              {/* segment from this dot center to next dot center (symmetric) */}
              {i < stops.length - 1 ? (
                <div
                  style={{
                    position: "absolute",
                    top: 7,
                    left: `calc(50% + 1px)`,
                    width: `calc(100% + ${gap}px)`,
                    height: 4,
                    borderRadius: 3,
                    background:
                    dayIndex[i] === dayIndex[i + 1]
                        ? color
                        : nextColor,
                    opacity: 0.9,
                    zIndex: 0,
                  }}
                />
              ) : null}

              {/* dot with inner fill */}
              <div
                title={label}
                style={{
                  position: "relative",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 0 0 2px #fff, 0 0 0 3px rgba(15,23,42,0.08)",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 2,
                    borderRadius: "50%",
                    background: color,
                  }}
                />
              </div>

              {/* label (compact) */}
              <div
                title={label}
                style={{
                  fontSize: "clamp(10px, 1.25vw, 13px)",
                  color: "#334155",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 140,
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
