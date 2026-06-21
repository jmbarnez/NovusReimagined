/** Boost gate mesh shaders — GPU-rendered energy gates with a clean, sleek
 *  plasma curtain, crisp pillar nodes, sharp traveling sparks, and a
 *  minimal short warp flash on pass-through.
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

void main() {
    float u = vUV.x;
    float v = vUV.y;
    float vc = (v - 0.5) * 2.0;          // -1..1 across thickness
    float t = uTime * 0.001;
    float seed = vSeed * 97.0;

    // ── Thin, crisp curtain band ──────────────────────────────────────
    // Tighter falloff for a sleeker, more defined energy sheet
    float vFalloff = exp(-vc * vc * 14.0);

    // ── Curtain mask: clean edge between pillars ──────────────────────
    float curtainMask = smoothstep(1.0, 0.9, abs(u));

    // ── Crisp pillar nodes at |u| = 1 ─────────────────────────────────
    // Sharp defined dots with minimal halo
    float pillarDist = abs(abs(u) - 1.0);
    float pillarCore = exp(-pillarDist * pillarDist * 40.0);
    float pillarHalo = exp(-pillarDist * pillarDist * 8.0) * 0.25;
    float pillarPulse = 0.7 + 0.3 * sin(t * 3.0 + seed);
    float pillarBright = (pillarCore + pillarHalo) * pillarPulse * vFalloff;

    // ── Clean energy streams: subtle flowing bands ────────────────────
    // Fewer, smoother streams for a sleek look
    float streamPhase = u * 4.0 + t * 1.8 + seed;
    float stream = 0.5 + 0.5 * sin(streamPhase);
    stream = pow(stream, 2.5);   // sharpen: dark troughs, bright peaks
    float streamIntensity = stream * curtainMask * vFalloff;

    // ── Thin central axis line ────────────────────────────────────────
    float axisGlow = exp(-u * u * 22.0) * vFalloff;

    // ── Sharp traveling sparks (crisp point particles) ────────────────
    // Tighter gaussian for sharper dots, more sparks for a lively feel
    float sparkSum = 0.0;
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float sT = t * 0.8 + fi * 0.27 + seed;
        float sU = fract(sT) * 2.0 - 1.0;
        float sV = (hash(vec2(fi + 0.5, floor(sT) + seed)) * 2.0 - 1.0) * 0.5;
        float du = u - sU;
        float dv = vc - sV;
        // Very tight gaussian = sharp point
        sparkSum += exp(-(du * du + dv * dv) * 180.0) * curtainMask;
    }

    // ── Minimal short warp flash ──────────────────────────────────────
    // Tight radial falloff, low intensity — a brief shimmer, not a blaze
    float flashFalloff = exp(-(u * u + vc * vc * 0.5) * 6.0);
    float flash = vFlash * vFlash * flashFalloff * 0.35;

    // ── Charge brightening (subtle) ───────────────────────────────────
    float chargeBoost = 0.4 + vCharge * 0.8;

    // ── Color palette ──────────────────────────────────────────────────
    vec3 baseCol = vec3(0.33, 0.67, 1.0);    // #55aaff
    vec3 hotCol  = vec3(0.85, 0.94, 1.0);    // white-hot

    vec3 col = vec3(0.0);
    col += baseCol * streamIntensity * chargeBoost * 0.35;
    col += baseCol * axisGlow * chargeBoost * 0.2;
    col += mix(baseCol, hotCol, 0.6) * pillarBright * (0.7 + vCharge * 0.3);
    col += hotCol * sparkSum * 0.9;
    col += hotCol * flash;

    // ── Alpha composite ────────────────────────────────────────────────
    float alpha = vAlpha * (
        streamIntensity * chargeBoost * 0.2 +
        axisGlow * chargeBoost * 0.12 +
        pillarBright * 0.7 +
        sparkSum * 0.55 +
        flash * 0.4
    );

    if (alpha < 0.004) discard;
    fragColor = vec4(col, alpha);
}
`;
