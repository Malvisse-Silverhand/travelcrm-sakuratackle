"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { FT, lookFor } from "@/lib/fleet3d/specs";
import Boat from "./Boat";
import Ocean, { SkyDome, oceanUniforms, skyUniforms } from "./Ocean";
import { MatStyle, type MatStyleName } from "./Mat";
import { PALETTES, waveHeight } from "./sea";

export type BoatStageProps = {
  code: string;
  lengthFt?: number | null;
  /** Free text from the boats table, e.g. "16.5 Kaki". */
  beam?: string | null;
  pax: number;
  mode: "night" | "day";
  style?: MatStyleName;
  /** Orbit with mouse/touch. Off for embedded, decorative uses. */
  interactive?: boolean;
  reducedMotion?: boolean;
  /** Stop rendering entirely while off screen. */
  running?: boolean;
};

function beamFt(beam: string | null | undefined, fallback: number): number {
  const n = beam ? parseFloat(beam) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function BoatStage(props: BoatStageProps) {
  const look = lookFor(props.code);
  const L = (props.lengthFt && props.lengthFt > 0 ? props.lengthFt : look.fallback.lengthFt) * FT;
  const B = beamFt(props.beam, look.fallback.beamFt) * FT;
  const dist = L * 1.18;

  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      frameloop={props.running === false ? "never" : "always"}
      camera={{ fov: 32, near: 0.5, far: 1000, position: [dist * 0.72, L * 0.36, dist * 0.78] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <MatStyle value={props.style ?? "faceted"}>
        <Scene {...props} L={L} B={B} />
      </MatStyle>
      {props.interactive && (
        <OrbitControls
          target={[0, 1.3, 0]}
          enablePan={false}
          minDistance={L * 0.55}
          maxDistance={L * 2.3}
          maxPolarAngle={1.42}
          autoRotate={!props.reducedMotion}
          autoRotateSpeed={0.5}
          enableDamping
        />
      )}
    </Canvas>
  );
}

function Scene({
  code,
  pax,
  mode,
  reducedMotion,
  interactive,
  L,
  B,
}: BoatStageProps & { L: number; B: number }) {
  const look = lookFor(code);
  const oceanMesh = useRef<THREE.Mesh>(null);
  const skyMesh = useRef<THREE.Mesh>(null);
  const boat = useRef<THREE.Group>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.Mesh>(null);

  // 1 = night, 0 = day. Eased each frame so switching modes is a dusk or a
  // dawn rather than a cut; reduced motion snaps straight there.
  const blend = useRef(mode === "night" ? 1 : 0);
  const time = useRef(0);
  // Lamp level only changes React state at coarse steps: the lamps' opacity
  // reads it, and re-rendering the boat every frame would be wasteful.
  const [lampStep, setLampStep] = useState(mode === "night" ? 10 : 0);

  useFrame((state, delta) => {
    if (!oceanMesh.current || !skyMesh.current) return;
    const ocean = oceanUniforms(oceanMesh.current);
    const sky = skyUniforms(skyMesh.current);
    ocean.uLampRadius.value = L * 0.42;
    ocean.uFogNear.value = L * 3;
    ocean.uFogFar.value = L * 10;

    const target = mode === "night" ? 1 : 0;
    blend.current = reducedMotion
      ? target
      : THREE.MathUtils.damp(blend.current, target, 2.2, delta);
    const k = blend.current;
    const n = PALETTES.night;
    const d = PALETTES.day;

    if (!reducedMotion) time.current += delta;
    const t = time.current;
    const amp = THREE.MathUtils.lerp(d.amp, n.amp, k);

    ocean.uTime.value = t;
    ocean.uAmp.value = amp;
    ocean.uDeep.value.copy(d.deep).lerp(n.deep, k);
    ocean.uShallow.value.copy(d.shallow).lerp(n.shallow, k);
    ocean.uHorizon.value.copy(d.skyHorizon).lerp(n.skyHorizon, k);
    // The moon's glade at full strength burnt a white wedge across the
    // foreground; half strength keeps the sparkle.
    ocean.uSunColor.value.copy(d.sun).lerp(n.sun, k).multiplyScalar(1 - 0.5 * k);
    ocean.uSunDir.value.copy(d.sunDir).lerp(n.sunDir, k).normalize();
    ocean.uLamp.value = Math.max(0, (k - 0.35) / 0.65) * 0.55;

    sky.uTop.value.copy(d.skyTop).lerp(n.skyTop, k);
    sky.uHorizon.value.copy(d.skyHorizon).lerp(n.skyHorizon, k);
    sky.uBottom.value.copy(d.skyBottom).lerp(n.skyBottom, k);

    if (hemi.current) {
      hemi.current.color.copy(d.hemiSky).lerp(n.hemiSky, k);
      hemi.current.groundColor.copy(d.hemiGround).lerp(n.hemiGround, k);
      hemi.current.intensity = THREE.MathUtils.lerp(d.hemiIntensity, n.hemiIntensity, k);
    }
    if (sun.current) {
      sun.current.position.copy(ocean.uSunDir.value).multiplyScalar(60);
      sun.current.color.copy(d.sun).lerp(n.sun, k);
      sun.current.intensity = THREE.MathUtils.lerp(d.sunIntensity, n.sunIntensity, k);
    }
    const lamp = Math.max(0, (k - 0.35) / 0.65);
    if (moon.current) {
      moon.current.position.copy(ocean.uSunDir.value).multiplyScalar(300);
      moon.current.visible = k > 0.5;
    }
    const step = Math.round(lamp * 10);
    if (step !== lampStep) setLampStep(step);

    // Ride the same waves the water shader draws: sample at bow, stern and
    // both beams, then heave, pitch and roll to match.
    if (boat.current) {
      const bow = waveHeight(L / 2, 0, t, amp);
      const stern = waveHeight(-L / 2, 0, t, amp);
      const port = waveHeight(0, B / 2, t, amp);
      const stbd = waveHeight(0, -B / 2, t, amp);
      boat.current.position.y = (bow + stern + port + stbd) / 4 - 0.05;
      boat.current.rotation.z = Math.atan((bow - stern) / L);
      boat.current.rotation.x = -Math.atan((port - stbd) / B);
    }

    if (!interactive && !reducedMotion) {
      // Decorative mode: a slow drift around the boat instead of user orbit.
      const a = 0.82 + Math.sin(t * 0.12) * 0.22;
      const r = L * 1.35;
      state.camera.position.set(Math.sin(a) * r, L * 0.33, Math.cos(a) * r);
      state.camera.lookAt(0, 1.2, 0);
    } else if (!interactive) {
      state.camera.lookAt(0, 1.2, 0);
    }
  });

  return (
    <>
      <SkyDome ref={skyMesh} />
      <Ocean ref={oceanMesh} />
      {mode === "night" && (
        <Stars radius={220} depth={60} count={1600} factor={3.2} saturation={0} fade speed={reducedMotion ? 0 : 0.5} />
      )}
      <mesh ref={moon}>
        <sphereGeometry args={[7, 16, 12]} />
        <meshBasicMaterial color="#eef1ff" toneMapped={false} />
      </mesh>

      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />

      <group ref={boat}>
        <Boat
          code={code}
          look={look}
          lengthM={L}
          beamM={B}
          pax={pax}
          lampLevel={lampStep / 10}
          foamLevel={0.85 - 0.45 * (lampStep / 10)}
        />
      </group>
    </>
  );
}
