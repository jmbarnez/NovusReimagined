/** Shared GLSL noise / FBM utilities — inlined into fragment shaders at build time. */
export const NOISE_GLSL = `
float nHash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float nValue(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(nHash(i), nHash(i + vec2(1.0, 0.0)), u.x),
    mix(nHash(i + vec2(0.0, 1.0)), nHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float nFbm4(vec2 p) {
  return nValue(p)       * 0.5333
       + nValue(p * 2.0) * 0.2667
       + nValue(p * 4.0) * 0.1333
       + nValue(p * 8.0) * 0.0667;
}

vec2 nDomainWarp(vec2 p, float strength) {
  vec2 q = vec2(nFbm4(p + vec2(1.7, 9.2)), nFbm4(p + vec2(8.3, 2.8)));
  return p + strength * (q - 0.5);
}
`;
