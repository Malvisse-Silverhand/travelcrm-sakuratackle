"use client";

import { createContext, useContext, useMemo } from "react";
import * as THREE from "three";

/** One boat kit, two looks:
 *  - "faceted": crisp low-poly for the public booking pages, colours kept as
 *    close to the real boats as possible.
 *  - "toon": soft banded shading in the spirit of Flotsam, for the operator's
 *    Harbour HQ.
 *  Components ask for <Mat>, and the nearest <MatStyle> decides which. */
export type MatStyleName = "faceted" | "toon";

const Ctx = createContext<MatStyleName>("faceted");

export function MatStyle({ value, children }: { value: MatStyleName; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMatStyle(): MatStyleName {
  return useContext(Ctx);
}

/** Three-step ramp: shadow, mid, lit. NearestFilter keeps the bands hard,
 *  which is what reads as hand-painted rather than plastic. */
let toonRamp: THREE.DataTexture | null = null;
function getToonRamp(): THREE.DataTexture {
  if (toonRamp) return toonRamp;
  const data = new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
  toonRamp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  toonRamp.minFilter = THREE.NearestFilter;
  toonRamp.magFilter = THREE.NearestFilter;
  toonRamp.needsUpdate = true;
  return toonRamp;
}

type MatProps = {
  color?: string;
  vertexColors?: boolean;
  roughness?: number;
  metalness?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  map?: THREE.Texture | null;
};

export function Mat({
  color,
  vertexColors,
  roughness = 0.8,
  metalness = 0,
  side,
  transparent,
  opacity,
  map,
}: MatProps) {
  const style = useMatStyle();
  const ramp = useMemo(() => (style === "toon" ? getToonRamp() : null), [style]);

  if (style === "toon") {
    return (
      <meshToonMaterial
        color={color}
        vertexColors={vertexColors}
        gradientMap={ramp}
        side={side}
        transparent={transparent}
        opacity={opacity}
        map={map ?? null}
      />
    );
  }
  return (
    <meshStandardMaterial
      color={color}
      vertexColors={vertexColors}
      flatShading
      roughness={roughness}
      metalness={metalness}
      side={side}
      transparent={transparent}
      opacity={opacity}
      map={map ?? null}
    />
  );
}
