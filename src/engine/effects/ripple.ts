import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface RippleParams {
    amount: number; // -100..100
    size: 'Small' | 'Medium' | 'Large';
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export const ripple: EffectPlugin = {
    id: 'ripple',
    name: 'Ripple',

    defaultParams: { amount: 50, size: 'Medium' },

    controls: [
        { key: 'amount', label: 'Amount', type: 'slider', min: -100, max: 100, step: 1, unit: '%' },
        {
            key: 'size',
            label: 'Size',
            type: 'segmented',
            options: [
                { value: 'Small', label: 'Small' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Large', label: 'Large' },
            ],
        },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...ripple.defaultParams, ...(params || {}) };

        // Legacy mapping from amplitude/frequency/phase.
        if (params && 'amplitude' in params && !('amount' in params)) {
            merged.amount = clamp(Number(params.amplitude) / 0.0005, -100, 100);
        }
        merged.amount = clamp(Number(merged.amount), -100, 100);

        const size = String(merged.size ?? 'Medium');
        merged.size = (['Small', 'Medium', 'Large'].includes(size) ? size : 'Medium');

        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform vec2 texelSize;
        uniform vec2 resolution;
        uniform float amount;
        uniform float wavelength;
        uniform float seed;
        varying vec2 vUv;

        float wave(vec2 p, float f, float phase) {
            return sin(p.x * f + sin(p.y * f * 0.43 + phase) * 1.7 + phase);
        }

        void main() {
            vec2 p = vUv * resolution;
            float f = 6.2831853 / max(wavelength, 1.0);

            float wx = wave(vec2(p.y, p.x), f, seed);
            float wy = wave(p + vec2(17.3, 23.1), f, seed * 1.29 + 2.7);

            vec2 dispPx = vec2(wx, wy) * amount;
            vec2 uv = vUv + dispPx * texelSize;

            gl_FragColor = texture2D(tInput, clamp(uv, 0.0, 1.0));
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        texelSize: (_, ctx) => [1.0 / ctx.width, 1.0 / ctx.height],
        resolution: (_, ctx) => [ctx.width, ctx.height],
        amount: (params) => {
            const p = ripple.coerceParams(params);
            return (Number(p.amount) / 100) * 14;
        },
        wavelength: (params) => {
            const p = ripple.coerceParams(params);
            const size = String(p.size);
            if (size === 'Small') return 30;
            if (size === 'Large') return 110;
            return 70;
        },
        seed: () => 2.314, // static seed as configured identically before
    }
};
