"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BoatStageProps } from "./BoatStage";

// three.js and the scene are ~250 KB gzipped, so they never ship with the
// page itself. This wrapper:
// - downloads the scene only once its box is near the viewport,
// - stops the render loop while it is scrolled off screen,
// - shows the boat's photo instead on devices without WebGL or with very
//   little memory (common mid-range Android), and while the scene loads.

const BoatStage = dynamic(() => import("./BoatStage"), { ssr: false });

type Props = BoatStageProps & {
  fallbackSrc?: string | null;
  fallbackAlt: string;
  className?: string;
};

function canRender3D(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return false;
  } catch {
    return false;
  }
  // deviceMemory is Chromium-only; absent means "assume fine".
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return mem === undefined || mem >= 3;
}

// Browser facts read through useSyncExternalStore: null/false on the server,
// the real value on the client, with no effect-then-setState round trip.
let capableCache: boolean | null = null;
const getCapable = () => (capableCache ??= canRender3D());
const noSubscribe = () => () => {};

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function LazyBoatStage({ fallbackSrc, fallbackAlt, className, ...stage }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const capable = useSyncExternalStore(noSubscribe, getCapable, () => null);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false
  );

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // A generous margin starts the download a screen early, so the scene is
    // usually ready by the time it scrolls in.
    const preload = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "600px 0px" }
    );
    const onScreen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    preload.observe(el);
    onScreen.observe(el);
    return () => {
      preload.disconnect();
      onScreen.disconnect();
    };
  }, []);

  const show3D = capable === true && near;

  return (
    // The outer box takes its size and position from the caller's class; the
    // inner one is the positioning context for the photo and the canvas, so
    // a caller's `position: absolute` is never overridden.
    <div ref={box} className={className}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {fallbackSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackSrc}
          alt={fallbackAlt}
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: show3D ? 0 : 1,
            transition: "opacity .6s ease",
          }}
        />
      )}
      {show3D && (
        <div style={{ position: "absolute", inset: 0 }} aria-label={fallbackAlt} role="img">
          <BoatStage {...stage} running={visible} reducedMotion={stage.reducedMotion ?? reduced} />
        </div>
      )}
      </div>
    </div>
  );
}
