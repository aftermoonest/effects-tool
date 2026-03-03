import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface LevelsParams {
    selectedChannel: 'RGB' | 'R' | 'G' | 'B';
    inBlackRGB: number;
    inWhiteRGB: number;
    gammaRGB: number;
    outBlackRGB: number;
    outWhiteRGB: number;
    inBlackR: number;
    inWhiteR: number;
    gammaR: number;
    outBlackR: number;
    outWhiteR: number;
    inBlackG: number;
    inWhiteG: number;
    gammaG: number;
    outBlackG: number;
    outWhiteG: number;
    inBlackB: number;
    inWhiteB: number;
    gammaB: number;
    outBlackB: number;
    outWhiteB: number;
}

const CHANNEL_OPTIONS = [
    { value: 'RGB', label: 'RGB' },
    { value: 'R', label: 'Red' },
    { value: 'G', label: 'Green' },
    { value: 'B', label: 'Blue' },
];

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function coerceLevelsValue(value: unknown, defaultValue: number, isByteRange: boolean): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return defaultValue;
    if (isByteRange) {
        const normalized = numeric >= 0 && numeric <= 1 ? numeric * 255 : numeric;
        return clamp(normalized, 0, 255);
    }
    return clamp(numeric, 0.1, 9.99);
}

export function getLevelsKeysForChannel(channel: string) {
    const suffix = channel === 'R' || channel === 'G' || channel === 'B' ? channel : 'RGB';
    return {
        inBlack: `inBlack${suffix}`,
        inWhite: `inWhite${suffix}`,
        gamma: `gamma${suffix}`,
        outBlack: `outBlack${suffix}`,
        outWhite: `outWhite${suffix}`,
    };
}

export const levels: EffectPlugin = {
    id: 'levels',
    name: 'Levels',

    defaultParams: {
        selectedChannel: 'RGB',
        inBlackRGB: 0,
        inWhiteRGB: 255,
        gammaRGB: 1,
        outBlackRGB: 0,
        outWhiteRGB: 255,
        inBlackR: 0,
        inWhiteR: 255,
        gammaR: 1,
        outBlackR: 0,
        outWhiteR: 255,
        inBlackG: 0,
        inWhiteG: 255,
        gammaG: 1,
        outBlackG: 0,
        outWhiteG: 255,
        inBlackB: 0,
        inWhiteB: 255,
        gammaB: 1,
        outBlackB: 0,
        outWhiteB: 255,
    },

    controls: [
        { key: 'selectedChannel', label: 'Channel', type: 'segmented', options: CHANNEL_OPTIONS },
        { key: 'levelsEditor', label: 'Levels', type: 'levels_editor' },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...levels.defaultParams, ...(params || {}) };

        const byteKeys = [
            'inBlackRGB', 'inWhiteRGB', 'outBlackRGB', 'outWhiteRGB',
            'inBlackR', 'inWhiteR', 'outBlackR', 'outWhiteR',
            'inBlackG', 'inWhiteG', 'outBlackG', 'outWhiteG',
            'inBlackB', 'inWhiteB', 'outBlackB', 'outWhiteB',
        ];
        const gammaKeys = ['gammaRGB', 'gammaR', 'gammaG', 'gammaB'];

        // Legacy payload bridging
        if (params) {
            if ('inBlack' in params) merged.inBlackRGB = params.inBlack as number;
            if ('inWhite' in params) merged.inWhiteRGB = params.inWhite as number;
            if ('gamma' in params) merged.gammaRGB = params.gamma as number;
            if ('outBlack' in params) merged.outBlackRGB = params.outBlack as number;
            if ('outWhite' in params) merged.outWhiteRGB = params.outWhite as number;
        }

        for (const key of byteKeys) {
            merged[key] = coerceLevelsValue(merged[key], levels.defaultParams[key] as number, true);
        }
        for (const key of gammaKeys) {
            merged[key] = coerceLevelsValue(merged[key], levels.defaultParams[key] as number, false);
        }

        const selected = String(merged.selectedChannel ?? 'RGB');
        merged.selectedChannel = (['RGB', 'R', 'G', 'B'].includes(selected) ? selected : 'RGB');

        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float inBlackM;
        uniform float inWhiteM;
        uniform float gammaM;
        uniform float outBlackM;
        uniform float outWhiteM;
        uniform vec3 inBlack;
        uniform vec3 inWhite;
        uniform vec3 gamma;
        uniform vec3 outBlack;
        uniform vec3 outWhite;
        varying vec2 vUv;

        float applyLevels1(float c, float inB, float inW, float g, float outB, float outW) {
            float inRange = max(inW - inB, 0.001);
            float norm = clamp((c - inB) / inRange, 0.0, 1.0);
            float gOut = pow(norm, 1.0 / max(g, 0.01));
            return mix(outB, outW, gOut);
        }

        vec3 applyLevels3(vec3 c, vec3 inB, vec3 inW, vec3 g, vec3 outB, vec3 outW) {
            return vec3(
                applyLevels1(c.r, inB.r, inW.r, g.r, outB.r, outW.r),
                applyLevels1(c.g, inB.g, inW.g, g.g, outB.g, outW.g),
                applyLevels1(c.b, inB.b, inW.b, g.b, outB.b, outW.b)
            );
        }

        void main() {
            vec4 color = texture2D(tInput, vUv);
            vec3 c = color.rgb;
            c = applyLevels3(c, vec3(inBlackM), vec3(inWhiteM), vec3(gammaM), vec3(outBlackM), vec3(outWhiteM));
            c = applyLevels3(c, inBlack, inWhite, gamma, outBlack, outWhite);
            gl_FragColor = vec4(clamp(c, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        inBlackM: (params: LevelsParams) => params.inBlackRGB / 255,
        inWhiteM: (params: LevelsParams) => params.inWhiteRGB / 255,
        gammaM: (params: LevelsParams) => params.gammaRGB,
        outBlackM: (params: LevelsParams) => params.outBlackRGB / 255,
        outWhiteM: (params: LevelsParams) => params.outWhiteRGB / 255,
        inBlack: (params: LevelsParams) => [params.inBlackR / 255, params.inBlackG / 255, params.inBlackB / 255],
        inWhite: (params: LevelsParams) => [params.inWhiteR / 255, params.inWhiteG / 255, params.inWhiteB / 255],
        gamma: (params: LevelsParams) => [params.gammaR, params.gammaG, params.gammaB],
        outBlack: (params: LevelsParams) => [params.outBlackR / 255, params.outBlackG / 255, params.outBlackB / 255],
        outWhite: (params: LevelsParams) => [params.outWhiteR / 255, params.outWhiteG / 255, params.outWhiteB / 255],
    }
};
