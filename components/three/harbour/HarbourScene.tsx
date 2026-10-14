"use client";

import { useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { FT, LAMP_GREEN, lookFor } from "@/lib/fleet3d/specs";
import {
  fromCycle,
  lampLevel,
  myMinutes,
  nightBlend,
  sailingState,
  toCycle,
  type BoatPhase,
} from "@/lib/harbour";
import Boat from "../Boat";
import Ocean, { SkyDome, oceanUniforms, skyUniforms } from "../Ocean";
import { Mat, MatStyle } from "../Mat";
import { PALETTES, waveHeight } from "../sea";

export type HarbourBoat = {
  id: string;
  code: string;
  lengthFt: number | null;
  beam: string | null;
  capacity: number;
  /** Booked pax tonight (0 when not sailing). */
  pax: number;
  sailing: boolean;
  weather: boolean;
  blocked: boolean;
};

export type ClockMode = "live" | "play" | "pause";

type Props = {
  boats: HarbourBoat[];
  /** Position in the trip cycle, minutes after 07:30. The scene advances it
   *  every frame; the dashboard reads it for the clock and slider. */
  cycleRef: MutableRefObject<number>;
  /** live: follow Malaysia's clock; play: run a day in under a minute;
   *  pause: hold whatever the slider set. */
  modeRef: MutableRefObject<ClockMode>;
  /** Where the clock stands at mount, for the first render. */
  startCycle: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  running: boolean;
};

/** A whole day of the harbour plays in this many seconds in "play" mode. */
const PLAY_SECONDS = 48;
/** The scene re-renders (crew, lamps) every this many simulated minutes;
 *  movement itself is updated every frame. */
const STEP = 6;

const PIER_Z = 3;

function beamFt(beam: string | null, fallback: number) {
  const n = beam ? parseFloat(beam) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Flotsam-style Jeti Marang: toon-shaded pier and shore, the fleet at its
 *  berths, and the night's trip played out on the operator's clock. */
export default function HarbourScene(props: Props) {
  return (
    <Canvas
      flat
      dpr={[1, 1.5]}
      frameloop={props.running ? "always" : "never"}
      camera={{ fov: 42, near: 1, far: 1200, position: [30, 118, -80] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <MatStyle value="toon">
        <World {...props} />
      </MatStyle>
      <OrbitControls
        target={[0, 0, 40]}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.55}
        maxPolarAngle={1.2}
        enableDamping
      />
    </Canvas>
  );
}

function World({ boats, cycleRef, modeRef, startCycle, selected, onSelect }: Props) {
  const ocean = useRef<THREE.Mesh>(null);
  const sky = useRef<THREE.Mesh>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const time = useRef(0);
  const liveCheck = useRef(0);
  const [step, setStep] = useState(() => Math.floor(startCycle / STEP));

  useFrame((_, delta) => {
    time.current += delta;
    const mode = modeRef.current;
    if (mode === "live") {
      // The wall clock is read twice a second, not every frame.
      liveCheck.current -= delta;
      if (liveCheck.current <= 0) {
        cycleRef.current = toCycle(myMinutes());
        liveCheck.current = 0.5;
      }
    } else if (mode === "play") {
      cycleRef.current = (cycleRef.current + (delta * 1440) / PLAY_SECONDS) % 1440;
    }
    const s = Math.floor(cycleRef.current / STEP);
    if (s !== step) setStep(s);

    if (!ocean.current || !sky.current) return;
    const k = nightBlend(fromCycle(cycleRef.current));
    const d = PALETTES.day;
    const n = PALETTES.night;
    const o = oceanUniforms(ocean.current);
    const sk = skyUniforms(sky.current);
    o.uTime.value = time.current;
    o.uAmp.value = THREE.MathUtils.lerp(d.amp, n.amp, k) * 0.8;
    o.uDeep.value.copy(d.deep).lerp(n.deep, k);
    o.uShallow.value.copy(d.shallow).lerp(n.shallow, k);
    o.uHorizon.value.copy(d.skyHorizon).lerp(n.skyHorizon, k);
    o.uSunColor.value.copy(d.sun).lerp(n.sun, k).multiplyScalar(1 - 0.5 * k);
    o.uSunDir.value.copy(d.sunDir).lerp(n.sunDir, k).normalize();
    o.uLamp.value = 0; // each boat carries its own glow here
    o.uFogNear.value = 190;
    o.uFogFar.value = 420;
    sk.uTop.value.copy(d.skyTop).lerp(n.skyTop, k);
    sk.uHorizon.value.copy(d.skyHorizon).lerp(n.skyHorizon, k);
    sk.uBottom.value.copy(d.skyBottom).lerp(n.skyBottom, k);
    if (hemi.current) {
      hemi.current.color.copy(d.hemiSky).lerp(n.hemiSky, k);
      hemi.current.groundColor.copy(d.hemiGround).lerp(n.hemiGround, k);
      hemi.current.intensity = THREE.MathUtils.lerp(d.hemiIntensity, n.hemiIntensity, k);
    }
    if (sun.current) {
      sun.current.position.copy(o.uSunDir.value).multiplyScalar(100);
      sun.current.color.copy(d.sun).lerp(n.sun, k);
      sun.current.intensity = THREE.MathUtils.lerp(d.sunIntensity, n.sunIntensity, k);
    }
  });

  const minutes = fromCycle(step * STEP);
  const night = nightBlend(minutes) > 0.5;

  return (
    <>
      <SkyDome ref={sky} />
      <Ocean ref={ocean} size={460} segments={120} />
      {night && <Stars radius={260} depth={60} count={1400} factor={3.4} saturation={0} fade speed={0.4} />}
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />

      <Shore />
      <Pier length={Math.max(70, boats.length * 26 + 20)} />

      {boats.map((b, i) => (
        <HarbourBoatView
          key={b.id}
          boat={b}
          berth={i}
          count={boats.length}
          cycleRef={cycleRef}
          step={step}
          time={time}
          selected={selected === b.id}
          onSelect={() => onSelect(b.id)}
        />
      ))}
    </>
  );
}

/** Berth and fishing spot for the i-th boat of n. */
function places(i: number, n: number) {
  const mid = (n - 1) / 2;
  return {
    berth: new THREE.Vector2((i - mid) * 24, PIER_Z + 6),
    sea: new THREE.Vector2((i - mid) * 32, 98 + (i % 2) * 10),
  };
}

function bezier(p0: THREE.Vector2, p1: THREE.Vector2, p2: THREE.Vector2, p3: THREE.Vector2, t: number) {
  const u = 1 - t;
  const pos = new THREE.Vector2()
    .addScaledVector(p0, u * u * u)
    .addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t)
    .addScaledVector(p3, t * t * t);
  const tan = new THREE.Vector2()
    .addScaledVector(new THREE.Vector2().subVectors(p1, p0), 3 * u * u)
    .addScaledVector(new THREE.Vector2().subVectors(p2, p1), 6 * u * t)
    .addScaledVector(new THREE.Vector2().subVectors(p3, p2), 3 * t * t);
  return { pos, tan };
}

function HarbourBoatView({
  boat,
  berth,
  count,
  cycleRef,
  step,
  time,
  selected,
  onSelect,
}: {
  boat: HarbourBoat;
  berth: number;
  count: number;
  cycleRef: MutableRefObject<number>;
  step: number;
  time: MutableRefObject<number>;
  selected: boolean;
  onSelect: () => void;
}) {
  const look = lookFor(boat.code);
  const L = (boat.lengthFt && boat.lengthFt > 0 ? boat.lengthFt : look.fallback.lengthFt) * FT;
  const B = beamFt(boat.beam, look.fallback.beamFt) * FT;
  const group = useRef<THREE.Group>(null);
  const hull = useRef<THREE.Group>(null);
  const { berth: berthPos, sea } = useMemo(() => places(berth, count), [berth, count]);
  const path = useMemo(
    () => ({
      p0: berthPos,
      p1: new THREE.Vector2(berthPos.x + 22, berthPos.y + 22),
      p2: new THREE.Vector2(sea.x, sea.y - 40),
      p3: sea,
    }),
    [berthPos, sea]
  );

  // Coarse state (crew on deck, lamps) follows the re-render step.
  const minutes = fromCycle(step * STEP);
  const phase: BoatPhase = boat.sailing ? sailingState(step * STEP, berth).phase : "docked";
  const lamps = boat.sailing ? lampLevel(phase, minutes) : 0;
  const crew = boat.sailing && phase !== "docked" ? boat.pax : 0;

  useFrame(() => {
    if (!group.current || !hull.current) return;
    const t = time.current;
    let x = berthPos.x;
    let z = berthPos.y;
    let heading = 0;
    if (boat.sailing) {
      const st = sailingState(cycleRef.current, berth);
      if (st.phase === "outbound" || st.phase === "inbound") {
        const { pos, tan } = bezier(path.p0, path.p1, path.p2, path.p3, st.s);
        x = pos.x;
        z = pos.y;
        heading = -Math.atan2(tan.y, tan.x) + (st.phase === "inbound" ? Math.PI : 0);
      } else if (st.phase === "fishing") {
        // Drifting at the lubuk, swinging slowly on the current.
        x = sea.x + Math.sin(t * 0.07 + berth) * 2.5;
        z = sea.y + Math.cos(t * 0.05 + berth) * 2.5;
        heading = -Math.PI / 2 + Math.sin(t * 0.04 + berth) * 0.5;
      } else if (st.phase === "docked" && cycleRef.current > toCycle(6 * 60)) {
        // Back from the night: moored bow-in, the way it came home.
        heading = Math.PI;
      }
    }
    group.current.position.set(x, 0, z);
    group.current.rotation.y = heading;
    // Heave and a little roll on the same waves the water draws.
    const amp = 0.8;
    const bow = waveHeight(x + Math.cos(heading) * L * 0.5, z - Math.sin(heading) * L * 0.5, t, amp);
    const stern = waveHeight(x - Math.cos(heading) * L * 0.5, z + Math.sin(heading) * L * 0.5, t, amp);
    hull.current.position.y = (bow + stern) / 2 - 0.05;
    hull.current.rotation.z = Math.atan((bow - stern) / L);
    hull.current.rotation.x = Math.sin(t * 0.9 + berth) * 0.025;
  });

  return (
    <group ref={group}>
      <group
        ref={hull}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <Boat
          code={boat.code}
          look={look}
          lengthM={L}
          beamM={B}
          pax={crew}
          lampLevel={lamps}
          foamLevel={phase === "outbound" || phase === "inbound" ? 1 : 0.55}
        />
      </group>

      {lamps > 0.01 && <LampGlow radius={L * 0.85} level={lamps} />}
      {(phase === "docked" || phase === "boarding" || phase === "fishing") && (
        <FoamRings radius={L * 0.62} seed={berth} />
      )}
      {selected && <SelectRing radius={L * 0.75} />}
      {boat.weather && <StormCloud height={L * 0.55 + 9} />}

      <Label
        text={`${boat.code}${
          boat.sailing ? ` · ${boat.pax} pax` : boat.weather ? " · weather" : boat.blocked ? " · blocked" : ""
        }`}
        selected={selected}
        height={L * 0.32 + 7}
        onSelect={onSelect}
      />
    </group>
  );
}

/** Name tag over a boat: text drawn to a canvas on a sprite, so it always
 *  faces the camera and stays inside the WebGL scene (no DOM per boat). */
function Label({
  text,
  selected,
  height,
  onSelect,
}: {
  text: string;
  selected: boolean;
  height: number;
  onSelect: () => void;
}) {
  const { texture, aspect } = useMemo(() => {
    const scale = 2;
    const font = `700 ${26 * scale}px Inter, system-ui, sans-serif`;
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width) + 36 * scale;
    const h = 46 * scale;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.fillStyle = selected ? "#ffb800" : "rgba(31, 26, 46, 0.86)";
    g.beginPath();
    g.roundRect(0, 0, w, h, h / 2);
    g.fill();
    g.font = font;
    g.fillStyle = selected ? "#1f1a2e" : "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + scale);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: w / h };
  }, [text, selected]);

  // Fixed on-screen size (sizeAttenuation off): a boat out at the lubuk
  // keeps a tag as readable as one at the pier. Units are view-height based.
  const size = 0.034;
  return (
    <sprite
      position={[0, height, 0]}
      scale={[size * aspect, size, 1]}
      renderOrder={10}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <spriteMaterial
        map={texture}
        sizeAttenuation={false}
        depthTest={false}
        transparent
        toneMapped={false}
      />
    </sprite>
  );
}

/** Green pool the candat lamps throw on the water. */
function LampGlow({ radius, level }: { radius: number; level: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]} renderOrder={2}>
      <circleGeometry args={[radius, 32]} />
      <meshBasicMaterial
        color={LAMP_GREEN}
        transparent
        opacity={0.32 * level}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Flotsam's lazy foam rings: two rings swell and fade around a resting boat. */
function FoamRings({ radius, seed }: { radius: number; seed: number }) {
  const rings = useRef<Array<THREE.Mesh | null>>([]);
  useFrame(({ clock }) => {
    rings.current.forEach((m, i) => {
      if (!m) return;
      const p = (clock.elapsedTime / 3.2 + i * 0.5 + seed * 0.13) % 1;
      m.scale.setScalar(1 + p * 0.7);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - p);
    });
  });
  return (
    <>
      {[0, 1].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            rings.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.25, 0]}
          renderOrder={2}
        >
          <ringGeometry args={[radius, radius + 0.45, 48]} />
          <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function SelectRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.35, 0]} renderOrder={3}>
      <ringGeometry args={[radius, radius + 0.8, 56]} />
      <meshBasicMaterial color="#ffb800" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Weather hold: a low grey cloud and rain over the berth. */
function StormCloud({ height }: { height: number }) {
  const cloud = useRef<THREE.Group>(null);
  const drops = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cloud.current) cloud.current.position.y = height + Math.sin(t * 0.8) * 0.4;
    drops.current?.children.forEach((d, i) => {
      d.position.y = height - 1 - (((t * 9 + i * 1.7) % 9) as number);
    });
  });
  const puffs: Array<[number, number, number, number]> = [
    [0, 0, 0, 3.6],
    [3.4, -0.4, 0.6, 2.8],
    [-3.2, -0.3, -0.4, 2.9],
    [1.2, 1.2, -1, 2.4],
  ];
  return (
    <>
      <group ref={cloud} position={[0, height, 0]}>
        {puffs.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <dodecahedronGeometry args={[r, 0]} />
            <Mat color="#6f7486" />
          </mesh>
        ))}
      </group>
      <group ref={drops}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} position={[((i * 37) % 9) - 4.5, height, ((i * 53) % 7) - 3.5]}>
            <boxGeometry args={[0.08, 1.1, 0.08]} />
            <meshBasicMaterial color="#b9d4ff" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Jeti Marang's timber pier: deck, posts and a little shed at the root. */
function Pier({ length }: { length: number }) {
  const posts = useMemo(() => {
    const out: number[] = [];
    for (let x = -length / 2; x <= length / 2; x += 6) out.push(x);
    return out;
  }, [length]);
  return (
    <group>
      <mesh position={[0, 1.1, PIER_Z - 1.5]}>
        <boxGeometry args={[length, 0.5, 4]} />
        <Mat color="#b5844f" />
      </mesh>
      {/* walkway from the shore */}
      <mesh position={[0, 1.1, -6]}>
        <boxGeometry args={[4, 0.5, 13]} />
        <Mat color="#a8784a" />
      </mesh>
      {posts.map((x) => (
        <mesh key={x} position={[x, -0.6, PIER_Z + 0.4]}>
          <cylinderGeometry args={[0.32, 0.32, 4, 6]} />
          <Mat color="#6b4a2c" />
        </mesh>
      ))}
      {/* bollards the boats tie up to */}
      {posts.filter((_, i) => i % 2 === 0).map((x) => (
        <mesh key={`b${x}`} position={[x, 1.75, PIER_Z]}>
          <cylinderGeometry args={[0.28, 0.34, 0.8, 8]} />
          <Mat color="#2f2a3a" />
        </mesh>
      ))}
    </group>
  );
}

function Palm({ position, lean }: { position: [number, number, number]; lean: number }) {
  return (
    <group position={position} rotation={[0, lean * 2, lean]}>
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[0.28, 0.42, 7, 6]} />
        <Mat color="#8a6440" />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, 7, 0]} rotation={[0.9, (i / 5) * Math.PI * 2, 0]}>
          <coneGeometry args={[0.9, 4.2, 4]} />
          <Mat color="#3f9d4f" />
        </mesh>
      ))}
    </group>
  );
}

/** Sand, a strip of grass, palms and the jetty office (Sakura purple roof). */
function Shore() {
  return (
    <group>
      <mesh position={[0, -0.4, -40]}>
        <boxGeometry args={[320, 2.4, 56]} />
        <Mat color="#ecd9a6" />
      </mesh>
      <mesh position={[0, 0.85, -58]}>
        <boxGeometry args={[320, 0.2, 22]} />
        <Mat color="#7cbf5a" />
      </mesh>
      <group position={[10, 0.8, -22]}>
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[12, 4.4, 7]} />
          <Mat color="#f5f2fe" />
        </mesh>
        <mesh position={[0, 5.4, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[8.6, 2.6, 4]} />
          <Mat color="#2e1d6b" />
        </mesh>
        <mesh position={[0, 2, 3.55]}>
          <boxGeometry args={[2.4, 3, 0.1]} />
          <Mat color="#ffb800" />
        </mesh>
      </group>
      <Palm position={[-24, 0.8, -20]} lean={0.12} />
      <Palm position={[-40, 0.8, -28]} lean={-0.1} />
      <Palm position={[34, 0.8, -26]} lean={0.15} />
      <Palm position={[52, 0.8, -18]} lean={-0.12} />
      <Palm position={[-62, 0.8, -22]} lean={0.08} />
    </group>
  );
}
