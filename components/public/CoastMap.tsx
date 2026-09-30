"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AREAS,
  BASE,
  CATEGORIES,
  SPOTS,
  type AreaId,
  type Spot,
  type SpotCategory,
} from "@/lib/content/terengganu";
import styles from "@/app/destinasi/destinasi.module.css";

const ALL_CATEGORIES = Object.keys(CATEGORIES) as SpotCategory[];

/** Spots whose natural next step is booking the trip itself. */
const BOOKABLE: SpotCategory[] = ["jeti", "lubuk"];

/** Straight-line distance, so the label never pretends to be a drive time. */
function kmFromBase(s: Spot): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(s.lat - BASE.lat);
  const dLng = toRad(s.lng - BASE.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(BASE.lat)) * Math.cos(toRad(s.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function mapsHref(s: Spot): string {
  return (
    s.mapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
  );
}

export default function CoastMap({ waNumber }: { waNumber: string }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<Map<string, Layer>>(new Map());

  const [ready, setReady] = useState(false);
  const [cats, setCats] = useState<SpotCategory[]>(ALL_CATEGORIES);
  const [area, setArea] = useState<AreaId | "semua">("marang");
  const [activeId, setActiveId] = useState<string>("jeti-marang");
  const [plan, setPlan] = useState<string[]>([]);

  const visible = useMemo(
    () =>
      SPOTS.filter(
        (s) => cats.includes(s.category) && (area === "semua" || s.area === area)
      ),
    [cats, area]
  );
  const active = SPOTS.find((s) => s.id === activeId) ?? null;

  // Build the map once. Leaflet touches `window` on import, so it is loaded
  // here rather than at module scope, which keeps this component SSR-safe.
  useEffect(() => {
    let cancelled = false;
    const layers = layersRef.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;

      const map = L.map(mapEl.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([BASE.lat + 0.02, BASE.lng + 0.04], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      for (const s of SPOTS) {
        const color = CATEGORIES[s.category].color;
        const layer = s.radiusM
          ? L.circle([s.lat, s.lng], {
              radius: s.radiusM,
              color,
              weight: 2,
              dashArray: "6 6",
              fillColor: color,
              fillOpacity: 0.18,
            })
          : L.marker([s.lat, s.lng], {
              title: s.name,
              icon: L.divIcon({
                className: "",
                html: `<span class="${styles.pin}" style="--pin:${color}"><i></i></span>`,
                iconSize: [30, 30],
                iconAnchor: [15, 28],
              }),
            });
        layer.on("click", () => setActiveId(s.id));
        layers.set(s.id, layer);
      }

      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layers.clear();
    };
  }, []);

  // Show only the layers that pass the filters, then frame them.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const ids = new Set(visible.map((s) => s.id));
    layersRef.current.forEach((layer, id) => {
      if (ids.has(id)) layer.addTo(map);
      else layer.remove();
    });
    if (visible.length > 1) {
      map.fitBounds(
        visible.map((s) => [s.lat, s.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 12 }
      );
    } else if (visible.length === 1) {
      map.setView([visible[0].lat, visible[0].lng], 12);
    }
  }, [ready, visible]);

  // Area cards elsewhere on the page link to #peta-<area>.
  useEffect(() => {
    const onHash = () => {
      const m = window.location.hash.match(/^#peta-(\w+)$/);
      const id = m?.[1] as AreaId | undefined;
      if (id && AREAS.some((a) => a.id === id)) {
        setArea(id);
        setCats(ALL_CATEGORIES);
        const first = SPOTS.find((s) => s.area === id);
        if (first) setActiveId(first.id);
        document.getElementById("peta")?.scrollIntoView({ behavior: "smooth" });
      }
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const focus = (s: Spot) => {
    setActiveId(s.id);
    mapRef.current?.flyTo([s.lat, s.lng], s.radiusM ? 11 : 13, { duration: 0.8 });
  };

  const toggleCat = (c: SpotCategory) =>
    setCats((prev) =>
      prev.includes(c)
        ? prev.length === 1
          ? prev // never filter the map down to nothing
          : prev.filter((x) => x !== c)
        : [...prev, c]
    );

  const togglePlan = (id: string) =>
    setPlan((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const planSpots = plan
    .map((id) => SPOTS.find((s) => s.id === id))
    .filter((s): s is Spot => Boolean(s));
  const waPlanHref = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(
    `Salam, saya nak tempah trip candat sotong dari Jeti Marang.\n\nPelan saya di Terengganu:\n${planSpots
      .map((s, i) => `${i + 1}. ${s.name}`)
      .join("\n")}`
  )}`;

  return (
    <div className={styles.mapShell}>
      <div className={styles.mapToolbar}>
        <div className={styles.areaTabs} role="tablist" aria-label="Kawasan">
          <button
            type="button"
            role="tab"
            aria-selected={area === "semua"}
            className={`${styles.areaTab} ${area === "semua" ? styles.areaTabOn : ""}`}
            onClick={() => setArea("semua")}
          >
            Semua
          </button>
          {AREAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={area === a.id}
              className={`${styles.areaTab} ${area === a.id ? styles.areaTabOn : ""}`}
              onClick={() => setArea(a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>
        <div className={styles.catChips} aria-label="Tapis kategori">
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cats.includes(c)}
              className={`${styles.catChip} ${cats.includes(c) ? styles.catChipOn : ""}`}
              style={{ ["--pin" as string]: CATEGORIES[c].color }}
              onClick={() => toggleCat(c)}
            >
              <i />
              {CATEGORIES[c].label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.mapGrid}>
        <div className={styles.mapCanvasWrap}>
          <div ref={mapEl} className={styles.mapCanvas} aria-label="Peta persisiran Terengganu" />
          {!ready && <div className={styles.mapLoading}>Memuatkan peta…</div>}

          {active && (
            <div className={styles.spotCard}>
              <span
                className={styles.spotBadge}
                style={{ ["--pin" as string]: CATEGORIES[active.category].color }}
              >
                {CATEGORIES[active.category].label}
              </span>
              <div className={styles.spotName}>{active.name}</div>
              <p className={styles.spotBlurb}>{active.blurb}</p>
              {active.id !== "jeti-marang" && (
                <div className={styles.spotDist}>
                  ± {Math.round(kmFromBase(active))} km dari Jeti Marang (garis lurus)
                </div>
              )}
              <div className={styles.spotActions}>
                {BOOKABLE.includes(active.category) ? (
                  <a href="#tempah" className={styles.btnGold}>
                    Tempah trip candat
                  </a>
                ) : (
                  <button
                    type="button"
                    className={styles.btnGold}
                    onClick={() => togglePlan(active.id)}
                  >
                    {plan.includes(active.id) ? "✓ Dalam pelan" : "+ Tambah ke pelan"}
                  </button>
                )}
                <a
                  href={mapsHref(active)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnGhost}
                >
                  Google Maps
                </a>
              </div>
            </div>
          )}
        </div>

        <aside className={styles.spotList} aria-label="Senarai lokasi">
          <div className={styles.spotListHead}>
            {visible.length} lokasi
          </div>
          <ul>
            {visible.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`${styles.spotRow} ${s.id === activeId ? styles.spotRowOn : ""}`}
                  onClick={() => focus(s)}
                >
                  <i
                    className={styles.spotDot}
                    style={{ ["--pin" as string]: CATEGORIES[s.category].color }}
                  />
                  <span className={styles.spotRowText}>
                    <b>{s.name}</b>
                    <small>
                      {CATEGORIES[s.category].label}
                      {s.id !== "jeti-marang" && ` · ${Math.round(kmFromBase(s))} km`}
                    </small>
                  </span>
                  {plan.includes(s.id) && <span className={styles.spotPlanned}>✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className={styles.planBar}>
        <div>
          <div className={styles.planTitle}>Pelan Trip Saya</div>
          {planSpots.length === 0 ? (
            <div className={styles.planEmpty}>
              Tekan lokasi di peta dan “Tambah ke pelan” untuk susun cuti anda di sekitar
              trip candat.
            </div>
          ) : (
            <div className={styles.planChips}>
              <span className={styles.planChipFixed}>Trip candat · Jeti Marang</span>
              {planSpots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.planChip}
                  onClick={() => togglePlan(s.id)}
                  aria-label={`Buang ${s.name} dari pelan`}
                >
                  {s.name} ✕
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.planActions}>
          <a href="#tempah" className={styles.btnGold}>
            Semak tarikh kosong
          </a>
          {planSpots.length > 0 && (
            <a
              href={waPlanHref}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnWa}
            >
              Hantar pelan via WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
