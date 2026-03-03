import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';
import { buildCurveLut } from './toneUtils';
import type { Texture2D } from 'regl';

export interface CurvesParams {
    selectedChannel: 'RGB' | 'R' | 'G' | 'B';
    pointsRGB: number[];
    pointsR: number[];
    pointsG: number[];
    pointsB: number[];
}

const CHANNEL_OPTIONS = [
    { value: 'RGB', label: 'RGB' },
    { value: 'R', label: 'Red' },
    { value: 'G', label: 'Green' },
    { value: 'B', label: 'Blue' },
];

const DEFAULT_CURVE_POINTS = [0, 0, 255, 255];
const CURVES_LUT_SIZE = 256;
let curvesLutTexture: Texture2D | null = null;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeCurvePoints(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [...DEFAULT_CURVE_POINTS];
    const points = raw.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    if (points.length < 4 || points.length % 2 !== 0) return [...DEFAULT_CURVE_POINTS];

    const pairs: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < points.length; i += 2) {
        pairs.push({ x: clamp(points[i], 0, 255), y: clamp(points[i + 1], 0, 255) });
    }
    pairs.sort((a, b) => a.x - b.x);

    if (pairs[0].x !== 0) pairs.unshift({ x: 0, y: 0 });
    if (pairs[pairs.length - 1].x !== 255) pairs.push({ x: 255, y: 255 });

    const flattened: number[] = [];
    for (const pair of pairs) {
        flattened.push(pair.x, pair.y);
    }
    return flattened;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function toByte(value: number): number {
    return Math.round(clamp01(value) * 255);
}

function ensureCurvesLutTexture(): Texture2D {
    if (!curvesLutTexture) {
        throw new Error('[curves] LUT texture was not initialized');
    }
    return curvesLutTexture;
}

function buildPackedCurvesLut(params: EffectParams): Uint8Array {
    const p = curves.coerceParams(params) as unknown as CurvesParams;
    const master = buildCurveLut(p.pointsRGB);
    const red = buildCurveLut(p.pointsR);
    const green = buildCurveLut(p.pointsG);
    const blue = buildCurveLut(p.pointsB);

    const data = new Uint8Array(CURVES_LUT_SIZE * 4);
    for (let i = 0; i < CURVES_LUT_SIZE; i++) {
        const base = i * 4;
        data[base + 0] = toByte(master[i] ?? (i / 255));
        data[base + 1] = toByte(red[i] ?? (i / 255));
        data[base + 2] = toByte(green[i] ?? (i / 255));
        data[base + 3] = toByte(blue[i] ?? (i / 255));
    }

    return data;
}

export const curves: EffectPlugin = {
    id: 'curves',
    name: 'Curves',

    defaultParams: {
        selectedChannel: 'RGB',
        pointsRGB: [...DEFAULT_CURVE_POINTS],
        pointsR: [...DEFAULT_CURVE_POINTS],
        pointsG: [...DEFAULT_CURVE_POINTS],
        pointsB: [...DEFAULT_CURVE_POINTS],
    },

    controls: [
        { key: 'selectedChannel', label: 'Channel', type: 'segmented', options: CHANNEL_OPTIONS },
        { key: 'curvesEditor', label: 'Curve', type: 'curves_editor' },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...curves.defaultParams, ...(params || {}) };
        const selected = String(merged.selectedChannel);
        merged.selectedChannel = (['RGB', 'R', 'G', 'B'].includes(selected) ? selected : 'RGB');

        merged.pointsRGB = normalizeCurvePoints(merged.pointsRGB);
        merged.pointsR = normalizeCurvePoints(merged.pointsR);
        merged.pointsG = normalizeCurvePoints(merged.pointsG);
        merged.pointsB = normalizeCurvePoints(merged.pointsB);

        return merged;
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform sampler2D curvesLut;
        varying vec2 vUv;

        vec2 lutUv(float value) {
            return vec2(clamp(value, 0.0, 1.0), 0.5);
        }

        float sampleMaster(float value) {
            return texture2D(curvesLut, lutUv(value)).r;
        }

        float sampleR(float value) {
            return texture2D(curvesLut, lutUv(value)).g;
        }

        float sampleG(float value) {
            return texture2D(curvesLut, lutUv(value)).b;
        }

        float sampleB(float value) {
            return texture2D(curvesLut, lutUv(value)).a;
        }

        void main() {
            vec4 color = texture2D(tInput, vUv);
            vec3 c = color.rgb;

            c = vec3(sampleMaster(c.r), sampleMaster(c.g), sampleMaster(c.b));
            c.r = sampleR(c.r);
            c.g = sampleG(c.g);
            c.b = sampleB(c.b);

            gl_FragColor = vec4(clamp(c, 0.0, 1.0), color.a);
        }
    `,
    init: (regl) => {
        if (curvesLutTexture) {
            curvesLutTexture.destroy();
        }
        curvesLutTexture = regl.texture({
            width: CURVES_LUT_SIZE,
            height: 1,
            data: new Uint8Array(CURVES_LUT_SIZE * 4),
            format: 'rgba',
            type: 'uint8',
            min: 'nearest',
            mag: 'nearest',
            wrap: 'clamp',
            mipmap: false,
            flipY: false,
        });
    },
    destroy: () => {
        if (!curvesLutTexture) return;
        curvesLutTexture.destroy();
        curvesLutTexture = null;
    },
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        curvesLut: (params) => {
            const lut = ensureCurvesLutTexture();
            lut.subimage({ data: buildPackedCurvesLut(params), width: CURVES_LUT_SIZE, height: 1 }, 0, 0);
            return lut;
        },
    }
};
