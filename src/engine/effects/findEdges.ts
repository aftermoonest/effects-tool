import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';

export const findEdges: EffectPlugin = {
    id: 'find_edges',
    name: 'Find Edges',

    defaultParams: {},
    controls: [], // It naturally takes no parameters

    coerceParams(params: EffectParams | undefined): EffectParams {
        return { ...findEdges.defaultParams, ...(params || {}) };
    },

    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform vec2 texelSize;
        varying vec2 vUv;

        float luminance(vec3 c) {
            return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
            float tl = luminance(texture2D(tInput, vUv + vec2(-1.0, -1.0) * texelSize).rgb);
            float tm = luminance(texture2D(tInput, vUv + vec2( 0.0, -1.0) * texelSize).rgb);
            float tr = luminance(texture2D(tInput, vUv + vec2( 1.0, -1.0) * texelSize).rgb);
            float ml = luminance(texture2D(tInput, vUv + vec2(-1.0,  0.0) * texelSize).rgb);
            float mr = luminance(texture2D(tInput, vUv + vec2( 1.0,  0.0) * texelSize).rgb);
            float bl = luminance(texture2D(tInput, vUv + vec2(-1.0,  1.0) * texelSize).rgb);
            float bm = luminance(texture2D(tInput, vUv + vec2( 0.0,  1.0) * texelSize).rgb);
            float br = luminance(texture2D(tInput, vUv + vec2( 1.0,  1.0) * texelSize).rgb);

            float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
            float gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;

            float edge = clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);
            float paper = 1.0 - edge;

            vec4 src = texture2D(tInput, vUv);
            gl_FragColor = vec4(vec3(paper), src.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        texelSize: (_, ctx) => [1.0 / ctx.width, 1.0 / ctx.height],
    }
};
