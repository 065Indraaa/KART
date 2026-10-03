import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Color, RepeatWrapping } from "three";
import { palette } from "../theme";

// Cheap stylised ocean: a large subdivided plane with a few summed-sine swells
// in the vertex stage, a depth gradient (oceanDeep -> ocean), a fresnel sky
// sheen and a scrolling normal map driving a fake sun specular. No reflections,
// no extra render passes — one draw call.

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveHeight;
  uniform float uWaveScale;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // plane is authored in local XY (normal +Z) then rotated flat by the mesh,
    // so the swell is applied along local Z (which becomes world up).
    float s = uWaveScale;
    float w =
        sin(pos.x * s + uTime * 0.6) * 0.5
      + sin(pos.y * s * 1.3 - uTime * 0.5) * 0.35
      + sin((pos.x + pos.y) * s * 2.0 + uTime * 0.9) * 0.15;
    pos.z += w * uWaveHeight;
    vWave = w;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform float uNormalTiling;
  uniform sampler2D uNormalMap;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vWave;

  void main() {
    // Two scrolling normal samples for cheap moving ripple detail.
    vec2 uv1 = vUv * uNormalTiling + vec2(uTime * 0.03, uTime * 0.02);
    vec2 uv2 = vUv * uNormalTiling * 0.5 - vec2(uTime * 0.015, uTime * 0.025);
    vec3 n1 = texture2D(uNormalMap, uv1).rgb * 2.0 - 1.0;
    vec3 n2 = texture2D(uNormalMap, uv2).rgb * 2.0 - 1.0;
    vec3 nrm = normalize(vec3(0.0, 1.0, 0.0) + (n1 + n2) * 0.35);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(viewDir, nrm), 0.0), 3.0);

    // Depth-ish tint driven by swell height.
    float depthMix = smoothstep(-1.0, 1.2, vWave);
    vec3 water = mix(uDeep, uShallow, depthMix);

    // Bright coastal sky sheen on grazing angles.
    vec3 color = mix(water, uSky, clamp(fres, 0.0, 1.0) * 0.6);

    // Fake sun glint off the perturbed normal.
    vec3 sunDir = normalize(vec3(0.4, 0.85, 0.3));
    float spec = pow(max(dot(reflect(-sunDir, nrm), viewDir), 0.0), 60.0);
    color += vec3(1.0, 0.95, 0.8) * spec * 0.8;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const Ocean = ({
  position = [0, -5, 0],
  size = 4000,
  segments = 160,
  waveHeight = 0.7,
  waveScale = 0.02,
  normalTiling = 24,
  shallow = palette.ocean,
  deep = palette.oceanDeep,
  sky = palette.skyHorizon,
  ...props
}) => {
  const matRef = useRef(null);

  const normalMap = useTexture("/textures/normal.jpg");
  normalMap.wrapS = normalMap.wrapT = RepeatWrapping;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaveHeight: { value: waveHeight },
      uWaveScale: { value: waveScale },
      uNormalTiling: { value: normalTiling },
      uShallow: { value: new Color(shallow) },
      uDeep: { value: new Color(deep) },
      uSky: { value: new Color(sky) },
      uNormalMap: { value: normalMap },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
      {...props}
    >
      <planeGeometry args={[size, size, segments, segments]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export default Ocean;
