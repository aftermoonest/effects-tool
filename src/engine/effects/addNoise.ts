import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface AddNoiseParams {
    amount: number; // percent (0..100)
    distribution: 'Uniform' | 'Gaussian';
    monochromatic: boolean;
    seed: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export const addNoise: EffectPlugin = {
    id: 'add_noise',
    name: 'Add Noise',

    defaultParams: { amount: 10, distribution: 'Uniform', monochromatic: false, seed: 1 },

    controls: [
        { key: 'amount', label: 'Amount', type: 'slider', min: 0, max: 100, step: 1, unit: '%' },
        {
            key: 'distribution',
            label: 'Distribution',
            type: 'segmented',
            options: [
                { value: 'Uniform', label: 'Uniform' },
                { value: 'Gaussian', label: 'Gaussian' },
            ],
        },
        { key: 'monochromatic', label: 'Monochromatic', type: 'checkbox' },
        { key: 'seed', label: 'Seed', type: 'slider', min: 0, max: 10000, step: 1 },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...addNoise.defaultParams, ...(params || {}) };

        // Legacy payload bridging
        if (params && 'noiseAmount' in params && !('amount' in params)) {
            merged.amount = clamp(Number(params.noiseAmount) * 100, 0, 100);
        }

        merged.amount = clamp(Number(merged.amount), 0, 100);
        merged.distribution = String(merged.distribution) === 'Gaussian' ? 'Gaussian' : 'Uniform';
        merged.monochromatic = Boolean(merged.monochromatic);
        merged.seed = clamp(Number(merged.seed), 0, 10000);
        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float amount;       // 0..1
        uniform int distribution;   // 0 uniform, 1 gaussian
        uniform int monochromatic;  // 0/1
        uniform float seed;
        varying vec2 vUv;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        float gaussian(vec2 st) {
            float u1 = max(random(st), 0.0001);
            float u2 = random(st * 1.37 + 19.19);
            float g = sqrt(-2.0 * log(u1)) * cos(6.2831853 * u2);
            return clamp(g * 0.3333, -1.0, 1.0);
        }

        float noiseSample(vec2 st) {
            if (distribution == 1) return gaussian(st);
            return random(st) * 2.0 - 1.0;
        }

        void main() {
            vec4 color = texture2D(tInput, vUv);

            vec2 base = vUv * 4096.0 + vec2(seed, seed * 1.917);
            if (monochromatic == 1) {
                float n = noiseSample(base);
                color.rgb += vec3(n) * amount;
            } else {
                float nr = noiseSample(base + vec2(11.31, 5.17));
                float ng = noiseSample(base + vec2(23.73, 9.61));
                float nb = noiseSample(base + vec2(37.17, 13.27));
                color.rgb += vec3(nr, ng, nb) * amount;
            }

            gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        amount: (params) => Number(addNoise.coerceParams(params).amount) / 100,
        distribution: (params) => String(addNoise.coerceParams(params).distribution) === 'Gaussian' ? 1 : 0,
        monochromatic: (params) => addNoise.coerceParams(params).monochromatic ? 1 : 0,
        seed: (params) => Number(addNoise.coerceParams(params).seed),
    }
};
