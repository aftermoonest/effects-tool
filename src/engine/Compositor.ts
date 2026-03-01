import createRegl from 'regl';
import type { Regl, Framebuffer2D, Texture2D } from 'regl';
import { useEditorStore } from '@/store/editorStore';
import type { Layer, Effect } from '@/store/editorStore';
import * as Shaders from './shaders';
import { effectRegistry } from './effectRegistry';
import type { RenderContext } from './types';
import './effects'; // Register all effect providers

export const ASCII_FONT: Record<string, number> = {
    "0": 15324974, "1": 4591758, "2": 15243551, "3": 31496254, "4": 2304994, "5": 33060926,
    "6": 7633454, "7": 32540804, "8": 15252014, "9": 15252572, "A": 15269425, "B": 32045630,
    "C": 16269839, "D": 32032318, "E": 33061407, "F": 33061392, "G": 16272943, "H": 18415153,
    "I": 14815374, "J": 3180078, "K": 18444881, "L": 17318431, "M": 18732593, "N": 18667121,
    "O": 15255086, "P": 32045584, "Q": 15259213, "R": 32045715, "S": 16267326, "T": 32641156,
    "U": 18400814, "V": 18400580, "W": 18405233, "X": 18157905, "Y": 18157700, "Z": 32575775,
    ".": 8, ":": 262400, "-": 14336, "=": 459200, "+": 145536, "*": 703136, "#": 11512810,
    "%": 17895697, "@": 15261327, " ": 0, "a": 460273, "b": 17332798, "c": 508431, "d": 1097263,
    "e": 491023, "f": 7633160, "g": 509409, "h": 17332785, "i": 4198532, "j": 1049646,
    "k": 17320850, "l": 12718214, "m": 874033, "n": 1001009, "o": 476718, "p": 1001424,
    "q": 509409, "r": 373000, "s": 475646, "t": 9314567, "u": 575023, "v": 574788, "w": 579434,
    "x": 567633, "y": 574945, "z": 1022367, "_": 31, "/": 1118480, "\\": 17043521, "|": 4329604,
    "(": 6562054, ")": 12650572, "[": 14950670, "]": 14747726, "{": 6578438, "}": 12651596,
    "<": 2236546, ">": 8521864, "^": 4539392, "~": 349184, "`": 8519680, "\"": 10813440,
    "'": 4325376, ",": 388, ";": 262404, "!": 4329476, "?": 15243268
};

export class Compositor {
    private regl: Regl;
    private canvas: HTMLCanvasElement;

    // Per-layer textures for image layers (keyed by layer ID)
    private layerTextures: Record<string, Texture2D> = {};

    // Framebuffer Objects (FBOs) for ping-pong and compositing
    private fboA: Framebuffer2D;
    private fboB: Framebuffer2D;
    private fboC: Framebuffer2D;
    private fboD: Framebuffer2D; // New scratch FBO for effect rendering before blending
    private fboE: Framebuffer2D; // Mask rendering scratch FBO

    // Blend mode string → shader int mapping
    private static BLEND_MODE_MAP: Record<string, number> = {
        'normal': 0, 'multiply': 1, 'screen': 2, 'overlay': 3,
        'soft_light': 4, 'hard_light': 5, 'difference': 6, 'exclusion': 7,
        'color_dodge': 8, 'color_burn': 9
    };

    // Cached compiled base draw commands
    private drawCommands: Record<string, ReturnType<Regl>> = {};
    // Dynamic draw commands loaded from the registry
    private dynamicDrawCommands: Record<string, ReturnType<Regl>> = {};

    // For unmounting
    private unsubscribe: () => void;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.regl = createRegl({
            canvas,
            attributes: { preserveDrawingBuffer: true }
        });

        this.fboA = this.regl.framebuffer({ width: 1, height: 1, depth: false, stencil: false });
        this.fboB = this.regl.framebuffer({ width: 1, height: 1, depth: false, stencil: false });
        this.fboC = this.regl.framebuffer({ width: 1, height: 1, depth: false, stencil: false });
        this.fboD = this.regl.framebuffer({ width: 1, height: 1, depth: false, stencil: false });
        this.fboE = this.regl.framebuffer({ width: 1, height: 1, depth: false, stencil: false });

        this.initDrawCommands();
        this.initDynamicEffects(); // Compile registry effects

        // Subscribe to store changes
        this.unsubscribe = useEditorStore.subscribe(
            state => ({
                trigger: state.renderTrigger,
                layers: state.layers,
                layerOrder: state.layerOrder,
                canvasWidth: state.canvasWidth,
                canvasHeight: state.canvasHeight,
                canvasBgColor: state.canvasBgColor,
                canvasTransparent: state.canvasTransparent,
            }),
            (curr) => {
                // Sync textures for image layers
                this.syncLayerTextures(curr.layers);

                // Resize canvas + FBOs if needed
                if (curr.canvasWidth > 0 && curr.canvasHeight > 0) {
                    if (this.canvas.width !== curr.canvasWidth || this.canvas.height !== curr.canvasHeight) {
                        this.canvas.width = curr.canvasWidth;
                        this.canvas.height = curr.canvasHeight;
                        this.fboA.resize(curr.canvasWidth, curr.canvasHeight);
                        this.fboB.resize(curr.canvasWidth, curr.canvasHeight);
                        this.fboC.resize(curr.canvasWidth, curr.canvasHeight);
                        this.fboD.resize(curr.canvasWidth, curr.canvasHeight);
                        this.fboE.resize(curr.canvasWidth, curr.canvasHeight);
                    }
                }

                // Render
                this.render(curr.layers, curr.layerOrder, curr.canvasBgColor, curr.canvasTransparent);
            },
            { equalityFn: (a, b) => a.trigger === b.trigger && a.layers === b.layers }
        );
    }

    public destroy() {
        this.unsubscribe();
        // Clean up layer textures
        Object.values(this.layerTextures).forEach(tex => tex.destroy());
        this.regl.destroy();
    }

    private parseHex(hex: string): [number, number, number, number] {
        const c = parseInt(hex.replace('#', ''), 16);
        return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1];
    }

    // ─── Texture Management ─────────────────────────────────────────────

    private syncLayerTextures(layers: Record<string, Layer>) {
        // Add textures for new image layers
        for (const [id, layer] of Object.entries(layers)) {
            if (layer.kind === 'image' && layer.sourceImage && !this.layerTextures[id]) {
                if (layer.sourceImage.width > 0 && layer.sourceImage.height > 0) {
                    this.layerTextures[id] = this.regl.texture({ data: layer.sourceImage });
                    console.log(`[Compositor] Created texture for layer "${layer.name}" (${layer.sourceImage.width}x${layer.sourceImage.height})`);
                }
            }
        }

        // Remove textures for deleted layers
        for (const id of Object.keys(this.layerTextures)) {
            if (!layers[id]) {
                this.layerTextures[id].destroy();
                delete this.layerTextures[id];
            }
        }
    }

    // ─── Draw Commands ──────────────────────────────────────────────────

    private initDrawCommands() {
        const QUAD = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];

        // Passthrough to screen (uses baseVertexShader — no flip, FBO content is already correct)
        this.drawCommands['screen'] = this.regl({
            frag: Shaders.passthroughFragmentShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: { tInput: this.regl.prop<any, 'tInput'>('tInput') },
            count: 6
        });

        // Blit image texture into FBO (uses flipVertexShader — image textures need Y-flip)
        this.drawCommands['blit_to_fbo'] = this.regl({
            frag: Shaders.passthroughFragmentShader,
            vert: Shaders.positionedImageVertexShader,
            attributes: {
                position: this.regl.prop<any, 'position'>('position'),
                uv: this.regl.prop<any, 'uv'>('uv'),
            },
            uniforms: { tInput: this.regl.prop<any, 'tInput'>('tInput') },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Blend layer temp FBO over composite FBO
        this.drawCommands['blend_to_fbo'] = this.regl({
            frag: `
                precision mediump float;
                uniform sampler2D tInput;
                uniform float opacity;
                varying vec2 vUv;
                void main() {
                    vec4 color = texture2D(tInput, vUv);
                    gl_FragColor = vec4(color.rgb, color.a * opacity);
                }
            `,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                opacity: this.regl.prop<any, 'opacity'>('opacity')
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            blend: {
                enable: true,
                func: {
                    srcRGB: 'src alpha',
                    srcAlpha: 'one',
                    dstRGB: 'one minus src alpha',
                    dstAlpha: 'one minus src alpha'
                }
            },
            count: 6
        });

        // Passthrough FBO to FBO (no flip)
        this.drawCommands['blit_fbo_to_fbo'] = this.regl({
            frag: Shaders.passthroughFragmentShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: { tInput: this.regl.prop<any, 'tInput'>('tInput') },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Blend effect over original using opacity and blend mode
        this.drawCommands['blend_effect'] = this.regl({
            frag: Shaders.blendEffectShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tOriginal: this.regl.prop<any, 'tOriginal'>('tOriginal'),
                tEffect: this.regl.prop<any, 'tEffect'>('tEffect'),
                opacity: this.regl.prop<any, 'opacity'>('opacity'),
                blendMode: this.regl.prop<any, 'blendMode'>('blendMode'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Blend layer onto composite with blend mode + opacity
        this.drawCommands['blend_layer'] = this.regl({
            frag: Shaders.blendLayerShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tBase: this.regl.prop<any, 'tBase'>('tBase'),
                tLayer: this.regl.prop<any, 'tLayer'>('tLayer'),
                opacity: this.regl.prop<any, 'opacity'>('opacity'),
                blendMode: this.regl.prop<any, 'blendMode'>('blendMode'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Apply mask: multiply composite alpha by mask alpha
        this.drawCommands['apply_mask'] = this.regl({
            frag: Shaders.applyMaskShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                tMask: this.regl.prop<any, 'tMask'>('tMask'),
                invertMask: this.regl.prop<any, 'invertMask'>('invertMask'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });
    }

    // Parse GLSL source to detect array uniform declarations like `uniform int foo[32];`
    private static parseArrayUniforms(fragSource: string): Record<string, number> {
        const result: Record<string, number> = {};
        const regex = /uniform\s+\w+\s+(\w+)\[(\d+)\]/g;
        let match;
        while ((match = regex.exec(fragSource)) !== null) {
            result[match[1]] = parseInt(match[2]);
        }
        return result;
    }

    private initDynamicEffects() {
        const QUAD = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
        const providers = effectRegistry.getAll();

        for (const provider of providers) {
            if (provider.init) {
                provider.init(this.regl);
            }

            // Detect array uniforms in the shader source
            const arrayUniforms = Compositor.parseArrayUniforms(provider.fragmentShader);

            const uniformDefs: any = {
                outFbo: this.regl.prop<any, 'outFbo'>('outFbo')
            };

            for (const uniformName of Object.keys(provider.uniforms)) {
                if (arrayUniforms[uniformName]) {
                    // For array uniforms, register each element individually
                    const size = arrayUniforms[uniformName];
                    for (let i = 0; i < size; i++) {
                        const indexedName = `${uniformName}[${i}]`;
                        uniformDefs[indexedName] = this.regl.prop<any, typeof indexedName>(indexedName as any);
                    }
                } else {
                    uniformDefs[uniformName] = this.regl.prop<any, typeof uniformName>(uniformName as any);
                }
            }

            this.dynamicDrawCommands[provider.id] = this.regl({
                frag: provider.fragmentShader,
                vert: provider.vertexShader || Shaders.baseVertexShader,
                attributes: { position: QUAD },
                uniforms: uniformDefs,
                framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
                count: 6
            });
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private drawToScreen(texture: Texture2D | Framebuffer2D, clearColor: [number, number, number, number]) {
        this.regl.clear({ color: clearColor, depth: 1 });
        this.regl({
            viewport: { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height }
        })(() => {
            this.drawCommands['screen']({ tInput: texture });
        });
    }

    // Apply an effect's shader using FBO ping-pong and return the new current input texture
    private applyEffect(
        effect: Effect,
        currentInputTex: Texture2D | Framebuffer2D,
        readFbo: Framebuffer2D,
        writeFbo: Framebuffer2D,
        effectFbo: Framebuffer2D
    ): { tex: Framebuffer2D; read: Framebuffer2D; write: Framebuffer2D } {

        const provider = effectRegistry.get(effect.type);
        const cmd = this.dynamicDrawCommands[effect.type];

        // If the effect is not found in the registry, skip it
        if (!provider || !cmd || !effect.visible) {
            return { tex: currentInputTex as Framebuffer2D, read: readFbo, write: writeFbo };
        }

        // 1. Render the effect specifically to effectFbo
        this.regl.clear({ color: [0, 0, 0, 0], framebuffer: effectFbo });

        const context: RenderContext = {
            inputTex: currentInputTex,
            width: this.canvas.width,
            height: this.canvas.height,
            time: performance.now() / 1000.0
        };

        const evaluatedUniforms: Record<string, any> = { outFbo: effectFbo };

        for (const [uniformName, evaluator] of Object.entries(provider.uniforms)) {
            const value = evaluator(effect.params, context);
            if (Array.isArray(value) && typeof value[0] === 'number' && value.length > 4) {
                // Expand large arrays (like int[32]) into individual indexed entries
                for (let i = 0; i < value.length; i++) {
                    evaluatedUniforms[`${uniformName}[${i}]`] = value[i];
                }
            } else {
                evaluatedUniforms[uniformName] = value;
            }
        }

        console.log(`[Compositor] applyEffect: ${effect.type}`, Object.keys(evaluatedUniforms));
        cmd(evaluatedUniforms);

        // 2. Blend original (currentInputTex) with effect (effectFbo) into writeFbo
        this.regl.clear({ color: [0, 0, 0, 0], framebuffer: writeFbo });

        const BLEND_MODES = Compositor.BLEND_MODE_MAP;

        this.drawCommands['blend_effect']({
            tOriginal: currentInputTex,
            tEffect: effectFbo,
            opacity: effect.opacity ?? 1.0,
            blendMode: BLEND_MODES[effect.blendMode] ?? 0,
            outFbo: writeFbo
        });

        // Swap (the texture is now inside writeFbo, so it becomes the next input / read FBO)
        return { tex: writeFbo, read: writeFbo, write: readFbo };
    }

    // ─── Main Render ────────────────────────────────────────────────────

    private render(layers: Record<string, Layer>, layerOrder: string[], bgColor: string, transparent: boolean) {
        const clearColor = transparent ? [0, 0, 0, 0] as [number, number, number, number] : this.parseHex(bgColor);

        // If no canvas dimensions yet, clear and abort
        if (this.canvas.width <= 1 || this.canvas.height <= 1) {
            this.regl.clear({ color: clearColor, depth: 1 });
            return;
        }

        // Flatten visible layers top-to-bottom visually
        const getFlattenedLayers = (): Layer[] => {
            const list: Layer[] = [];
            const walk = (ids: string[]) => {
                for (const id of ids) {
                    const layer = layers[id];
                    if (!layer || !layer.visible) continue;
                    list.push(layer);
                    if (layer.kind === 'group' && layer.children.length > 0) {
                        walk(layer.children);
                    }
                }
            };
            walk(layerOrder);
            return list;
        };

        const flatVisibleLayers = getFlattenedLayers();
        // Walk layers bottom-to-top for rendering
        const renderList = flatVisibleLayers.reverse();

        // No visible layers → clear
        if (renderList.length === 0) {
            this.regl.clear({ color: clearColor, depth: 1 });
            return;
        }

        let compFbo = this.fboA;
        let layerReadFbo = this.fboB;
        let layerWriteFbo = this.fboC;
        let effectFbo = this.fboD;
        const maskFbo = this.fboE;

        this.regl.clear({ color: clearColor, framebuffer: compFbo });

        for (const layer of renderList) {
            if (layer.kind === 'image') {
                // Image layer: start from its texture
                const tex = this.layerTextures[layer.id];
                if (!tex) continue;

                // Dynamic position based on layer dimensions vs canvas dimensions
                const cw = this.canvas.width;
                const ch = this.canvas.height;
                const x0 = (layer.x / cw) * 2 - 1;
                const y0 = 1 - (layer.y / ch) * 2;
                const x1 = ((layer.x + layer.width) / cw) * 2 - 1;
                const y1 = 1 - ((layer.y + layer.height) / ch) * 2;

                const quadVals = [
                    x0, y1, x1, y1, x0, y0,
                    x1, y0, x0, y0, x1, y1
                ];
                const uvVals = [
                    0, 0, 1, 0, 0, 1,
                    1, 1, 0, 1, 1, 0
                ];

                this.regl.clear({ color: [0, 0, 0, 0], framebuffer: layerWriteFbo });
                this.drawCommands['blit_to_fbo']({
                    tInput: tex,
                    outFbo: layerWriteFbo,
                    position: quadVals,
                    uv: uvVals
                });

                let currentLayerTex: Framebuffer2D = layerWriteFbo;

                // Swap so layerReadFbo has the initial image for effects
                let tmp = layerReadFbo;
                layerReadFbo = layerWriteFbo;
                layerWriteFbo = tmp;

                // Apply effects chain on this image layer
                for (const effect of layer.effects) {
                    const result = this.applyEffect(effect, currentLayerTex, layerReadFbo, layerWriteFbo, effectFbo);
                    currentLayerTex = result.tex;
                    layerReadFbo = result.read;
                    layerWriteFbo = result.write;
                }

                if (layer.isMask) {
                    // Mask layer: use its alpha to clip the composite
                    this.regl.clear({ color: [0, 0, 0, 0], framebuffer: maskFbo });
                    this.drawCommands['apply_mask']({
                        tInput: compFbo,
                        tMask: currentLayerTex,
                        invertMask: layer.invertMask ? 1 : 0,
                        outFbo: maskFbo
                    });
                    // Copy result back into compFbo
                    this.regl.clear({ color: [0, 0, 0, 0], framebuffer: compFbo });
                    this.drawCommands['blit_fbo_to_fbo']({ tInput: maskFbo, outFbo: compFbo });
                } else {
                    // Normal image layer: blend onto composite with blend mode + opacity
                    this.regl.clear({ color: [0, 0, 0, 0], framebuffer: maskFbo });
                    this.drawCommands['blend_layer']({
                        tBase: compFbo,
                        tLayer: currentLayerTex,
                        opacity: layer.opacity,
                        blendMode: Compositor.BLEND_MODE_MAP[layer.blendMode] ?? 0,
                        outFbo: maskFbo
                    });
                    // Copy result back into compFbo
                    this.regl.clear({ color: [0, 0, 0, 0], framebuffer: compFbo });
                    this.drawCommands['blit_fbo_to_fbo']({ tInput: maskFbo, outFbo: compFbo });
                }

            } else if (layer.kind === 'adjustment') {
                // Adjustment layer: apply its effects to the current composite
                for (const effect of layer.effects) {
                    if (!effect.visible) continue;

                    const result = this.applyEffect(effect, compFbo, layerReadFbo, layerWriteFbo, effectFbo);

                    // The result is in result.tex (which was layerWriteFbo)
                    // We need to swap compFbo to be this new texture.
                    compFbo = result.tex;
                    layerWriteFbo = result.read; // Give layerWriteFbo the old clean buffer
                }
            }
        }

        // Final output to screen
        this.drawToScreen(compFbo, clearColor);
    }
}
