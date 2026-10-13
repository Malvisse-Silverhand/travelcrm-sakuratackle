"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { WAVE_GLSL } from "./sea";

/** Uniforms the stage animates each frame (time, day/night blend, lamps). */
export type OceanUniforms = {
  uTime: { value: number };
  uAmp: { value: number };
  uDeep: { value: THREE.Color };
  uShallow: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uSunDir: { value: THREE.Vector3 };
  uLamp: { value: number };
  uLampColor: { value: THREE.Color };
  uLampRadius: { value: number };
  uFogNear: { value: number };
  uFogFar: { value: number };
};

export function makeOceanUniforms(): OceanUniforms {
  return {
    uTime: { value: 0 },
    uAmp: { value: 1 },
    uDeep: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uLamp: { value: 0 },
    uLampColor: { value: new THREE.Color("#5dff9c") },
    uLampRadius: { value: 9 },
    uFogNear: { value: 60 },
    uFogFar: { value: 190 },
  };
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmp;
varying vec3 vWorld;
${WAVE_GLSL}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y += waveHeight(w.xz, uTime, uAmp);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Faceted normals from screen-space derivatives give the low-poly look
// without storing per-face normals for a mesh whose vertices move every frame.
const fragmentShader = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uLamp;
uniform vec3 uLampColor;
uniform float uLampRadius;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vWorld;

void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 l = normalize(uSunDir);

  float diff = max(dot(n, l), 0.0);
  vec3 col = mix(uDeep, uShallow, 0.3 + 0.7 * diff);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col = mix(col, uHorizon, fres * 0.5);
  float spec = pow(max(dot(n, normalize(l + v)), 0.0), 60.0);
  col += uSunColor * spec * 0.7;

  // Green pool the candat lamps throw on the water around the boat.
  float r = length(vWorld.xz / vec2(1.6, 1.0));
  col += uLampColor * uLamp * exp(-(r * r) / (uLampRadius * uLampRadius)) * (0.45 + 0.55 * diff);

  float fog = smoothstep(uFogNear, uFogFar, length(vWorld - cameraPosition));
  col = mix(col, uHorizon, fog);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

/** Uniforms of a mesh rendered by <Ocean>, for per-frame updates. Reached
 *  through the mesh ref inside useFrame, so React never sees a memoized value
 *  being mutated. */
export function oceanUniforms(mesh: THREE.Mesh): OceanUniforms {
  return (mesh.material as THREE.ShaderMaterial).uniforms as unknown as OceanUniforms;
}

export function skyUniforms(mesh: THREE.Mesh): SkyUniforms {
  return (mesh.material as THREE.ShaderMaterial).uniforms as unknown as SkyUniforms;
}

export default function Ocean({
  ref,
  size = 420,
  segments = 110,
}: {
  ref?: React.Ref<THREE.Mesh>;
  size?: number;
  segments?: number;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, segments, segments);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [size, segments]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: makeOceanUniforms() as unknown as Record<string, THREE.IUniform>,
        vertexShader,
        fragmentShader,
      }),
    []
  );

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.55)) : mix(uHorizon, uBottom, pow(-h, 0.5));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export type SkyUniforms = {
  uTop: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uBottom: { value: THREE.Color };
};

export function makeSkyUniforms(): SkyUniforms {
  return {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
  };
}

export function SkyDome({ ref }: { ref?: React.Ref<THREE.Mesh> }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: makeSkyUniforms() as unknown as Record<string, THREE.IUniform>,
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    []
  );
  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}
