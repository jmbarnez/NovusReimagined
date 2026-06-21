/** Boost gate mesh shaders — GPU-rendered energy gates with plasma curtain,
 *  glowing pillars, traveling sweep pulses, drifting sparks, proximity
 *  charge-up, and activation flash.
 *
 *  Each gate is a single quad. UV mapping:
 *    u — normalized across the gate width; pillars sit at |u| = 1, the
 *        quad extends slightly beyond (|u| > 1) for the pillar halo.
 *    v — 0..1 across the curtain thickness (boost direction).
 */

export const BOOST_GATE_VERT = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUV;
in float aAlpha;
in float aCharge;
in float aFlash;
in float aSeed;

out vec2 vUV;
out float vAlpha;
out float vCharge;
out float vFlash;
out float vSeed;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
    vAlpha = aAlpha;
    vCharge = aCharge;
    vFlash = aFlash;
    vSeed = aSeed;
}
`;

export const BOOST_GATE_FRAG = `#version 300 es
precision mediump float;

in vec2 vUV;
in float vAlpha;
in float vCharge;
in float vFlash;
in float vSeed;

out vec4 fragColor;

uniform float uTime;

float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float noise1D(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), f);
}

void main() {
    float u = vUV.x;
    float v = vUV.y;
    float vc = (v - 0.5) * 2.0;          // -1..1 across thickness
    float t = uTime * 0.001;
    float seed = vSeed * 97.0;

    // ── Thickness falloff: soft horizontal band ────────────────────────
    float vFalloff = exp(-vc * vc * 4.5);

    // ── Curtain mask: visible between pillars (|u| < 1) ────────────────
    float curtainMask = smoothstep(1.02, 0.82, abs(u));

    // ── Pillar glow at |u| = 1 ────────────────────────────────────────
    float pillarDist = abs(abs(u) - 1.0);
    float pillarGlow = exp(-pillarDist * pillarDist * 10.0);
    float pillarPulse = 0.65 + 0.35 * sin(t * 2.8 + seed);
    float pillarBright = pillarGlow * pillarPulse * vFalloff;

    // ── Energy streams: flowing bands along the width ──────────────────
    float streamPhase = u * 5.5 + t * 2.2 + seed;
    float stream = 0.5 + 0.5 * sin(streamPhase + noise1D(u * 3.0 + t) * 3.0);
    float streamIntensity = stream * curtainMask * vFalloff;

    // ── Central axis glow (boost direction) ────────────────────────────
    float axisGlow = exp(-u * u * 8.0) * vFalloff;

    // ── Traveling sweep pulse ──────────────────────────────────────────
    float sweepPos = sin(t * 0.9 + seed * 1.3) * 1.15;
    float sweep = exp(-((u - sweepPos) * (u - sweepPos)) * 28.0);
    float sweepIntensity = sweep * curtainMask * vFalloff;

    // ── Drifting sparks ────────────────────────────────────────────────
    float sparkSum = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float sT = t * 0.6 + fi * 0.41 + seed;
        float sU = fract(sT) * 2.0 - 1.0;
        float sV = (hash(vec2(fi + 0.5, floor(sT) + seed)) * 2.0 - 1.0) * 0.7;
        float du = u - sU;
        float dv = vc - sV;
        sparkSum += exp(-(du * du + dv * dv * 6.0) * 55.0) * curtainMask;
    }

    // ── Activation flash (radial burst from center) ────────────────────
    float flashFalloff = exp(-(u * u + vc * vc * 0.4) * 2.5);
    float flash = vFlash * vFlash * flashFalloff * 2.5;

    // ── Charge brightening ─────────────────────────────────────────────
    float chargeBoost = 0.45 + vCharge * 1.6;

    // ── Color palette ──────────────────────────────────────────────────
    vec3 baseCol = vec3(0.33, 0.67, 1.0);    // #55aaff
    vec3 hotCol  = vec3(0.88, 0.96, 1.0);    // white-hot

    vec3 col = vec3(0.0);
    col += baseCol * streamIntensity * chargeBoost * 0.5;
    col += baseCol * axisGlow * chargeBoost * 0.35;
    col += mix(baseCol, hotCol, 0.55) * pillarBright * (0.9 + vCharge * 0.4);
    col += hotCol * sweepIntensity * (0.35 + 0.45 * vCharge);
    col += hotCol * sparkSum * 0.7;
    col += hotCol * flash;

    // ── Alpha composite ────────────────────────────────────────────────
    float alpha = vAlpha * (
        streamIntensity * chargeBoost * 0.35 +
        axisGlow * chargeBoost * 0.25 +
        pillarBright * 0.85 +
        sweepIntensity * (0.3 + 0.4 * vCharge) +
        sparkSum * 0.5 +
        flash * 0.7
    );

    if (alpha < 0.004) discard;
    fragColor = vec4(col, alpha);
}
`;
