import type { EffectPlugin } from '../types';
import type { EffectParams } from '@/store/editorStore';
import { ASCII_IMPORT_FONTS, DEFAULT_ASCII_IMPORT_FONT_ID } from '@/lib/importLayerFile';
import type { Regl } from 'regl';

export interface AsciiParams {
    preset: string;
    characters: string;
    scale: number;
    asciiGamma: number;
    asciiPhase: number;
    lineHeight: number;
    letterSpacing: number;
    colorMode: 'Texture' | 'Grayscale' | 'Monochrome';
    fontFamily: string;
    background: boolean;
    removeBgV2: boolean;
    bgColor: string;
    textColor: string;
    invertOrder: boolean;
}

const ASCII_PRESET_MAP: Record<string, string> = {
    Classic: ' .:-=+*#%@',
    Minimal: ' .+',
    Binary: ' 01',
    Matrix: ' abcdefghijklmnopqrstuvwxyz0123456789$+-*/=%\"\'#&_(),.;:?!\\|{}<>[]^~',
    Hex: ' 0123456789ABCDEF',
    Grades: ' FDCBAS+',
    Math: ' +-*/=∑∫∂∆∇∞≈≠≡≤≥',
    Punctuation: ' .,:;!?\'"()[]{}',
    Brackets: ' ()[]{}<>',
    Angles: ' /\\',
    Slashes: ' /\\|',
    Quotes: ' \'"',
    Alpha: ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
    Lower: ' abcdefghijklmnopqrstuvwxyz',
    Numeric: ' 0123456789',
    Vowels: ' aeiouAEIOU',
    Consonants: ' bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ',
    Lines: ' -_\\/|',
    Dense: ' @#W$08Q&m%O0o*=+~-:,.',
    Sparse: ' .',
    Stars: ' *',
    Mixed: ' ...---...:::;;;;',
};

export function applyAsciiPreset(preset: string, params: EffectParams): EffectParams {
    const chars = ASCII_PRESET_MAP[preset];
    if (!chars) return params;
    return { ...params, preset, characters: chars };
}

const ASCII_FONT_FAMILY_BY_ID = new Map<string, string>(
    ASCII_IMPORT_FONTS.map((font) => [font.id, font.family] as [string, string]),
);
const ASCII_FONT_STYLE: Record<string, { size: number; weight: number; yOffset: number }> = {
    'sf-mono': { size: 6.0, weight: 700, yOffset: 0.0 },
    'jetbrains': { size: 6.0, weight: 600, yOffset: -0.02 },
    'menlo': { size: 6.1, weight: 500, yOffset: 0.0 },
    'consolas': { size: 6.0, weight: 700, yOffset: -0.02 },
    'roboto-mono': { size: 5.9, weight: 700, yOffset: 0.02 },
    'courier-new': { size: 6.2, weight: 400, yOffset: 0.0 },
    'lucida-console': { size: 6.0, weight: 700, yOffset: 0.0 },
};

function getAsciiFontFamily(fontId: string): string {
    return ASCII_FONT_FAMILY_BY_ID.get(fontId)
        ?? ASCII_FONT_FAMILY_BY_ID.get(DEFAULT_ASCII_IMPORT_FONT_ID)
        ?? 'monospace';
}

function hexToVec3(hex: string): [number, number, number] {
    const h = String(hex ?? '#000000').replace('#', '').padEnd(6, '0').slice(0, 6);
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
    ];
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function coerceBooleanFlag(value: unknown, defaultValue = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
        if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off' || normalized === '') return false;
    }
    return defaultValue;
}

// ── Helper: Signed Distance Field ───────────────────────────────────────────
const SDF_GLYPH_WIDTH = 128;
const SDF_GLYPH_HEIGHT = 192; // 1:1.5 aspect ratio to match shader
const SDF_MAX_DIST = 24;      // Increased search radius for larger res
const SDF_CANVAS = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const SDF_ATLAS_CACHE = new Map<string, { texture: any, numGlyphs: number }>();

function buildSDFAtlas(chars: string, fontId: string, regl: Regl): { texture: any, numGlyphs: number } {
    const numGlyphs = Math.max(1, Math.min(chars.length, 64)); // Up to 64 chars
    const actualChars = chars.padEnd(1, ' ');

    const cacheKey = `${fontId}_${actualChars.substring(0, numGlyphs)}`;
    if (SDF_ATLAS_CACHE.has(cacheKey)) {
        return SDF_ATLAS_CACHE.get(cacheKey)!;
    }

    const width = SDF_GLYPH_WIDTH * numGlyphs;
    const height = SDF_GLYPH_HEIGHT;

    if (!SDF_CANVAS) {
        SDF_ATLAS_CACHE.set(cacheKey, { texture: regl.texture({ width: 1, height: 1 }), numGlyphs });
        return SDF_ATLAS_CACHE.get(cacheKey)!;
    }

    SDF_CANVAS.width = width;
    SDF_CANVAS.height = height;
    const ctx = SDF_CANVAS.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { texture: regl.texture({ width: 1, height: 1 }), numGlyphs };

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const style = ASCII_FONT_STYLE[fontId] ?? ASCII_FONT_STYLE[DEFAULT_ASCII_IMPORT_FONT_ID];
    const fontSize = SDF_GLYPH_HEIGHT * 0.75; // Adjust relative to height
    ctx.font = `${style.weight} ${fontSize}px ${getAsciiFontFamily(fontId)}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < numGlyphs; i++) {
        const char = actualChars[i] || ' ';
        const cx = (i + 0.5) * SDF_GLYPH_WIDTH;
        const cy = SDF_GLYPH_HEIGHT * (0.5 + style.yOffset);
        // Add a slight vertical offset adjustment if the font has an inherent baseline shift
        ctx.fillText(char, cx, cy);
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    const inData = imgData.data;
    const sdfData = new Uint8Array(width * height);

    for (let i = 0; i < numGlyphs; i++) {
        const cellStartX = i * SDF_GLYPH_WIDTH;
        const cellEndX = cellStartX + SDF_GLYPH_WIDTH;

        for (let y = 0; y < height; y++) {
            for (let x = cellStartX; x < cellEndX; x++) {
                const pxIdx = (y * width + x) * 4;
                const isInside = inData[pxIdx] < 128;
                let minSqDist = SDF_MAX_DIST * SDF_MAX_DIST;

                const minSy = Math.max(0, y - SDF_MAX_DIST);
                const maxSy = Math.min(height - 1, y + SDF_MAX_DIST);
                const minSx = Math.max(cellStartX, x - SDF_MAX_DIST);
                const maxSx = Math.min(cellEndX - 1, x + SDF_MAX_DIST);

                for (let sy = minSy; sy <= maxSy; sy++) {
                    for (let sx = minSx; sx <= maxSx; sx++) {
                        const searchIdx = (sy * width + sx) * 4;
                        const searchInside = inData[searchIdx] < 128;
                        if (searchInside !== isInside) {
                            const dx = x - sx;
                            const dy = y - sy;
                            const sqDist = dx * dx + dy * dy;
                            if (sqDist < minSqDist) {
                                minSqDist = sqDist;
                            }
                        }
                    }
                }

                const dist = Math.sqrt(minSqDist);
                let signedDist = isInside ? dist : -dist;
                let normalizedDist = (signedDist / SDF_MAX_DIST) * 0.5 + 0.5;
                sdfData[y * width + x] = Math.max(0, Math.min(255, normalizedDist * 255));
            }
        }
    }

    const texture = regl.texture({
        width,
        height,
        data: sdfData,
        format: 'alpha',
        mag: 'linear',
        min: 'linear',
        flipY: true,
    });

    SDF_ATLAS_CACHE.set(cacheKey, { texture, numGlyphs });
    return SDF_ATLAS_CACHE.get(cacheKey)!;
}

let asciiActiveRegl: Regl | null = null;

export const ascii: EffectPlugin = {
    id: 'ascii',
    name: 'ASCII Art',

    defaultParams: {
        preset: 'Classic',
        characters: ' .:-=+*#%@',
        scale: 55,
        asciiGamma: 40,
        asciiPhase: 0,
        lineHeight: 100,
        letterSpacing: 0,
        colorMode: 'Monochrome',
        fontFamily: DEFAULT_ASCII_IMPORT_FONT_ID,
        background: true,
        removeBgV2: false,
        bgColor: '#000000',
        textColor: '#ffffff',
        invertOrder: true,
    },

    controls: [
        {
            key: 'preset',
            label: 'Preset',
            type: 'select',
            options: Object.keys(ASCII_PRESET_MAP).map((value) => ({ value, label: value })),
        },
        { key: 'characters', label: 'Characters', type: 'text' },
        { key: 'scale', label: 'Scale', type: 'slider', min: 0, max: 100, step: 1 },
        { key: 'asciiGamma', label: 'Gamma', type: 'slider', min: 0, max: 100, step: 1 },
        { key: 'asciiPhase', label: 'Phase', type: 'slider', min: 0, max: 100, step: 1 },
        { key: 'lineHeight', label: 'Line Height', type: 'slider', min: 50, max: 200, step: 1, unit: '%' },
        { key: 'letterSpacing', label: 'Letter Spacing', type: 'slider', min: -50, max: 200, step: 1, unit: '%' },
        {
            key: 'fontFamily',
            label: 'Font',
            type: 'select',
            options: ASCII_IMPORT_FONTS.map((font) => ({ value: font.id, label: font.label })),
        },
        {
            key: 'colorMode',
            label: 'Color Mode',
            type: 'segmented',
            options: [
                { value: 'Texture', label: 'Texture' },
                { value: 'Grayscale', label: 'Grayscale' },
                { value: 'Monochrome', label: 'Mono' },
            ],
        },
        { key: 'background', label: 'Background', type: 'checkbox' },
        { key: 'removeBgV2', label: 'Remove BG v2', type: 'checkbox' },
        { key: 'bgColor', label: 'Background Color', type: 'color', showWhen: (p) => !!p.background && !p.removeBgV2 },
        {
            key: 'textColor',
            label: 'Text Color',
            type: 'color',
            showWhen: (p) => p.colorMode === 'Monochrome',
        },
        { key: 'invertOrder', label: 'Invert', type: 'checkbox' },
    ],

    coerceParams(params: EffectParams | undefined): EffectParams {
        const merged: EffectParams = { ...ascii.defaultParams, ...(params || {}) };

        merged.background = coerceBooleanFlag(merged.background, true);
        merged.removeBgV2 = coerceBooleanFlag(merged.removeBgV2, false);
        merged.lineHeight = clamp(Number(merged.lineHeight), 50, 200);
        merged.letterSpacing = clamp(Number(merged.letterSpacing), -50, 200);
        merged.scale = clamp(Number(merged.scale), 0, 100);
        merged.asciiGamma = clamp(Number(merged.asciiGamma), 0, 100);
        merged.asciiPhase = clamp(Number(merged.asciiPhase), 0, 100);
        merged.bgColor = String(merged.bgColor || '#000000');
        merged.textColor = String(merged.textColor || '#ffffff');

        const preset = String(merged.preset);
        merged.preset = ASCII_PRESET_MAP[preset] ? preset : 'Classic';
        merged.characters = String(merged.characters || ' ');

        const cmode = String(merged.colorMode);
        merged.colorMode = (['Texture', 'Grayscale', 'Monochrome'].includes(cmode) ? cmode : 'Monochrome');

        const fontId = String(merged.fontFamily ?? DEFAULT_ASCII_IMPORT_FONT_ID);
        const validFont = ASCII_IMPORT_FONTS.some((font) => font.id === fontId);
        merged.fontFamily = validFont ? fontId : DEFAULT_ASCII_IMPORT_FONT_ID;

        return merged;
    },

    init(regl) {
        asciiActiveRegl = regl;
    },

    fragmentShader: `
        precision highp float;
        uniform sampler2D tInput;
        uniform sampler2D tGlyphAtlas;
        
        uniform vec2 resolution;
        uniform float scale;
        uniform float asciiGamma;
        uniform float asciiPhase;
        uniform float lineHeight;
        uniform float letterSpacing;
        uniform int colorMode;
        uniform int background;
        uniform int removeBgV2;
        uniform vec3 bgColor;
        uniform vec3 textColor;
        uniform int invertOrder;
        
        uniform float numGlyphs;

        varying vec2 vUv;

        float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

        void main() {
            float charScale = mix(4.0, 48.0, scale / 100.0);
            vec2 baseCharSize = vec2(charScale, charScale * 1.5);
            float spacingMul = max(0.5, 1.0 + (letterSpacing / 100.0));
            float lineMul = max(0.5, lineHeight / 100.0);
            
            vec2 charSize = vec2(
                baseCharSize.x * spacingMul,
                baseCharSize.y * lineMul
            );
            
            // Continuous cell coordinates to avoid discrete stepping/squashing on resize
            vec2 cellPos = vUv * (resolution / charSize);
            vec2 charCoord = floor(cellPos);
            vec2 localPos = fract(cellPos);
            
            // Determine character rendering area inside the cell perfectly preserving aspect ratio
            vec2 glyphCoverage = baseCharSize / charSize;
            vec2 glyphPos = (localPos - 0.5) / glyphCoverage + 0.5;

            float inBounds = step(0.0, glyphPos.x) * step(glyphPos.x, 1.0) * 
                           step(0.0, glyphPos.y) * step(glyphPos.y, 1.0);

            vec2 sampleUV = (charCoord + 0.5) * charSize / resolution;
            vec4 origColor = texture2D(tInput, sampleUV);

            float g = mix(0.1, 4.0, asciiGamma / 100.0);
            float lum = pow(max(luminance(origColor.rgb), 0.0), g);

            if (invertOrder == 1) lum = 1.0 - lum;

            float fIndex = lum * (numGlyphs - 1.0) + asciiPhase;
            float index = mod(floor(fIndex + 0.5), numGlyphs);
            
            vec2 atlasUv = vec2((index + glyphPos.x) / numGlyphs, glyphPos.y);

            float distance = texture2D(tGlyphAtlas, atlasUv).a;
            
            // Adjust softness relative to the higher resolution SDF
            float softness = 1.0 / charScale;
            float draw = smoothstep(0.5 - softness, 0.5 + softness, distance) * inBounds;

            vec3 col;
            if (colorMode == 0) {
                col = origColor.rgb * draw;
            } else if (colorMode == 1) {
                col = vec3(lum) * draw;
            } else {
                col = textColor * draw;
            }

            if (removeBgV2 == 1) {
                gl_FragColor = vec4(col, origColor.a * draw);
                return;
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
        scale: (params) => Number(ascii.coerceParams(params).scale) ?? 55.0,
        asciiGamma: (params) => Number(ascii.coerceParams(params).asciiGamma) ?? 40.0,
        asciiPhase: (params) => Number(ascii.coerceParams(params).asciiPhase) ?? 0.0,
        lineHeight: (params) => Number(ascii.coerceParams(params).lineHeight) ?? 100.0,
        letterSpacing: (params) => Number(ascii.coerceParams(params).letterSpacing) ?? 0.0,
        colorMode: (params) => {
            const mode = String(ascii.coerceParams(params).colorMode);
            const MODES: Record<string, number> = { 'Texture': 0, 'Grayscale': 1, 'Monochrome': 2 };
            return MODES[mode] ?? 2;
        },
        background: (params) => ascii.coerceParams(params).background ? 1 : 0,
        removeBgV2: (params) => ascii.coerceParams(params).removeBgV2 ? 1 : 0,
        bgColor: (params) => typeof params.bgColor === 'string' ? hexToVec3(params.bgColor) : [0, 0, 0],
        textColor: (params) => typeof params.textColor === 'string' ? hexToVec3(params.textColor) : [1, 1, 1],
        invertOrder: (params) => ascii.coerceParams(params).invertOrder ? 1 : 0,

        tGlyphAtlas: (params) => {
            const p = ascii.coerceParams(params);
            const chars = String(p.characters) || ' ';
            const fontId = String(p.fontFamily);
            if (!asciiActiveRegl) return null; // Fallback
            return buildSDFAtlas(chars, fontId, asciiActiveRegl).texture;
        },
        numGlyphs: (params) => {
            const p = ascii.coerceParams(params);
            const chars = String(p.characters) || ' ';
            const fontId = String(p.fontFamily);
            if (!asciiActiveRegl) return 1.0;
            return buildSDFAtlas(chars, fontId, asciiActiveRegl).numGlyphs;
        },
    }
};
