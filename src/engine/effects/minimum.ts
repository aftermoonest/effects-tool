import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface MinimumParams {
    radius: number;
    preserve: 'Roundness' | 'Squareness';
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export const minimum: EffectPlugin = {
    id: 'minimum',
    name: 'Minimum (Erode)',

    defaultParams: { radius: 1, preserve: 'Roundness' },

    controls: [
        { key: 'radius', label: 'Radius', type: 'slider', min: 0.1, max: 20, step: 0.1, unit: 'px' },
        {
            key: 'preserve',
            label: 'Preserve',
            type: 'segmented',
            options: [
                { value: 'Roundness', label: 'Roundness' },
                { value: 'Squareness', label: 'Squareness' },
            ],
        },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...minimum.defaultParams, ...(params || {}) };
        merged.radius = clamp(Number(merged.radius), 0.1, 20);
        const preserve = String(merged.preserve ?? 'Roundness');
        merged.preserve = (preserve === 'Squareness' ? 'Squareness' : 'Roundness');
        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform vec2 texelSize;
        uniform float radius;
        uniform int preserveRoundness;
        varying vec2 vUv;

        void main() {
            vec4 minColor = texture2D(tInput, vUv);

            for (int x = -20; x <= 20; x++) {
                for (int y = -20; y <= 20; y++) {
                    vec2 offs = vec2(float(x), float(y));

                    if (abs(offs.x) > radius || abs(offs.y) > radius) continue;
                    if (preserveRoundness == 1 && length(offs) > radius) continue;

                    vec4 s = texture2D(tInput, clamp(vUv + offs * texelSize, 0.0, 1.0));
                    minColor = min(minColor, s);
                }
            }

            gl_FragColor = minColor;
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        texelSize: (_, ctx) => [1.0 / ctx.width, 1.0 / ctx.height],
        radius: (params) => Number(minimum.coerceParams(params).radius),
        preserveRoundness: (params) => String(minimum.coerceParams(params).preserve) === 'Roundness' ? 1 : 0,
    }
};
