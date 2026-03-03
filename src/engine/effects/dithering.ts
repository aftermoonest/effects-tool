import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface DitheringParams {
    pattern: string;
    colorMode: string;
    shadows: string;
    midtones: string;
    highlights: string;
    imagePreprocessing: boolean;
    preBlur: number;
    preGrain: number;
    preGamma: number;
    preBlackPoint: number;
    preWhitePoint: number;
    showEffect: boolean;
    pixelSize: number;
    useColorMode: boolean;
    threshold: number;
    removeBgV2: boolean;
}

function hexToVec3(hex: string): [number, number, number] {
    const h = String(hex ?? '#000000').replace('#', '').padEnd(6, '0').slice(0, 6);
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
    ];
}

function coerceBooleanFlag(value: unknown, defaultValue = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
        if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off' || normalized === '') return false;
    }
    return defaultValue;
}

export const dithering: EffectPlugin = {
    id: 'dithering',
    name: 'Dithering',

    defaultParams: {
        pattern: 'F-S',
        colorMode: 'tritone',
        shadows: '#000000',
        midtones: '#ff4500',
        highlights: '#ffffff',
        imagePreprocessing: false,
        preBlur: 0.5,
        preGrain: 0.1,
        preGamma: 1.0,
        preBlackPoint: 0,
        preWhitePoint: 255,
        showEffect: true,
        pixelSize: 2,
        useColorMode: false,
        threshold: 128,
        removeBgV2: false,
    },

    controls: [
        { key: 'showEffect', label: 'Enable Effect', type: 'checkbox' },
        {
            key: 'pattern',
            label: 'Pattern',
            type: 'segmented',
            options: [
                { value: 'F-S', label: 'F-S' },
                { value: 'Bayer', label: 'Bayer' },
                { value: 'Random', label: 'Random' },
            ],
        },
        { key: 'threshold', label: 'Threshold', type: 'slider', min: 0, max: 255, step: 1 },
        { key: 'pixelSize', label: 'Pixel Size', type: 'slider', min: 1, max: 20, step: 1 },
        { key: 'useColorMode', label: 'Use Original Colors', type: 'checkbox' },
        {
            key: 'colorMode',
            label: 'Palette Mode',
            type: 'segmented',
            options: [
                { value: 'monochrome', label: 'Mono' },
                { value: 'duotone', label: 'Duo' },
                { value: 'tritone', label: 'Tri' },
            ],
            showWhen: (params) => !params.useColorMode,
        },
        {
            key: 'removeBgV2',
            label: 'Remove BG v2',
            type: 'checkbox',
            showWhen: (params) => !params.useColorMode && params.colorMode === 'monochrome',
        },
        {
            key: 'shadows',
            label: 'Shadows',
            type: 'color',
            showWhen: (params) => !params.useColorMode,
        },
        {
            key: 'midtones',
            label: 'Midtones',
            type: 'color',
            showWhen: (params) => !params.useColorMode && params.colorMode === 'tritone',
        },
        {
            key: 'highlights',
            label: 'Highlights',
            type: 'color',
            showWhen: (params) => !params.useColorMode,
        },
        { key: 'imagePreprocessing', label: 'Image Preprocessing', type: 'checkbox' },
        {
            key: 'preBlur',
            label: 'Pre-Blur',
            type: 'slider',
            min: 0,
            max: 5,
            step: 0.1,
            showWhen: (params) => !!params.imagePreprocessing,
        },
        {
            key: 'preGrain',
            label: 'Pre-Grain',
            type: 'slider',
            min: 0,
            max: 1,
            step: 0.01,
            showWhen: (params) => !!params.imagePreprocessing,
        },
        {
            key: 'preGamma',
            label: 'Gamma Factor',
            type: 'slider',
            min: 0.1,
            max: 4,
            step: 0.01,
            showWhen: (params) => !!params.imagePreprocessing,
        },
        {
            key: 'preBlackPoint',
            label: 'Black Point',
            type: 'slider',
            min: 0,
            max: 255,
            step: 1,
            showWhen: (params) => !!params.imagePreprocessing,
        },
        {
            key: 'preWhitePoint',
            label: 'White Point',
            type: 'slider',
            min: 0,
            max: 255,
            step: 1,
            showWhen: (params) => !!params.imagePreprocessing,
        },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...dithering.defaultParams, ...(params || {}) };

        const rawHasRemoveBgV2 = params ? Object.prototype.hasOwnProperty.call(params, 'removeBgV2') : false;
        const rawHasTransparentBg = params ? Object.prototype.hasOwnProperty.call(params, 'transparentBg') : false;
        const removeBgInput = rawHasRemoveBgV2
            ? merged.removeBgV2
            : (rawHasTransparentBg ? merged.transparentBg : merged.removeBgV2);
        merged.removeBgV2 = coerceBooleanFlag(removeBgInput, false);
        merged.transparentBg = merged.removeBgV2; // legacy sync
        return merged;
    },

    fragmentShader: `
        precision highp float;
        uniform sampler2D tInput;
        uniform vec2 texelSize;
        uniform vec2 resolution;
        uniform int algorithm;
        uniform int colorMode;
        uniform vec3 shadowsC;
        uniform vec3 midtonesC;
        uniform vec3 highlightsC;
        uniform int imagePreprocessing;
        uniform float preBlur;
        uniform float preGrain;
        uniform float preGamma;
        uniform float preBlackPoint;
        uniform float preWhitePoint;
        uniform int showEffect;
        uniform float pixelSize;
        uniform int useColorMode;
        uniform float thresholdUniform;
        uniform int removeBgV2;
        uniform float seed;

        varying vec2 vUv;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        float ign(vec2 v) {
            vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
            return fract(magic.z * fract(dot(v, magic.xy)));
        }

        float getBayerLimit(vec2 coord) {
            vec2 p = mod(floor(coord), 4.0);
            float x = p.x;
            float y = p.y;
            if (y < 0.5) {
                if (x < 0.5) return 0.0/16.0;
                if (x < 1.5) return 8.0/16.0;
                if (x < 2.5) return 2.0/16.0;
                return 10.0/16.0;
            } else if (y < 1.5) {
                if (x < 0.5) return 12.0/16.0;
                if (x < 1.5) return 4.0/16.0;
                if (x < 2.5) return 14.0/16.0;
                return 6.0/16.0;
            } else if (y < 2.5) {
                if (x < 0.5) return 3.0/16.0;
                if (x < 1.5) return 11.0/16.0;
                if (x < 2.5) return 1.0/16.0;
                return 9.0/16.0;
            } else {
                if (x < 0.5) return 15.0/16.0;
                if (x < 1.5) return 7.0/16.0;
                if (x < 2.5) return 13.0/16.0;
                return 5.0/16.0;
            }
        }

        float luminance(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
        }

        void main() {
            vec2 numPixels = floor(resolution / max(pixelSize, 1.0));
            vec2 pixelatedUV = (floor(vUv * numPixels) + 0.5) / numPixels;

            vec4 color = texture2D(tInput, pixelatedUV);

            if (imagePreprocessing == 1) {
                if (preBlur > 0.0) {
                    vec2 offset = texelSize * preBlur * max(pixelSize, 1.0);
                    vec4 b0 = texture2D(tInput, pixelatedUV);
                    vec4 b1 = texture2D(tInput, pixelatedUV + vec2(offset.x, 0.0));
                    vec4 b2 = texture2D(tInput, pixelatedUV + vec2(-offset.x, 0.0));
                    vec4 b3 = texture2D(tInput, pixelatedUV + vec2(0.0, offset.y));
                    vec4 b4 = texture2D(tInput, pixelatedUV + vec2(0.0, -offset.y));
                    color = (b0 + b1 + b2 + b3 + b4) * 0.2;
                }

                if (preGrain > 0.0) {
                    float noise = random(pixelatedUV + seed) * 2.0 - 1.0;
                    color.rgb += noise * preGrain;
                }

                vec3 c = clamp((color.rgb - preBlackPoint) / max(preWhitePoint - preBlackPoint, 0.001), 0.0, 1.0);
                c = pow(c, vec3(1.0 / max(preGamma, 0.01)));
                color.rgb = clamp(c, 0.0, 1.0);
            }

            if (showEffect == 0) {
                gl_FragColor = vec4(color.rgb, color.a);
                return;
            }

            float lum = luminance(color.rgb);
            vec2 pos = pixelatedUV * resolution / max(pixelSize, 1.0);
            
            float t;
            if (algorithm == 0) { 
                t = ign(pos);
            } else if (algorithm == 1) {
                t = getBayerLimit(pos);
            } else {
                t = random(pos + seed);
            }
            
            float ditherThreshold = t - 0.5 + thresholdUniform;
            
            vec3 finalColor;
            float alpha = color.a;

            if (useColorMode == 1) {
                vec3 quantLevel = vec3(
                    step(ditherThreshold, color.r),
                    step(ditherThreshold, color.g),
                    step(ditherThreshold, color.b)
                );
                finalColor = mix(shadowsC, highlightsC, quantLevel);
            } else {
                if (colorMode == 0) {
                    float dithered = step(ditherThreshold, lum);
                    finalColor = mix(shadowsC, highlightsC, dithered);
                    if (removeBgV2 == 1) {
                        alpha = dithered;
                    }
                } else if (colorMode == 1) {
                    float dithered = step(ditherThreshold, lum);
                    finalColor = mix(shadowsC, highlightsC, dithered);
                } else {
                    float darkStep = step((t - 0.5) + thresholdUniform * 0.5, lum);
                    float lightStep = step((t - 0.5) + thresholdUniform * 0.5 + 0.5, lum);
                    vec3 mix1 = mix(shadowsC, midtonesC, darkStep);
                    finalColor = mix(mix1, highlightsC, lightStep);
                }
            }

            gl_FragColor = vec4(finalColor, alpha);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        texelSize: (_, ctx) => [1.0 / ctx.width, 1.0 / ctx.height],
        resolution: (_, ctx) => [ctx.width, ctx.height],
        seed: () => Math.random() * 100,
        algorithm: (params) => {
            const p = dithering.coerceParams(params);
            if (typeof p.pattern === 'string') {
                const PATTERNS: Record<string, number> = { 'F-S': 0, 'Bayer': 1, 'Random': 2 };
                return PATTERNS[p.pattern] ?? 0;
            }
            if (typeof p.algorithm === 'string') {
                const ALGOS: Record<string, number> = { 'atkinson': 0, 'bayer': 1, 'floyd_steinberg': 2 };
                return ALGOS[p.algorithm] ?? 0;
            }
            return Number(p.algorithm) ?? 0;
        },
        colorMode: (params) => {
            const p = dithering.coerceParams(params);
            if (typeof p.colorMode === 'string') {
                const MODES: Record<string, number> = { 'monochrome': 0, 'duotone': 1, 'tritone': 2 };
                return MODES[p.colorMode] ?? 0;
            }
            return Number(p.colorMode) ?? 0;
        },
        shadowsC: (params) => typeof params.shadows === 'string' ? hexToVec3(params.shadows) : [0, 0, 0],
        midtonesC: (params) => typeof params.midtones === 'string' ? hexToVec3(params.midtones) : [0.5, 0.5, 0.5],
        highlightsC: (params) => typeof params.highlights === 'string' ? hexToVec3(params.highlights) : [1, 1, 1],
        imagePreprocessing: (params) => params.imagePreprocessing ? 1 : 0,
        preBlur: (params) => Number(params.preBlur) ?? 0.0,
        preGrain: (params) => Number(params.preGrain) ?? 0.0,
        preGamma: (params) => Number(params.preGamma) ?? 1.0,
        preBlackPoint: (params) => (Number(params.preBlackPoint) ?? 0) / 255.0,
        preWhitePoint: (params) => (Number(params.preWhitePoint) ?? 255) / 255.0,
        showEffect: (params) => params.showEffect ? 1 : 0,
        pixelSize: (params) => Number(params.pixelSize) ?? 1.0,
        useColorMode: (params) => params.useColorMode ? 1 : 0,
        thresholdUniform: (params) => (Number(params.threshold) ?? 128) / 255.0,
        removeBgV2: (params) => dithering.coerceParams(params).removeBgV2 ? 1 : 0,
    }
};
