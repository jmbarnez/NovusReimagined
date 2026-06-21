/** Warp gate mesh shaders — GPU-rendered circular warp portals.
 *
 *  Each gate is a single quad. The fragment shader draws:
 *    - A solid metallic hull ring with segment divisions and edge highlights
 *    - A swirling vortex portal interior with spiral arms and depth gradient
 *    - Concentric counter-rotating dashed rings
 *    - Charging energy arcs (lightning from rim to center)
 *    - Orbiting spark particles
 *    - A pulsing bright core
 *    - An outer rim halo
 *
 *  UV mapping: centered at the gate, -1..1 maps to the gate radius.
 *  The quad extends slightly beyond r=1 for the rim halo.
 */

export const WARP_GATE_VERT = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUV;
in vec3 aColorHull;
in vec3 aColorPortal;
in vec3 aColorCore;
in float aAlpha;
in float aCharge;
in float aState;
in float aSpin;
in float aSeed;

out vec2 vUV;
out vec3 vColorHull;
out vec3 vColorPortal;
out vec3 vColorCore;
out float vAlpha;
out float vCharge;
out float vState;
out float vSpin;
out float vSeed;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
    vColorHull = aColorHull;
    vColorPortal = aColorPortal;
    vColorCore = aColorCore;
    vAlpha = aAlpha;
    vCharge = aCharge;
    vState = aState;
    vSpin = aSpin;
    vSeed = aSeed;
}
`;

export const WARP_GATE_FRAG = `#version 300 es
precision mediump float;

${/* Inline noise utilities (same as noise.glsl.ts) */ ""}
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
    return nValue(p) * 0.5333
         + nValue(p * 2.0) * 0.2667
         + nValue(p * 4.0) * 0.1333
         + nValue(p * 8.0) * 0.0667;
}

in vec2 vUV;
in vec3 vColorHull;
in vec3 vColorPortal;
in vec3 vColorCore;
in float vAlpha;
in float vCharge;
in float vState;
in float vSpin;
in float vSeed;

out vec4 fragColor;

uniform float uTime;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float hash1(float x) {
    return nHash(vec2(x, vSeed * 97.0));
}

void main() {
    vec2 uv = vUV;
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    float thetaNorm = theta / TAU + 0.5;   // 0..1
    float t = uTime * 0.001;
    float seed = vSeed * 113.0;
    float charge = vCharge;
    float isDormant = step(vState, 0.5);
    float isPrimed = step(abs(vState - 1.0), 0.5);
    float isActive = step(2.5, vState);    // active or cooldown

    vec3 col = vec3(0.0);
    float alpha = 0.0;

    // ════════════════════════════════════════════════════════════════════
    // 1. PORTAL INTERIOR (r < 0.92) — swirling vortex
    // ════════════════════════════════════════════════════════════════════
    float portalMask = smoothstep(0.92, 0.86, r);

    if (portalMask > 0.001) {
        // Swirl: rotate theta more at smaller r for a vortex pull
        float swirlAmt = 2.5 + charge * 4.0;
        float swirledTheta = theta + swirlAmt * (1.0 - r) + t * (1.5 + charge * 3.0) + seed;

        // Domain-warped noise for turbulent vortex
        vec2 polar = vec2(swirledTheta * 1.5, r * 4.0 + t * 0.8);
        vec2 warped = polar + vec2(nFbm4(polar + vec2(1.7, 9.2)), nFbm4(polar + vec2(8.3, 2.8))) * 0.4;
        float vortexNoise = nFbm4(warped * 1.5);

        // Spiral arms
        float spiralFreq = 3.0;
        float spiral = 0.5 + 0.5 * sin(swirledTheta * spiralFreq + log(max(r, 0.01)) * 4.0);
        float spiralBright = pow(spiral, 3.0) * (0.4 + charge * 0.6);

        // Depth gradient: dark at edge, bright at center
        float depth = 1.0 - smoothstep(0.0, 0.9, r);

        // Portal color gradient
        vec3 portalCol = mix(vColorPortal * 0.3, vColorPortal, vortexNoise * 0.7 + 0.3);
        portalCol = mix(portalCol, vColorCore, depth * 0.6);
        portalCol += vColorCore * spiralBright * 0.5;

        // Brightness scales with state
        float portalBright = (0.25 + isPrimed * 0.2 + charge * 0.6) * (0.6 + vortexNoise * 0.4);

        col += portalCol * portalBright * portalMask;
        alpha += portalBright * portalMask * 0.7;
    }

    // ════════════════════════════════════════════════════════════════════
    // 2. CONCENTRIC DASHED RINGS (counter-rotating)
    // ════════════════════════════════════════════════════════════════════

    // Outer ring at r ≈ 0.82
    {
        float ringR = 0.82;
        float ringBand = exp(-pow(r - ringR, 2.0) * 600.0);
        float spin1 = vSpin + t * 0.4;
        float dashes = 8.0;
        float dashFrac = fract(thetaNorm * dashes + spin1 * 0.1);
        float dashMask = smoothstep(0.4, 0.35, dashFrac) * step(dashFrac, 0.6);
        float ring1 = ringBand * dashMask * (0.4 + charge * 0.4);
        col += vColorHull * ring1 * 0.8;
        alpha += ring1 * 0.5;
    }

    // Inner ring at r ≈ 0.58 (counter-rotating)
    {
        float ringR = 0.58;
        float ringBand = exp(-pow(r - ringR, 2.0) * 800.0);
        float spin2 = -vSpin * 0.6 - t * 0.3;
        float dashes = 6.0;
        float dashFrac = fract(thetaNorm * dashes + spin2 * 0.1);
        float dashMask = smoothstep(0.5, 0.45, dashFrac) * step(dashFrac, 0.5);
        float ring2 = ringBand * dashMask * (0.3 + charge * 0.35);
        col += vColorPortal * ring2 * 0.9;
        alpha += ring2 * 0.4;
    }

    // ════════════════════════════════════════════════════════════════════
    // 3. SOLID HULL RING (r ≈ 0.92–1.0) — metallic segmented structure
    // ════════════════════════════════════════════════════════════════════
    {
        float hullInner = 0.92;
        float hullOuter = 1.0;
        float hullBand = smoothstep(hullInner, hullInner + 0.015, r) * smoothstep(hullOuter, hullOuter - 0.015, r);

        // Segment divisions — 12 segments with gaps
        float segments = 12.0;
        float segCoord = thetaNorm * segments;
        float segFrac = fract(segCoord);
        float segGap = smoothstep(0.03, 0.0, segFrac) + smoothstep(0.97, 1.0, segFrac);
        float segMask = 1.0 - segGap;

        // Major/minor segment distinction (every 3rd is major)
        float majorPhase = step(0.5, sin(theta * segments / 3.0));
        float segBrightness = mix(0.7, 1.0, majorPhase);

        // Metallic shading — light from one side
        float metallic = 0.6 + 0.4 * (0.5 + 0.5 * sin(theta + 1.0));

        // Edge highlights — bright glow at inner edge
        float innerEdge = exp(-pow(r - hullInner, 2.0) * 3000.0);
        float outerEdge = exp(-pow(r - hullOuter, 2.0) * 3000.0);

        // Hull color: dark metal base with color tint
        vec3 hullBase = vColorHull * 0.25 * metallic;
        vec3 hullGlow = vColorHull * (innerEdge * (0.6 + charge * 0.8) + outerEdge * 0.3);

        float hullAlpha = hullBand * segMask * (0.85 + charge * 0.15);
        col += (hullBase * segBrightness + hullGlow) * hullAlpha;
        alpha += hullAlpha * 0.9;
    }

    // ════════════════════════════════════════════════════════════════════
    // 4. CHARGING ENERGY ARCS (lightning from hull to center)
    // ════════════════════════════════════════════════════════════════════
    if (charge > 0.3) {
        float arcIntensity = (charge - 0.3) / 0.7;
        int numArcs = 5;
        for (int i = 0; i < 5; i++) {
            float fi = float(i);
            float baseAng = (fi / 5.0) * TAU + t * 1.5 + charge * PI + seed;
            // Jagged radial line with noise displacement
            float angDelta = theta - baseAng;
            angDelta = mod(angDelta + PI, TAU) - PI;
            float angWidth = 0.08 + 0.02 * sin(t * 10.0 + fi);
            float angMask = exp(-angDelta * angDelta / (angWidth * angWidth));

            // Radial extent: from hull (0.9) to near center (0.1)
            float rJitter = nValue(vec2(theta * 8.0 + fi, t * 5.0)) * 0.15;
            float radialMask = smoothstep(0.9, 0.85, r + rJitter) * smoothstep(0.1, 0.15, r - rJitter);

            float arc = angMask * radialMask * arcIntensity;
            col += vColorCore * arc * 1.5;
            alpha += arc * 0.6;
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // 5. ORBITING SPARKS
    // ════════════════════════════════════════════════════════════════════
    {
        float sparkR = 0.88;
        int numSparks = 8;
        for (int i = 0; i < 8; i++) {
            float fi = float(i);
            float sparkAng = (fi / 8.0) * TAU + t * 0.8 + seed;
            float dx = cos(sparkAng) * sparkR - uv.x;
            float dy = sin(sparkAng) * sparkR - uv.y;
            float dist2 = dx * dx + dy * dy;
            float spark = exp(-dist2 * 80.0);
            float twinkle = 0.5 + 0.5 * sin(t * 5.0 + fi * 1.7);
            vec3 sparkCol = (mod(fi, 2.0) < 0.5) ? vColorCore : vColorHull;
            col += sparkCol * spark * twinkle * (0.5 + charge * 0.5);
            alpha += spark * twinkle * 0.4;
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // 6. BRIGHT CORE (pulsing center)
    // ════════════════════════════════════════════════════════════════════
    {
        float corePulse = 0.7 + 0.3 * sin(t * 4.0 + seed);
        float coreR = 0.08 + charge * 0.06;
        float coreGlow = exp(-r * r / (coreR * coreR));
        col += vColorCore * coreGlow * corePulse * (0.6 + charge * 0.6);
        alpha += coreGlow * corePulse * 0.5;
    }

    // ════════════════════════════════════════════════════════════════════
    // 7. OUTER RIM HALO (extends beyond r = 1.0)
    // ════════════════════════════════════════════════════════════════════
    {
        float rimR = 1.0;
        float rimGlow = exp(-pow(r - rimR, 2.0) * 12.0);
        float rimPulse = 0.5 + 0.5 * sin(t * 2.2 + seed);
        col += vColorHull * rimGlow * rimPulse * (0.15 + charge * 0.25);
        alpha += rimGlow * rimPulse * (0.1 + charge * 0.15);
    }

    // ════════════════════════════════════════════════════════════════════
    // COMPOSITE
    // ════════════════════════════════════════════════════════════════════
    alpha *= vAlpha;
    if (alpha < 0.004) discard;
    fragColor = vec4(col * vAlpha, alpha);
}
`;
