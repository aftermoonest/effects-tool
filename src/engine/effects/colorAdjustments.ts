import type { EffectProvider } from '../types';

export const brightnessContrast: EffectProvider = {
    id: 'brightness_contrast',
    name: 'Brightness / Contrast',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float brightness; // Range: -1.0 to 1.0
        uniform float contrast;   // Range: -1.0 to 1.0
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tInput, vUv);
            
            // Apply Brightness
            color.rgb += brightness;
            
            // Apply Contrast
            if (contrast > 0.0) {
                color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
            } else {
                color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
            }
            
            gl_FragColor = color;
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        brightness: (params) => params.brightness ?? 0.0,
        contrast: (params) => params.contrast ?? 0.0,
    }
};

export const blackWhite: EffectProvider = {
    id: 'black_white',
    name: 'Black & White',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tInput, vUv);
            // Standard luminance dot product representation for human eye
            float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor = vec4(vec3(luminance), color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
    }
};

export const levels: EffectProvider = {
    id: 'levels',
    name: 'Levels',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float inBlack;   // 0.0 – 1.0
        uniform float inWhite;   // 0.0 – 1.0
        uniform float gamma;     // 0.1 – 4.0
        uniform float outBlack;  // 0.0 – 1.0
        uniform float outWhite;  // 0.0 – 1.0
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tInput, vUv);

            // Input range remap
            vec3 c = clamp((color.rgb - inBlack) / max(inWhite - inBlack, 0.001), 0.0, 1.0);

            // Gamma correction
            c = pow(c, vec3(1.0 / max(gamma, 0.01)));

            // Output range remap
            c = mix(vec3(outBlack), vec3(outWhite), c);

            gl_FragColor = vec4(c, color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        inBlack: (params) => (params.inBlack ?? 0.0) / 255.0,
        inWhite: (params) => (params.inWhite ?? 255.0) / 255.0,
        gamma: (params) => params.gamma ?? 1.0,
        outBlack: (params) => (params.outBlack ?? 0.0) / 255.0,
        outWhite: (params) => (params.outWhite ?? 255.0) / 255.0,
    }
};

export const curves: EffectProvider = {
    id: 'curves',
    name: 'Curves',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float shadows;    // -1.0 – 1.0
        uniform float midtones;   // -1.0 – 1.0
        uniform float highlights; // -1.0 – 1.0
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tInput, vUv);

            vec3 c = color.rgb;
            
            // Shadows: bias low values
            c = c + shadows * (1.0 - c) * c;

            // Midtones: gamma shift
            float midGamma = 1.0 / max(1.0 + midtones, 0.01);
            c = pow(c, vec3(midGamma));

            // Highlights: bias high values
            c = c + highlights * c * c;

            gl_FragColor = vec4(clamp(c, 0.0, 1.0), color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        shadows: (params) => params.shadows ?? 0.0,
        midtones: (params) => params.midtones ?? 0.0,
        highlights: (params) => params.highlights ?? 0.0,
    }
};

export const selectiveColor: EffectProvider = {
    id: 'selective_color',
    name: 'Selective Color',
    fragmentShader: `
        precision mediump float;
        uniform sampler2D tInput;
        uniform float hueCenter;   // 0.0 – 1.0 target hue
        uniform float hueRange;    // 0.0 – 0.5 selection width
        uniform float satShift;    // -1.0 – 1.0
        uniform float lumShift;    // -1.0 – 1.0
        varying vec2 vUv;

        vec3 rgb2hsl(vec3 c) {
            float mx = max(max(c.r, c.g), c.b);
            float mn = min(min(c.r, c.g), c.b);
            float l = (mx + mn) * 0.5;
            float s = 0.0;
            float h = 0.0;
            if (mx != mn) {
                float d = mx - mn;
                s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
                if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
                else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
                else h = (c.r - c.g) / d + 4.0;
                h /= 6.0;
            }
            return vec3(h, s, l);
        }

        float hue2rgb(float p, float q, float t) {
            if (t < 0.0) t += 1.0;
            if (t > 1.0) t -= 1.0;
            if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
            if (t < 1.0/2.0) return q;
            if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
            return p;
        }

        vec3 hsl2rgb(vec3 hsl) {
            float h = hsl.x, s = hsl.y, l = hsl.z;
            if (s == 0.0) return vec3(l);
            float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
            float p = 2.0 * l - q;
            return vec3(
                hue2rgb(p, q, h + 1.0/3.0),
                hue2rgb(p, q, h),
                hue2rgb(p, q, h - 1.0/3.0)
            );
        }

        void main() {
            vec4 color = texture2D(tInput, vUv);
            vec3 hsl = rgb2hsl(color.rgb);

            float dist = abs(hsl.x - hueCenter);
            dist = min(dist, 1.0 - dist);

            float mask = 1.0 - smoothstep(hueRange * 0.5, hueRange, dist);
            mask *= hsl.y;

            hsl.y = clamp(hsl.y + satShift * mask, 0.0, 1.0);
            hsl.z = clamp(hsl.z + lumShift * mask, 0.0, 1.0);

            gl_FragColor = vec4(hsl2rgb(hsl), color.a);
        }
    `,
    uniforms: {
        tInput: (_, ctx) => ctx.inputTex,
        hueCenter: (params) => params.hueCenter ?? 0.0,
        hueRange: (params) => params.hueRange ?? 0.1,
        satShift: (params) => params.satShift ?? 0.0,
        lumShift: (params) => params.lumShift ?? 0.0,
    }
};
