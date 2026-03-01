import type { EffectProvider } from '../types';

export const unsharpMask: EffectProvider = {
    id: 'unsharp_mask',
    name: 'Unsharp Mask',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform vec2 texelSize;  // 1.0 / vec2(width, height)
        uniform float amount;    // 0.0 – 3.0
        uniform float radius;    // 0.5 – 5.0  (controls blur kernel spread)
        varying vec2 vUv;

        void main() {
            vec4 original = texture2D(tInput, vUv);

            // 9-tap Gaussian blur approximation
            vec4 blur = vec4(0.0);
            float r = radius;
            blur += texture2D(tInput, vUv + vec2(-r, -r) * texelSize) * 0.0625;
            blur += texture2D(tInput, vUv + vec2( 0.0, -r) * texelSize) * 0.125;
            blur += texture2D(tInput, vUv + vec2( r, -r) * texelSize) * 0.0625;
            blur += texture2D(tInput, vUv + vec2(-r,  0.0) * texelSize) * 0.125;
            blur += texture2D(tInput, vUv) * 0.25;
            blur += texture2D(tInput, vUv + vec2( r,  0.0) * texelSize) * 0.125;
            blur += texture2D(tInput, vUv + vec2(-r,  r) * texelSize) * 0.0625;
            blur += texture2D(tInput, vUv + vec2( 0.0,  r) * texelSize) * 0.125;
            blur += texture2D(tInput, vUv + vec2( r,  r) * texelSize) * 0.0625;

            // Unsharp mask = original + amount * (original - blur)
            vec4 sharpened = original + amount * (original - blur);

            gl_FragColor = vec4(clamp(sharpened.rgb, 0.0, 1.0), original.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        texelSize: (_, ctx) => [1.0 / ctx.width, 1.0 / ctx.height],
        amount: (params) => params.amount ?? 0.0,
        radius: (params) => params.radius ?? 1.0,
    }
};

export const addNoise: EffectProvider = {
    id: 'add_noise',
    name: 'Add Noise',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float noiseAmount;  // 0.0 – 1.0
        uniform float seed;         // Animated seed for variation
        varying vec2 vUv;

        // Hash-based pseudo random
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            vec4 color = texture2D(tInput, vUv);
            float noise = random(vUv + seed) * 2.0 - 1.0;
            color.rgb += noise * noiseAmount;
            gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        noiseAmount: (params) => params.noiseAmount ?? 0.0,
        seed: (params, ctx) => (params.seed ?? 0.0) + ctx.time, // Adding time for animated noise
    }
};

export const ripple: EffectProvider = {
    id: 'ripple',
    name: 'Ripple',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float amplitude;   // 0.0 – 0.05
        uniform float frequency;   // 1.0 – 50.0
        uniform float phase;       // 0.0 – 6.28
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;

            // Horizontal + vertical sine displacement
            uv.x += sin(uv.y * frequency + phase) * amplitude;
            uv.y += cos(uv.x * frequency + phase) * amplitude;

            gl_FragColor = texture2D(tInput, clamp(uv, 0.0, 1.0));
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        amplitude: (params) => params.amplitude ?? 0.0,
        frequency: (params) => params.frequency ?? 10.0,
        phase: (params) => params.phase ?? 0.0,
    }
};

export const minimum: EffectProvider = {
    id: 'minimum',
    name: 'Minimum (Erode)',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform vec2 texelSize;  // 1.0 / vec2(width, height)
        uniform float radius;    // 1.0 – 5.0
        varying vec2 vUv;

        void main() {
            vec4 minColor = texture2D(tInput, vUv);

            // Sample 3x3 neighborhood
            for (float x = -1.0; x <= 1.0; x += 1.0) {
                for (float y = -1.0; y <= 1.0; y += 1.0) {
                    vec2 offset = vec2(x, y) * texelSize * radius;
                    vec4 s = texture2D(tInput, vUv + offset);
                    minColor = min(minColor, s);
                }
            }

            gl_FragColor = minColor;
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        texelSize: (_, ctx) => [1.0 / ctx.width, 1.0 / ctx.height],
        radius: (params) => params.radius ?? 1.0,
    }
};

export const findEdges: EffectProvider = {
    id: 'find_edges',
    name: 'Find Edges',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform vec2 texelSize;  // 1.0 / vec2(width, height)
        uniform float strength;  // 0.5 – 3.0
        varying vec2 vUv;

        float luminance(vec3 c) {
            return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
            // Sobel kernels
            float tl = luminance(texture2D(tInput, vUv + vec2(-1, -1) * texelSize).rgb);
            float tm = luminance(texture2D(tInput, vUv + vec2( 0, -1) * texelSize).rgb);
            float tr = luminance(texture2D(tInput, vUv + vec2( 1, -1) * texelSize).rgb);
            float ml = luminance(texture2D(tInput, vUv + vec2(-1,  0) * texelSize).rgb);
            float mr = luminance(texture2D(tInput, vUv + vec2( 1,  0) * texelSize).rgb);
            float bl = luminance(texture2D(tInput, vUv + vec2(-1,  1) * texelSize).rgb);
            float bm = luminance(texture2D(tInput, vUv + vec2( 0,  1) * texelSize).rgb);
            float br = luminance(texture2D(tInput, vUv + vec2( 1,  1) * texelSize).rgb);

            // Sobel X and Y
            float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
            float gy = -tl - 2.0*tm - tr + bl + 2.0*bm + br;

            float edge = sqrt(gx*gx + gy*gy) * strength;

            gl_FragColor = vec4(vec3(edge), 1.0);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        texelSize: (_, ctx) => [1.0 / ctx.width, 1.0 / ctx.height],
        strength: (params) => params.strength ?? 1.0,
    }
};
