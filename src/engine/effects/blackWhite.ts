import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface BlackWhiteParams {
    preset: string;
    reds: number;
    yellows: number;
    greens: number;
    cyans: number;
    blues: number;
    magentas: number;
    tint: boolean;
    tintColor: string;
}

const B_W_PRESETS: Record<string, Partial<BlackWhiteParams>> = {
    Default: { reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80 },
    HighContrast: { reds: 30, yellows: 70, greens: 30, cyans: 70, blues: 10, magentas: 90 },
    FlatPortrait: { reds: 55, yellows: 50, greens: 35, cyans: 45, blues: 25, magentas: 70 },
    DramaticSky: { reds: 45, yellows: 65, greens: 40, cyans: 65, blues: -30, magentas: 85 },
};

export function applyBlackWhitePreset(preset: string, params: EffectParams): EffectParams {
    const mapped = B_W_PRESETS[preset];
    if (!mapped) return params;
    return { ...params, ...mapped, preset };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function hexToVec3(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
    ];
}

export const blackWhite: EffectPlugin = {
    id: 'black_white',
    name: 'Black & White',

    defaultParams: {
        preset: 'Default',
        reds: 40,
        yellows: 60,
        greens: 40,
        cyans: 60,
        blues: 20,
        magentas: 80,
        tint: false,
        tintColor: '#b8a46a',
    },

    controls: [
        {
            key: 'preset',
            label: 'Preset',
            type: 'select',
            options: Object.keys(B_W_PRESETS).map((value) => ({ value, label: value })),
        },
        { key: 'reds', label: 'Reds', type: 'slider', min: -200, max: 300, step: 1, unit: '%' },
        { key: 'yellows', label: 'Yellows', type: 'slider', min: -200, max: 300, step: 1, unit: '%' },
        { key: 'greens', label: 'Greens', type: 'slider', min: -200, max: 300, step: 1, unit: '%' },
        { key: 'cyans', label: 'Cyans', type: 'slider', min: -200, max: 300, step: 1, unit: '%' },
        { key: 'blues', label: 'Blues', type: 'slider', min: -200, max: 300, step: 1, unit: '%' },
        { key: 'magentas', label: 'Magentas', type: 'slider', min: -200, max: 300, step: 1, unit: '%' },
        { key: 'tint', label: 'Tint', type: 'checkbox' },
        { key: 'tintColor', label: 'Tint Color', type: 'color', showWhen: (params) => !!params.tint },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...blackWhite.defaultParams, ...(params || {}) };
        const preset = String(merged.preset ?? 'Default');
        merged.preset = B_W_PRESETS[preset] ? preset : 'Default';
        const keys = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'];
        for (const key of keys) {
            merged[key] = clamp(Number(merged[key]), -200, 300);
        }
        merged.tint = Boolean(merged.tint);
        if (typeof merged.tintColor !== 'string') merged.tintColor = '#b8a46a';
        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float reds;
        uniform float yellows;
        uniform float greens;
        uniform float cyans;
        uniform float blues;
        uniform float magentas;
        uniform int tintEnabled;
        uniform vec3 tintColor;
        varying vec2 vUv;

        float hueFromRgb(vec3 c) {
            float minC = min(min(c.r, c.g), c.b);
            float maxC = max(max(c.r, c.g), c.b);
            float delta = maxC - minC;
            if (delta == 0.0) return 0.0;
            float h = 0.0;
            if (maxC == c.r) h = mod((c.g - c.b) / delta, 6.0);
            else if (maxC == c.g) h = (c.b - c.r) / delta + 2.0;
            else if (maxC == c.b) h = (c.r - c.g) / delta + 4.0;
            return mod(h / 6.0, 1.0);
        }

        float hueBand(float hue, float center) {
            float d = abs(hue - center);
            d = min(d, 1.0 - d);
            return exp(-(d * d) / 0.0125);
        }

        void main() {
            vec4 color = texture2D(tInput, vUv);
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float hue = hueFromRgb(color.rgb);

            float wR = hueBand(hue, 0.0);
            float wY = hueBand(hue, 1.0/6.0);
            float wG = hueBand(hue, 2.0/6.0);
            float wC = hueBand(hue, 3.0/6.0);
            float wB = hueBand(hue, 4.0/6.0);
            float wM = hueBand(hue, 5.0/6.0);
            
            float sumW = wR + wY + wG + wC + wB + wM + 0.0001;
            
            float mixFactor = 
                (reds * wR + yellows * wY + greens * wG + cyans * wC + blues * wB + magentas * wM) / sumW;

            float bw = color.r * 0.299 * (mixFactor * wR) +
                       color.g * 0.587 * (mixFactor * wG) +
                       color.b * 0.114 * (mixFactor * wB);
                       
            bw += lum * (1.0 - (wR + wY + wG + wC + wB + wM));
            bw = clamp(bw, 0.0, 1.0);

            vec3 mono = vec3(bw);
            if (tintEnabled == 1) {
                mono = mix(mono, mono * tintColor, 0.75);
            }

            gl_FragColor = vec4(mono, color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        reds: (params: BlackWhiteParams) => params.reds / 100.0,
        yellows: (params: BlackWhiteParams) => params.yellows / 100.0,
        greens: (params: BlackWhiteParams) => params.greens / 100.0,
        cyans: (params: BlackWhiteParams) => params.cyans / 100.0,
        blues: (params: BlackWhiteParams) => params.blues / 100.0,
        magentas: (params: BlackWhiteParams) => params.magentas / 100.0,
        tintEnabled: (params: BlackWhiteParams) => params.tint ? 1 : 0,
        tintColor: (params: BlackWhiteParams) => typeof params.tintColor === 'string' ? hexToVec3(params.tintColor) : [0.72, 0.64, 0.41],
    }
};
