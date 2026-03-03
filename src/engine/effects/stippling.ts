import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface StipplingParams {
    density: number;
    distortion: number;
    jitter: number;
    dotSize: number;
    hardness: number;
    seed: number;
    quality: 'low' | 'medium' | 'high';
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export const stippling: EffectPlugin = {
    id: 'stippling',
    name: 'Stippling',

    defaultParams: {
        density: 56,
        distortion: 0.024,
        jitter: 0.6,
        dotSize: 0.58,
        hardness: 2.4,
        seed: 4242,
        quality: 'medium',
    },

    controls: [
        { key: 'density', label: 'Density', type: 'slider', min: 8, max: 180, step: 1 },
        { key: 'distortion', label: 'Distortion', type: 'slider', min: 0, max: 0.08, step: 0.001 },
        { key: 'jitter', label: 'Jitter', type: 'slider', min: 0, max: 1, step: 0.01 },
        { key: 'dotSize', label: 'Dot Size', type: 'slider', min: 0.1, max: 1, step: 0.01 },
        { key: 'hardness', label: 'Hardness', type: 'slider', min: 0.2, max: 8, step: 0.1 },
        { key: 'seed', label: 'Seed', type: 'slider', min: 0, max: 10000, step: 1 },
        {
            key: 'quality',
            label: 'Quality',
            type: 'segmented',
            options: [
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
            ],
        },
    ],

    helpText: 'Particle-like stipple field that distorts local texture around dot centers.',

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...stippling.defaultParams, ...(params || {}) };
        merged.density = Math.round(clamp(Number(merged.density), 8, 180));
        merged.distortion = clamp(Number(merged.distortion), 0, 0.08);
        merged.jitter = clamp(Number(merged.jitter), 0, 1);
        merged.dotSize = clamp(Number(merged.dotSize), 0.1, 1);
        merged.hardness = clamp(Number(merged.hardness), 0.2, 8);
        merged.seed = Math.round(clamp(Number(merged.seed), 0, 10000));
        const quality = String(merged.quality ?? 'medium').toLowerCase();
        merged.quality = quality === 'low' || quality === 'high' ? quality : 'medium';
        return merged;
    },

    fragmentShader: `
        precision highp float;
        uniform sampler2D tInput;
        uniform vec2 resolution;
        uniform float density;
        uniform float distortion;
        uniform float jitter;
        uniform float dotSize;
        uniform float hardness;
        uniform float seed;
        uniform int quality;

        varying vec2 vUv;

        vec2 hash22(vec2 p) {
            float n = sin(dot(p + seed, vec2(127.1, 311.7)));
            float m = sin(dot(p + seed * 1.618, vec2(269.5, 183.3)));
            return fract(vec2(n, m) * 43758.5453123);
        }

        void main() {
            float minRes = max(min(resolution.x, resolution.y), 1.0);
            vec2 grid = max((resolution / minRes) * max(density, 1.0), vec2(1.0));

            vec2 fieldPos = vUv * grid;
            vec2 baseCell = floor(fieldPos);
            vec2 inCell = fract(fieldPos);

            float nearestDist = 1000.0;
            float secondDist = 1000.0;
            vec2 nearestDelta = vec2(0.0);

            for (int y = -1; y <= 1; y++) {
                for (int x = -1; x <= 1; x++) {
                    float manhattan = abs(float(x)) + abs(float(y));
                    if (quality == 0 && manhattan > 1.0) continue;

                    vec2 cellOffset = vec2(float(x), float(y));
                    vec2 neighborCell = baseCell + cellOffset;
                    vec2 rnd = hash22(neighborCell);

                    vec2 particlePos = cellOffset + 0.5 + (rnd - 0.5) * jitter;
                    vec2 delta = particlePos - inCell;
                    float dist = length(delta);

                    if (dist < nearestDist) {
                        secondDist = nearestDist;
                        nearestDist = dist;
                        nearestDelta = delta;
                    } else if (dist < secondDist) {
                        secondDist = dist;
                    }
                }
            }

            vec2 direction = normalize(nearestDelta + vec2(0.0001));
            float radius = max(dotSize, 0.0001);
            float radial = clamp(1.0 - nearestDist / radius, 0.0, 1.0);
            float falloff = pow(radial, max(hardness, 0.0001));

            float support = clamp((secondDist - nearestDist) * 2.0, 0.0, 1.0);
            float warpStrength = distortion * falloff;
            if (quality == 2) {
                warpStrength *= mix(1.0, 1.35, support);
            }

            vec2 uvWarp = (direction * warpStrength) / grid;
            if (quality == 2) {
                vec2 micro = (hash22(baseCell + vec2(17.0, 29.0)) - 0.5) * (distortion * 0.25);
                uvWarp += (micro / grid) * falloff;
            }

            vec2 sampleUv = clamp(vUv + uvWarp, 0.0, 1.0);
            vec4 warped = texture2D(tInput, sampleUv);

            float dotMask = falloff;
            if (quality == 0) {
                dotMask = smoothstep(0.12, 0.95, dotMask);
            }

            float shade = 1.0 - dotMask * 0.38;
            vec3 finalColor = warped.rgb * shade;

            gl_FragColor = vec4(finalColor, warped.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        resolution: (_, ctx) => [ctx.width, ctx.height],
        density: (params) => Number(stippling.coerceParams(params).density),
        distortion: (params) => Number(stippling.coerceParams(params).distortion),
        jitter: (params) => Number(stippling.coerceParams(params).jitter),
        dotSize: (params) => Number(stippling.coerceParams(params).dotSize),
        hardness: (params) => Number(stippling.coerceParams(params).hardness),
        seed: (params) => Number(stippling.coerceParams(params).seed),
        quality: (params) => {
            const q = String(stippling.coerceParams(params).quality);
            if (q === 'low') return 0;
            if (q === 'high') return 2;
            return 1;
        },
    }
};
