import type { EffectPlugin, RenderContext } from '../types';

function hexToVec3(hex: string): [number, number, number] {
    const h = String(hex ?? '#000000').replace('#', '').padEnd(6, '0').slice(0, 6);
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
    ];
}

export const cellularAutomata: EffectPlugin = {
    id: 'cellular_automata',
    name: 'Cellular Automata',
    defaultParams: {
        threshold: 97,
        cellSize: 1,
        steps: 1,
        type: 'Classic',
        mncaThreshold1: 0.35,
        mncaThreshold2: 0.70,
        transparentBg: false,
        bgColor: '#000000',
        fgColor: '#ffffff',
    },
    controls: [
        {
            key: 'threshold',
            label: 'Threshold',
            type: 'slider',
            min: 0,
            max: 255,
            step: 1
        },
        {
            key: 'cellSize',
            label: 'Cell Size',
            type: 'slider',
            min: 1,
            max: 32,
            step: 1
        },
        {
            key: 'steps',
            label: 'Steps',
            type: 'slider',
            min: 1,
            max: 10,
            step: 1
        },
        {
            key: 'type',
            label: 'Type',
            type: 'segmented',
            options: [
                { value: 'Classic', label: 'Classic' },
                { value: 'LTL', label: 'LTL' },
                { value: 'MNCAB', label: 'MNCAB' },
                { value: 'MNCC', label: 'MNCC' }
            ]
        },
        {
            key: 'mncaThreshold1',
            label: 'MNCA Threshold 1',
            type: 'slider',
            min: 0.0,
            max: 1.0,
            step: 0.01,
            showWhen: (params) => params.type === 'MNCAB' || params.type === 'MNCC'
        },
        {
            key: 'mncaThreshold2',
            label: 'MNCA Threshold 2',
            type: 'slider',
            min: 0.0,
            max: 1.0,
            step: 0.01,
            showWhen: (params) => params.type === 'MNCAB' || params.type === 'MNCC'
        },
        {
            key: 'transparentBg',
            label: 'Transparent Background',
            type: 'checkbox'
        },
        {
            key: 'bgColor',
            label: 'Background Color',
            type: 'color',
            showWhen: (params) => !params.transparentBg
        },
        {
            key: 'fgColor',
            label: 'Foreground Color',
            type: 'color'
        },
    ],
    coerceParams: (params) => {
        const merged = { ...cellularAutomata.defaultParams, ...(params || {}) };
        merged.threshold = Math.max(0, Math.min(255, Number(merged.threshold)));
        merged.cellSize = Math.max(1, Math.min(32, Number(merged.cellSize)));
        merged.steps = Math.max(1, Math.min(10, Number(merged.steps)));
        merged.transparentBg = Boolean(merged.transparentBg);
        merged.bgColor = String(merged.bgColor || '#000000');
        merged.fgColor = String(merged.fgColor || '#ffffff');
        return merged;
    },
    uniforms: {
        tInput: (_: any, context: RenderContext) => context.inputTex,
        uResolution: (_: any, context: RenderContext) => [context.width, context.height],
        uThreshold: (params: any) => Number(params.threshold) / 255.0,
        uCellSize: (params: any) => Number(params.cellSize),
        uSteps: (params: any) => Number(params.steps),
        uCaType: (params: any) => {
            const types: Record<string, number> = { 'Classic': 0.0, 'LTL': 1.0, 'MNCAB': 2.0, 'MNCC': 3.0 };
            return types[String(params.type)] ?? 0.0;
        },
        uMncaT1: (params: any) => Number(params.mncaThreshold1),
        uMncaT2: (params: any) => Number(params.mncaThreshold2),
        uTransparentBg: (params: any) => params.transparentBg ? 1.0 : 0.0,
        uBgColor: (params: any) => typeof params.bgColor === 'string' ? hexToVec3(params.bgColor) : [0, 0, 0],
        uFgColor: (params: any) => typeof params.fgColor === 'string' ? hexToVec3(params.fgColor) : [1, 1, 1],
    },
    fragmentShader: `
        precision highp float;
        uniform sampler2D tInput;
        uniform vec2 uResolution;
        uniform float uThreshold;
        uniform float uCellSize;
        uniform float uCaType;
        uniform float uMncaT1;
        uniform float uMncaT2;
        uniform float uTransparentBg;
        uniform vec3 uBgColor;
        uniform vec3 uFgColor;
        varying vec2 vUv;

        float getCell(vec2 uv) {
            vec2 cellUv = (floor(uv * (uResolution / uCellSize)) + 0.5) * (uCellSize / uResolution);
            vec4 c = texture2D(tInput, cellUv);
            float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            return step(uThreshold, luma);
        }

        void main() {
            vec2 px = 1.0 / uResolution;
            float state = getCell(vUv);
            float sum = 0.0;
            float nextState = 0.0;

            if (uCaType == 0.0) {
                // Classic Conway's Game of Life (3x3)
                for(int y=-1; y<=1; y++) {
                    for(int x=-1; x<=1; x++) {
                        if(x == 0 && y == 0) continue;
                        sum += getCell(vUv + vec2(float(x), float(y)) * px * uCellSize);
                    }
                }
                if (state == 1.0) {
                    if (sum == 2.0 || sum == 3.0) nextState = 1.0;
                } else {
                    if (sum == 3.0) nextState = 1.0;
                }
            }
            else if (uCaType == 1.0) {
                // LTL (Larger Than Life) - 5x5
                for(int y=-2; y<=2; y++) {
                    for(int x=-2; x<=2; x++) {
                        if(x == 0 && y == 0) continue;
                        sum += getCell(vUv + vec2(float(x), float(y)) * px * uCellSize);
                    }
                }
                if (state == 1.0 && (sum >= 5.0 && sum <= 10.0)) nextState = 1.0;
                if (state == 0.0 && (sum >= 6.0 && sum <= 9.0)) nextState = 1.0;
            }
            else {
                // MNCA - two rings
                float innerSum = 0.0;
                float outerSum = 0.0;
                for(int y=-1; y<=1; y++) {
                    for(int x=-1; x<=1; x++) {
                        if(x == 0 && y == 0) continue;
                        innerSum += getCell(vUv + vec2(float(x), float(y)) * px * uCellSize);
                    }
                }
                for(int y=-2; y<=2; y++) {
                    for(int x=-2; x<=2; x++) {
                        if(abs(float(x)) == 2.0 || abs(float(y)) == 2.0) {
                            outerSum += getCell(vUv + vec2(float(x), float(y)) * px * uCellSize);
                        }
                    }
                }
                float innerAvg = innerSum / 8.0;
                float outerAvg = outerSum / 16.0;
                nextState = state;

                if (uCaType == 2.0) {
                    // MNCAB (Binary)
                    if (state == 0.0 && innerAvg > uMncaT1 && outerAvg < uMncaT2) {
                        nextState = 1.0;
                    } else if (state == 1.0 && (innerAvg < uMncaT1 || outerAvg > uMncaT2)) {
                        nextState = 0.0;
                    }
                } else if (uCaType == 3.0) {
                    // MNCC (Continuous)
                    float diff = clamp((innerAvg - uMncaT1) * (uMncaT2 - outerAvg) * 10.0, -0.1, 0.1);
                    nextState = clamp(state + diff, 0.0, 1.0);
                }
            }

            // Apply colors
            vec3 color = mix(uBgColor, uFgColor, nextState);
            float alpha = uTransparentBg > 0.5 ? nextState : 1.0;
            gl_FragColor = vec4(color * alpha, alpha);
        }
    `,
};
