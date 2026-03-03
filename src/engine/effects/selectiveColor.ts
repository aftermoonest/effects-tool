import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export interface SelectiveColorParams {
    colorFamily: string;
    cyan: number;
    magenta: number;
    yellow: number;
    black: number;
    mode: 'Relative' | 'Absolute';
}

const FAMILY_MAP: Record<string, number> = {
    Reds: 0,
    Yellows: 1,
    Greens: 2,
    Cyans: 3,
    Blues: 4,
    Magentas: 5,
    Whites: 6,
    Neutrals: 7,
    Blacks: 8,
};

const COLOR_FAMILIES = Object.keys(FAMILY_MAP);

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export const selectiveColor: EffectPlugin = {
    id: 'selective_color',
    name: 'Selective Color',

    defaultParams: {
        colorFamily: 'Reds',
        cyan: 0,
        magenta: 0,
        yellow: 0,
        black: 0,
        mode: 'Relative',
    },

    controls: [
        {
            key: 'colorFamily',
            label: 'Colors',
            type: 'select',
            options: COLOR_FAMILIES.map((value) => ({ value, label: value })),
        },
        { key: 'cyan', label: 'Cyan', type: 'slider', min: -100, max: 100, step: 1, unit: '%' },
        { key: 'magenta', label: 'Magenta', type: 'slider', min: -100, max: 100, step: 1, unit: '%' },
        { key: 'yellow', label: 'Yellow', type: 'slider', min: -100, max: 100, step: 1, unit: '%' },
        { key: 'black', label: 'Black', type: 'slider', min: -100, max: 100, step: 1, unit: '%' },
        {
            key: 'mode',
            label: 'Mode',
            type: 'segmented',
            options: [
                { value: 'Relative', label: 'Relative' },
                { value: 'Absolute', label: 'Absolute' },
            ],
        },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...selectiveColor.defaultParams, ...(params || {}) };
        const family = String(merged.colorFamily ?? 'Reds');
        merged.colorFamily = COLOR_FAMILIES.includes(family) ? family : 'Reds';
        merged.mode = String(merged.mode) === 'Absolute' ? 'Absolute' : 'Relative';

        for (const key of ['cyan', 'magenta', 'yellow', 'black']) {
            merged[key] = clamp(Number(merged[key]), -100, 100);
        }

        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform int colorFamily;
        uniform float cyanAdjust;
        uniform float magentaAdjust;
        uniform float yellowAdjust;
        uniform float blackAdjust;
        uniform int absoluteMode;
        varying vec2 vUv;

        float luminance(vec3 c) {
            return dot(c, vec3(0.299, 0.587, 0.114));
        }

        float familyMask(vec3 c, int family) {
            float mx = max(max(c.r, c.g), c.b);
            float mn = min(min(c.r, c.g), c.b);
            float sat = mx - mn;
            float lum = luminance(c);

            if (family == 0) return clamp(c.r - max(c.g, c.b), 0.0, 1.0) * (0.35 + sat);
            if (family == 1) return clamp(min(c.r, c.g) - c.b, 0.0, 1.0) * (0.35 + sat);
            if (family == 2) return clamp(c.g - max(c.r, c.b), 0.0, 1.0) * (0.35 + sat);
            if (family == 3) return clamp(min(c.g, c.b) - c.r, 0.0, 1.0) * (0.35 + sat);
            if (family == 4) return clamp(c.b - max(c.r, c.g), 0.0, 1.0) * (0.35 + sat);
            if (family == 5) return clamp(min(c.r, c.b) - c.g, 0.0, 1.0) * (0.35 + sat);
            if (family == 6) return smoothstep(0.62, 1.0, lum) * (1.0 - sat);
            if (family == 7) {
                float mid = clamp(1.0 - abs(lum - 0.5) * 2.0, 0.0, 1.0);
                return mid * (1.0 - sat);
            }
            return (1.0 - smoothstep(0.0, 0.35, lum)) * (0.5 + 0.5 * (1.0 - sat));
        }

        void main() {
            vec4 src = texture2D(tInput, vUv);
            vec3 c = clamp(src.rgb, 0.0, 1.0);

            float mask = clamp(familyMask(c, colorFamily), 0.0, 1.0);

            vec3 cmy = 1.0 - c;
            float k = min(min(cmy.r, cmy.g), cmy.b);
            vec3 chroma = (cmy - vec3(k)) / max(1.0 - k, 0.0001);

            if (absoluteMode == 1) {
                chroma.r = clamp(chroma.r + cyanAdjust * mask, 0.0, 1.0);
                chroma.g = clamp(chroma.g + magentaAdjust * mask, 0.0, 1.0);
                chroma.b = clamp(chroma.b + yellowAdjust * mask, 0.0, 1.0);
                k = clamp(k + blackAdjust * mask, 0.0, 1.0);
            } else {
                chroma.r = clamp(chroma.r + cyanAdjust * (1.0 - chroma.r) * mask, 0.0, 1.0);
                chroma.g = clamp(chroma.g + magentaAdjust * (1.0 - chroma.g) * mask, 0.0, 1.0);
                chroma.b = clamp(chroma.b + yellowAdjust * (1.0 - chroma.b) * mask, 0.0, 1.0);
                k = clamp(k + blackAdjust * (1.0 - k) * mask, 0.0, 1.0);
            }

            vec3 rebuiltCmy = chroma * (1.0 - k) + vec3(k);
            vec3 outRgb = clamp(1.0 - rebuiltCmy, 0.0, 1.0);

            gl_FragColor = vec4(outRgb, src.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        colorFamily: (params) => {
            const p = selectiveColor.coerceParams(params) as unknown as SelectiveColorParams;
            return FAMILY_MAP[p.colorFamily] ?? 0;
        },
        cyanAdjust: (params) => Number(selectiveColor.coerceParams(params).cyan) / 100,
        magentaAdjust: (params) => Number(selectiveColor.coerceParams(params).magenta) / 100,
        yellowAdjust: (params) => Number(selectiveColor.coerceParams(params).yellow) / 100,
        blackAdjust: (params) => Number(selectiveColor.coerceParams(params).black) / 100,
        absoluteMode: (params) => selectiveColor.coerceParams(params).mode === 'Absolute' ? 1 : 0,
    }
};
