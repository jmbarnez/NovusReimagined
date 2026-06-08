/** Trail mesh vertex + fragment shaders — GPU-rendered exhaust / ion trails with
 *  heat turbulence, Mach diamonds, and per-trail color gradients. */

export const TRAIL_VERT = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUV;
in vec3 aColor;
in float aAlpha;
in float aLife;
in float aBoost;
in float aDot;

out vec2 vUV;
out vec3 vColor;
out float vAlpha;
out float vLife;
out float vBoost;
out float vDot;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
    vColor = aColor;
    vAlpha = aAlpha;
    vLife = aLife;
    vBoost = aBoost;
    vDot = aDot;
}
`;

export const TRAIL_FRAG = `#version 300 es
precision mediump float;

in vec2 vUV;
in vec3 vColor;
in float vAlpha;
in float vLife;
in float vBoost;
in float vDot;

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
    float h0 = hash(vec2(i, 0.0));
    float h1 = hash(vec2(i + 1.0, 0.0));
    return mix(h0, h1, f);
}

void main() {
    float t;
    float widthFalloff;

    if (vDot > 0.5) {
        // Dot trail (e.g. blink afterimage): radial glow
        t = length(vUV);
        widthFalloff = exp(-t * t * 3.0);
    } else {
        // Oriented trail (e.g. exhaust sheet): lengthwise glow
        t = vUV.y;
        float w = vUV.x;
        widthFalloff = exp(-w * w * 2.5);
    }

    // Subtle turbulence along the trail
    float turb = noise1D(t * 8.0 + uTime * 0.003) * 0.03;
    t = clamp(t + turb, 0.0, 1.0);

    // Base color with white-hot nozzle boost
    vec3 base = vColor;
    float nozzleHeat = exp(-t * 5.0);
    vec3 col = mix(base * 0.55, mix(base, vec3(1.0, 0.96, 0.92), 0.6), nozzleHeat);

    // Boost / ion energy and Mach diamonds
    float mach = 1.0;
    if (vBoost > 0.5) {
        col += vec3(0.1, 0.25, 0.4) * nozzleHeat * 0.5;
        float machPattern = sin((t + uTime * 0.0015) * 18.0);
        machPattern = smoothstep(-0.3, 0.3, machPattern);
        mach = mix(0.7, 1.35, machPattern);
    }

    // Flicker
    float flicker = 0.92 + 0.08 * noise1D(t * 3.0 + uTime * 0.005);

    // Tail fade
    float tailFade = 1.0 - smoothstep(0.75, 1.0, t);

    // Composite
    float alpha = vAlpha * vLife * widthFalloff * mach * flicker * tailFade;
    if (alpha < 0.004) discard;

    fragColor = vec4(col * alpha, alpha);
}
`;
