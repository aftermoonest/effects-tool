import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface UnsharpMaskParams {
    amount: number; // percent (0..500)
    radius: number; // px
    threshold: number; // 0..255
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export const unsharpMask: EffectPlugin = {
    id: 'unsharp_mask',
    name: 'Unsharp Mask',

    defaultParams: { amount: 100, radius: 1, threshold: 0 },

    controls: [
        { key: 'amount', label: 'Amount', type: 'slider', min: 0, max: 500, step: 1, unit: '%' },
        { key: 'radius', label: 'Radius', type: 'slider', min: 0.1, max: 20, step: 0.1, unit: 'px' },
        { key: 'threshold', label: 'Threshold', type: 'slider', min: 0, max: 255, step: 1 },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...unsharpMask.defaultParams, ...(params || {}) };
        merged.amount = clamp(Number(merged.amount), 0, 500);
        merged.radius = clamp(Number(merged.radius), 0.1, 20);
        merged.threshold = clamp(Number(merged.threshold), 0, 255);
        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform vec2 texelSize;  // 1.0 / vec2(width, height)
        uniform float amount;    // 0.0 – 5.0 (percent / 100)
        uniform float radius;    // 0.1 – 20.0
        uniform float threshold; // 0.0 – 1.0
        varying vec2 vUv;

        float luminance(vec3 c) {
            return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
            vec4 original = texture2D(tInput, vUv);

            // 9-tap Gaussian blur approximation
            vec4 blur = vec4(0.0);
            float r = radius;
            blur += texture2D(tInput, vUv + vec2(-r, -r) * texelSize) * 0.0625;
            blur += texture2D(tInput, vUv + vec2( 0.0, -r) * texelSize) * 0.125;
            blur += texture2D(tInput, vUv + vec2( r, -r) * texelSize) * 0.0625;
            blur += texture2D(tInput, vUv + vec2(-r,  0.0) * texelSize) * 0.125;
            blur += texture2D(tInput, vUv) * 0.25;
            blur += texture2D(tInput, vUv + vec2( r,  0.0) * texelSize) * 0.125;
            blur += texture2D(tInput, vUv + vec2(-r,  r) * texelSize) * 0.0625;
            blur += texture2D(tInput, vUv + vec2( 0.0,  r) * texelSize) * 0.125;
            blur += texture2D(tInput, vUv + vec2( r,  r) * texelSize) * 0.0625;

            vec3 high = original.rgb - blur.rgb;
            float edge = abs(luminance(high));
            float gate = step(threshold, edge);

            vec3 sharpened = original.rgb + amount * high;
            vec3 finalColor = mix(original.rgb, sharpened, gate);

            gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), original.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        texelSize: (_, ctx) => [1.0 / ctx.width, 1.0 / ctx.height],
        amount: (params) => Number(unsharpMask.coerceParams(params).amount) / 100,
        radius: (params) => Number(unsharpMask.coerceParams(params).radius),
        threshold: (params) => Number(unsharpMask.coerceParams(params).threshold) / 255,
    }
};
