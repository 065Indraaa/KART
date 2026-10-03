    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform float exposure;
    varying vec3 vWorldNormal;

    vec3 toneMap(vec3 color) {
      return vec3(1.0) - exp(-color * exposure);
    }

    void main() {
      // color1 = bright cyan-white horizon, color2 = deep blue zenith.
      float h = vWorldNormal.y;

      // Main vertical gradient: horizon band sits a touch below eye level so the
      // ocean reads against a bright sky, zenith deepens toward tropical blue.
      float t = smoothstep(-0.12, 0.72, h);
      vec3 color = mix(color1, color2, t);

      // Hazy coastal glow hugging the horizon line for depth and readability.
      float band = 1.0 - smoothstep(0.0, 0.35, abs(h));
      color += color1 * band * 0.5;

      // Keep the HDR multiply so the sky stays bloom-friendly.
      color *= 5.;

      gl_FragColor = vec4(color, 1.0);
    }
