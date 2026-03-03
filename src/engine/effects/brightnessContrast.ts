import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface BrightnessContrastParams {
    brightness: number; // Photoshop-like range: -150..150
    contrast: number; // Photoshop-like range: -100..100
    useLegacy: boolean;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export const brightnessContrast: EffectPlugin = {
    id: 'brightness_contrast',
    name: 'Brightness / Contrast',

    defaultParams: { brightness: 0, contrast: 0, useLegacy: false },

    controls: [
        { key: 'brightness', label: 'Brightness', type: 'slider', min: -150, max: 150, step: 1, unit: '%' },
        { key: 'contrast', label: 'Contrast', type: 'slider', min: -100, max: 100, step: 1, unit: '%' },
        { key: 'useLegacy', label: 'Use Legacy', type: 'checkbox' },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...brightnessContrast.defaultParams, ...(params || {}) };
        merged.brightness = clamp(Number(merged.brightness), -150, 150);
        merged.contrast = clamp(Number(merged.contrast), -100, 100);
        merged.useLegacy = Boolean(merged.useLegacy);
        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float brightness;
        uniform float contrast;
        uniform int useLegacy;
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tInput, vUv);
            vec3 c = color.rgb;

            if (useLegacy == 1) {
                c = c + brightness;
                if (contrast > 0.0) {
                    c = (c - 0.5) / (1.0 - contrast) + 0.5;
                } else {
                    c = (c - 0.5) * (1.0 + contrast) + 0.5;
                }
            } else {
                if (brightness < 0.0) {
                    c = c * (1.0 + brightness);
                } else {
                    c = c + ((1.0 - c) * brightness);
                }
                float k = tan((45.0 + 44.0 * contrast) * 3.14159265358979323846 / 180.0);
                c = (c - 0.5) * k + 0.5;
            }

            gl_FragColor = vec4(clamp(c, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        brightness: (params: BrightnessContrastParams) => params.brightness / 100.0,
        contrast: (params: BrightnessContrastParams) => params.contrast / 100.0,
        useLegacy: (params: BrightnessContrastParams) => params.useLegacy ? 1 : 0,
    }
};
