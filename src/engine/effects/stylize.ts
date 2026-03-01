import type { EffectProvider } from '../types';
import { ASCII_FONT } from '../Compositor';

// ── Helper: Convert hex string to [r, g, b] normalized ──
function hexToVec3(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
    ];
}

// ── Dithering ────────────────────────────────────────────────────────────
export const dithering: EffectProvider = {
    id: 'dithering',
    name: 'Dithering',
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
        uniform int transparentBg;
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
                    if (transparentBg == 1) {
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
            // Map both 'algorithm' and legacy 'pattern' param
            if (typeof params.pattern === 'string') {
                const PATTERNS: Record<string, number> = { 'F-S': 0, 'Bayer': 1, 'Random': 2 };
                return PATTERNS[params.pattern] ?? 0;
            }
            if (typeof params.algorithm === 'string') {
                const ALGOS: Record<string, number> = { 'atkinson': 0, 'bayer': 1, 'floyd_steinberg': 2 };
                return ALGOS[params.algorithm] ?? 0;
            }
            return params.algorithm ?? 0;
        },
        colorMode: (params) => {
            if (typeof params.colorMode === 'string') {
                const MODES: Record<string, number> = { 'monochrome': 0, 'duotone': 1, 'tritone': 2 };
                return MODES[params.colorMode] ?? 0;
            }
            return params.colorMode ?? 0;
        },
        shadowsC: (params) => typeof params.shadows === 'string' ? hexToVec3(params.shadows) : [0, 0, 0],
        midtonesC: (params) => typeof params.midtones === 'string' ? hexToVec3(params.midtones) : [0.5, 0.5, 0.5],
        highlightsC: (params) => typeof params.highlights === 'string' ? hexToVec3(params.highlights) : [1, 1, 1],
        imagePreprocessing: (params) => params.imagePreprocessing ? 1 : 0,
        preBlur: (params) => params.preBlur ?? 0.0,
        preGrain: (params) => params.preGrain ?? 0.0,
        preGamma: (params) => params.preGamma ?? 1.0,
        preBlackPoint: (params) => (params.preBlackPoint ?? 0) / 255.0,
        preWhitePoint: (params) => (params.preWhitePoint ?? 255) / 255.0,
        showEffect: (params) => params.showEffect ? 1 : 0,
        pixelSize: (params) => params.pixelSize ?? 1.0,
        useColorMode: (params) => params.useColorMode ? 1 : 0,
        thresholdUniform: (params) => (params.threshold ?? 128) / 255.0,
        transparentBg: (params) => params.transparentBg ? 1 : 0,
    }
};

// ── ASCII Art ────────────────────────────────────────────────────────────
export const ascii: EffectProvider = {
    id: 'ascii',
    name: 'ASCII Art',
    fragmentShader: `
        precision highp float;
        uniform sampler2D tInput;
        uniform vec2 resolution;
        uniform float scale;
        uniform float asciiGamma;
        uniform float asciiPhase;
        uniform int colorMode;
        uniform int background;
        uniform vec3 bgColor;
        uniform vec3 textColor;
        uniform int invertOrder;

        uniform int glyphs[32];
        uniform int numGlyphs;

        varying vec2 vUv;

        float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

        float character(int n, vec2 p) {
            p = floor(p * vec2(4.0, -4.0) + 2.5);
            if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y) {
                int bit = int(floor(p.x + 0.5) + 5.0 * floor(p.y + 0.5));
                float v = mod(floor(float(n) / pow(2.0, float(24 - bit))), 2.0);
                return v;
            }
            return 0.0;
        }

        int getGlyph(float lum) {
            if (invertOrder == 1) lum = 1.0 - lum;

            float fIndex = lum * float(numGlyphs - 1) + asciiPhase;
            int index = int(mod(floor(fIndex + 0.5), float(numGlyphs)));
            
            int glyphVal = 0;
            for (int i = 0; i < 32; i++) {
                if (i == index) glyphVal = glyphs[i];
                if (i >= numGlyphs) break;
            }
            return glyphVal;
        }

        void main() {
            float charScale = mix(4.0, 48.0, scale / 100.0);
            vec2 charSize = vec2(charScale, charScale * 1.5);
            
            vec2 numChars = floor(resolution / charSize);
            vec2 charCoord = floor(vUv * numChars);
            vec2 localPos = fract(vUv * numChars);

            vec2 sampleUV = (charCoord + 0.5) / numChars;
            vec4 origColor = texture2D(tInput, sampleUV);

            float g = mix(0.1, 4.0, asciiGamma / 100.0);
            float lum = pow(max(luminance(origColor.rgb), 0.0), g);

            float draw = character(getGlyph(lum), localPos - 0.5);
            
            vec3 col;
            if (colorMode == 0) {
                col = origColor.rgb * draw;
            } else if (colorMode == 1) {
                col = vec3(lum) * draw;
            } else {
                col = textColor * draw;
            }
            
            vec3 backCol = vec3(0.0);
            if (background == 0) {
                backCol = texture2D(tInput, vUv).rgb * (1.0 - draw);
            } else {
                backCol = bgColor * (1.0 - draw);
            }
            
            vec3 finalColor = col + backCol;

            gl_FragColor = vec4(finalColor, origColor.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        resolution: (_, ctx) => [ctx.width, ctx.height],
        scale: (params) => params.scale ?? 50.0,
        asciiGamma: (params) => params.asciiGamma ?? 50.0,
        asciiPhase: (params) => params.asciiPhase ?? 0.0,
        colorMode: (params) => {
            if (typeof params.colorMode === 'string') {
                const MODES: Record<string, number> = { 'Texture': 0, 'Grayscale': 1, 'Monochrome': 2 };
                return MODES[params.colorMode] ?? 0;
            }
            return params.colorMode ?? 0;
        },
        background: (params) => params.background ? 1 : 0,
        bgColor: (params) => typeof params.bgColor === 'string' ? hexToVec3(params.bgColor) : [0, 0, 0],
        textColor: (params) => typeof params.textColor === 'string' ? hexToVec3(params.textColor) : [1, 1, 1],
        invertOrder: (params) => params.invertOrder ? 1 : 0,
        glyphs: (params) => {
            const chars = (params.characters as string) || ' ';
            const glyphs = new Array(32).fill(0);
            let numGlyphs = Math.min(chars.length, 32);
            if (numGlyphs === 0) { glyphs[0] = 0; numGlyphs = 1; }
            for (let i = 0; i < numGlyphs; i++) {
                glyphs[i] = ASCII_FONT[chars[i]] ?? 15243268;
            }
            return glyphs;
        },
        numGlyphs: (params) => {
            const chars = (params.characters as string) || ' ';
            return Math.max(1, Math.min(chars.length, 32));
        },
    }
};
