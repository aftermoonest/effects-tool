import type { EffectPlugin, RenderContext } from '../types';

export const cellularAutomata: EffectPlugin = {
    id: 'cellular_automata',
    name: 'Cellular Automata',
    defaultParams: {
        threshold: 97, // 0-255 mapped to UI, or just actual threshold mapping
        cellSize: 1,
        steps: 1,
        type: 'Classic', // 'Classic' | 'LTL' | 'MNCAB' | 'MNCC'
        mncaThreshold1: 0.35,
        mncaThreshold2: 0.70
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
            // Only show for MNCA types
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
        }
    ],
    coerceParams: (params) => ({
        ...cellularAutomata.defaultParams,
        ...params
    }),
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
    },
    // We do multiple passes via 'steps' internally or just approximate it in one pass for now.
    // Since we only run this shader once per effect layer, true multi-step needs loop in js,
    // which Compositor doesn't support natively for one effect entry.
    // For now we implement a 1-step neighborhood filter parameterized by uCaType.
    fragmentShader: `
        precision highp float;
        uniform sampler2D tInput;
        uniform vec2 uResolution;
        uniform float uThreshold;
        uniform float uCellSize;
        uniform float uCaType;     // 0=Classic, 1=LTL, 2=MNCAB, 3=MNCC
        uniform float uMncaT1;
        uniform float uMncaT2;
        varying vec2 vUv;

        // Sample a discrete grid cell
        float getCell(vec2 uv) {
            vec2 cellUv = (floor(uv * (uResolution / uCellSize)) + 0.5) * (uCellSize / uResolution);
            vec4 c = texture2D(tInput, cellUv);
            float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            // Return 1.0 if alive (luma > threshold), 0.0 if dead
            return step(uThreshold, luma);
        }

        void main() {
            vec2 px = 1.0 / uResolution;
            
            // Current cell state
            float state = getCell(vUv);

            // Compute neighbors based on type
            float sum = 0.0;
            
            if (uCaType == 0.0) {
                // Classic Conway's Game of Life
                // 3x3 neighborhood (8 neighbors)
                for(int y=-1; y<=1; y++) {
                    for(int x=-1; x<=1; x++) {
                        if(x == 0 && y == 0) continue;
                        sum += getCell(vUv + vec2(float(x), float(y)) * px * uCellSize);
                    }
                }
                
                // Rules:
                // Alive + 2 or 3 neighbors -> Alive
                // Dead + 3 neighbors -> Alive
                // Else Dead
                float nextState = 0.0;
                if (state == 1.0) {
                    if (sum == 2.0 || sum == 3.0) nextState = 1.0;
                } else {
                    if (sum == 3.0) nextState = 1.0;
                }
                
                vec3 finalColor = vec3(nextState);
                gl_FragColor = vec4(finalColor, 1.0);
            } 
            else if (uCaType == 1.0) {
                // LTL (Larger Than Life) rough approximation
                // Check a 5x5 area
                for(int y=-2; y<=2; y++) {
                    for(int x=-2; x<=2; x++) {
                        if(x == 0 && y == 0) continue;
                        sum += getCell(vUv + vec2(float(x), float(y)) * px * uCellSize);
                    }
                }
                // Ad-hoc LTL rules for visual interest:
                float nextState = 0.0;
                if (state == 1.0 && (sum >= 5.0 && sum <= 10.0)) nextState = 1.0;
                if (state == 0.0 && (sum >= 6.0 && sum <= 9.0)) nextState = 1.0;
                
                gl_FragColor = vec4(vec3(nextState), 1.0);
            }
            else {
                // MNCA approximations
                // Let's use two rings
                float innerSum = 0.0;
                float outerSum = 0.0;
                
                // 3x3 inner ring
                for(int y=-1; y<=1; y++) {
                    for(int x=-1; x<=1; x++) {
                        if(x == 0 && y == 0) continue;
                        innerSum += getCell(vUv + vec2(float(x), float(y)) * px * uCellSize);
                    }
                }
                // 5x5 outer ring boundary
                for(int y=-2; y<=2; y++) {
                    for(int x=-2; x<=2; x++) {
                        if(abs(float(x)) == 2.0 || abs(float(y)) == 2.0) {
                            outerSum += getCell(vUv + vec2(float(x), float(y)) * px * uCellSize);
                        }
                    }
                }
                
                // Normalization
                float innerAvg = innerSum / 8.0;
                float outerAvg = outerSum / 16.0;
                
                float nextState = state;
                
                if (uCaType == 2.0) {
                    // MNCAB (Discrete / Binary like approach)
                    if (state == 0.0 && innerAvg > uMncaT1 && outerAvg < uMncaT2) {
                        nextState = 1.0;
                    } else if (state == 1.0 && (innerAvg < uMncaT1 || outerAvg > uMncaT2)) {
                        nextState = 0.0;
                    }
                } else if (uCaType == 3.0) {
                    // MNCC (Continuous)
                    // We blend states based on the sums
                    float diff = clamp((innerAvg - uMncaT1) * (uMncaT2 - outerAvg) * 10.0, -0.1, 0.1);
                    // To do true continuous we'd need a continuous state reading, not thresholded
                    // But we simulate it visually:
                    nextState = clamp(state + diff, 0.0, 1.0);
                }
                
                gl_FragColor = vec4(vec3(nextState), 1.0);
            }
        }
    `,
};
