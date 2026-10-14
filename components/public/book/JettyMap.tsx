"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { LOCATIONS, type JettyLocation } from "@/lib/content/booking";
import styles from "./book.module.css";

function pinHtml(l: JettyLocation, on: boolean): string {
  const bg = !l.open ? "#d9d3ec" : on ? "#ffb800" : "#fff";
  const bd = !l.open ? "#9c93bc" : "#2e1d6b";
  const sz = on ? 30 : 22;
  return `<div style="width:${sz}px;height:${sz}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:3px solid ${bd};box-shadow:0 6px 14px rgba(27,20,54,.3)"></div>`;
}

/** The jetties on a small map. Picking a pin does the same as picking the
 *  location in the dropdown, and the map flies to whichever was picked. */
export default function JettyMap({
  selected,
  focus,
  onPick,
}: {
  /** The location trips are being searched from (always an open one). */
  selected: string;
  /** The location last looked at, open or not: where the map flies to. */
  focus: string;
  onPick: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const pickRef = useRef(onPick);

  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  // Built once. Leaflet touches `window` on import, so it loads here rather
  // than at module scope, which keeps the component SSR-safe.
  useEffect(() => {
    let cancelled = false;
    const pins = markers.current;
    let ro: ResizeObserver | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || mapRef.current) return;
      leaflet.current = L;
      const map = L.map(el.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18, attribution: "Tiles &copy; Esri" }
      ).addTo(map);
      for (const l of LOCATIONS) {
        const on = l.id === selected;
        const sz = on ? 30 : 22;
        const mk = L.marker([l.lat, l.lng], {
          icon: L.divIcon({ className: "", iconSize: [sz, sz], iconAnchor: [sz / 2, sz], html: pinHtml(l, on) }),
          title: l.name,
          keyboard: true,
        }).addTo(map);
        mk.bindTooltip(l.open ? l.name : `${l.name} (Coming Soon)`, { direction: "top", offset: [0, -26] });
        mk.on("click", () => pickRef.current(l.id));
        pins.set(l.id, mk);
      }
      map.fitBounds(
        LOCATIONS.map((l) => [l.lat, l.lng] as [number, number]),
        { padding: [24, 24], animate: false }
      );
      mapRef.current = map;
      // The card can change size (dropdowns, container queries); keep the
      // tiles filling it.
      ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      ro.observe(el.current);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      pins.clear();
    };
    // Built once; later changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    if (!L || !mapRef.current) return;
    for (const l of LOCATIONS) {
      const on = l.id === selected;
      const sz = on ? 30 : 22;
      markers.current
        .get(l.id)
        ?.setIcon(L.divIcon({ className: "", iconSize: [sz, sz], iconAnchor: [sz / 2, sz], html: pinHtml(l, on) }));
    }
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    const l = LOCATIONS.find((x) => x.id === focus);
    if (!map || !l) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([l.lat, l.lng], l.open ? 11 : 10, { duration: reduce ? 0 : 0.8, animate: !reduce });
  }, [focus]);

  return (
    <div className={styles.mapBox}>
      <div ref={el} className={styles.mapEl} aria-label="Map of jetty locations" />
      <div className={styles.mapLegend}>
        <span>
          <i className={styles.legendOpen} />
          Open
        </span>
        <span>
          <i className={styles.legendSoon} />
          Coming Soon
        </span>
      </div>
    </div>
  );
}
