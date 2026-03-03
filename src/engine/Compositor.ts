import createRegl from 'regl';
import type { Regl, Framebuffer2D, Texture2D } from 'regl';
import { useEditorStore } from '@/store/editorStore';
import type { Layer, Effect } from '@/store/editorStore';
import * as Shaders from './shaders';
import { effectRegistry } from './effectRegistry';
import type { RenderContext } from './types';
import './effects'; // Register all effect providers
export class Compositor {
    private regl: Regl;
    private canvas: HTMLCanvasElement;

    // Per-layer textures for image layers (keyed by layer ID)
    private layerTextures: Record<string, Texture2D> = {};
    // Tracks the image object currently uploaded to each layer texture.
    private layerTextureSources: Record<string, HTMLImageElement> = {};

    // Framebuffer Objects (FBOs) for ping-pong and compositing
    private fboA: Framebuffer2D;
    private fboB: Framebuffer2D;
    private fboC: Framebuffer2D;
    private fboD: Framebuffer2D; // New scratch FBO for effect rendering before blending
    private fboE: Framebuffer2D; // Mask rendering scratch FBO
    private fboF: Framebuffer2D; // Baseline snapshot for mask-scoped rendering
    private fboG: Framebuffer2D; // Mask-segment working composite

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
    // Effect id -> array uniform names declared in shader (e.g., glyphs[32])
    private dynamicArrayUniformNames: Record<string, Set<string>> = {};
    // Lazily-created FBOs for nested group/mask scopes
    private scopedFbos: Record<string, Framebuffer2D> = {};

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
        this.fboF = this.regl.framebuffer({ width: 1, height: 1, depth: false, stencil: false });
        this.fboG = this.regl.framebuffer({ width: 1, height: 1, depth: false, stencil: false });

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
                        this.fboF.resize(curr.canvasWidth, curr.canvasHeight);
                        this.fboG.resize(curr.canvasWidth, curr.canvasHeight);
                        Object.values(this.scopedFbos).forEach((fbo) => {
                            fbo.resize(curr.canvasWidth, curr.canvasHeight);
                        });
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
        this.layerTextureSources = {};
        Object.values(this.scopedFbos).forEach(fbo => fbo.destroy());
        for (const provider of effectRegistry.getAll()) {
            if (!provider.destroy) continue;
            try {
                provider.destroy();
            } catch (error) {
                console.warn(`[Compositor] Effect cleanup failed: ${provider.id}`, error);
            }
        }
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
            if (layer.kind !== 'image' || !layer.sourceImage) continue;
            if (layer.sourceImage.width <= 0 || layer.sourceImage.height <= 0) continue;

            if (!this.layerTextures[id]) {
                this.layerTextures[id] = this.regl.texture({ data: layer.sourceImage });
                this.layerTextureSources[id] = layer.sourceImage;
                console.log(`[Compositor] Created texture for layer "${layer.name}" (${layer.sourceImage.width}x${layer.sourceImage.height})`);
                continue;
            }

            if (this.layerTextureSources[id] !== layer.sourceImage) {
                try {
                    // Re-upload new bitmap to the existing GPU texture.
                    this.layerTextures[id]({ data: layer.sourceImage });
                } catch {
                    // If dimensions/internal format changed in a way update cannot handle, recreate.
                    this.layerTextures[id].destroy();
                    this.layerTextures[id] = this.regl.texture({ data: layer.sourceImage });
                }
                this.layerTextureSources[id] = layer.sourceImage;
                console.log(`[Compositor] Updated texture for layer "${layer.name}" (${layer.sourceImage.width}x${layer.sourceImage.height})`);
            }
        }

        // Remove textures for deleted layers
        for (const id of Object.keys(this.layerTextures)) {
            if (!layers[id]) {
                this.layerTextures[id].destroy();
                delete this.layerTextures[id];
                delete this.layerTextureSources[id];
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

        // Fill a positioned rectangle with a constant color.
        this.drawCommands['fill_rect_to_fbo'] = this.regl({
            frag: Shaders.solidColorFragmentShader,
            vert: Shaders.positionedColorVertexShader,
            attributes: {
                position: this.regl.prop<any, 'position'>('position'),
            },
            uniforms: {
                fillColor: this.regl.prop<any, 'fillColor'>('fillColor'),
            },
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

        // Apply mask: blend baseline and segment using mask value
        this.drawCommands['apply_mask'] = this.regl({
            frag: Shaders.applyMaskShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tBase: this.regl.prop<any, 'tBase'>('tBase'),
                tSegment: this.regl.prop<any, 'tSegment'>('tSegment'),
                tMask: this.regl.prop<any, 'tMask'>('tMask'),
                invertMask: this.regl.prop<any, 'invertMask'>('invertMask'),
                maskThreshold: this.regl.prop<any, 'maskThreshold'>('maskThreshold'),
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
            this.dynamicArrayUniformNames[provider.id] = new Set(Object.keys(arrayUniforms));

            const uniformDefs: any = {
                outFbo: this.regl.prop<any, 'outFbo'>('outFbo')
            };

            for (const uniformName of Object.keys(provider.uniforms)) {
                if (arrayUniforms[uniformName]) {
                    // Bind each array element explicitly from a single prop array.
                    // Using regl.prop('name[0]') is interpreted as path access and can break.
                    const size = arrayUniforms[uniformName];
                    for (let i = 0; i < size; i++) {
                        const indexedName = `${uniformName}[${i}]`;
                        uniformDefs[indexedName] = (_: any, props: Record<string, unknown>) => {
                            const raw = props[uniformName];
                            return Array.isArray(raw) ? (raw[i] ?? 0) : 0;
                        };
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

    private getScopedFbo(key: string): Framebuffer2D {
        const width = Math.max(this.canvas.width, 1);
        const height = Math.max(this.canvas.height, 1);

        let fbo = this.scopedFbos[key];
        if (!fbo) {
            fbo = this.regl.framebuffer({ width, height, depth: false, stencil: false });
            this.scopedFbos[key] = fbo;
        } else {
            fbo.resize(width, height);
        }

        return fbo;
    }

    private getBlendScratchFbo(depth: number): Framebuffer2D {
        return depth === 0 ? this.fboE : this.getScopedFbo(`blend_scratch_${depth}`);
    }

    private getMaskBaseFbo(depth: number): Framebuffer2D {
        return depth === 0 ? this.fboF : this.getScopedFbo(`mask_base_${depth}`);
    }

    private getMaskSegmentFbo(depth: number): Framebuffer2D {
        return depth === 0 ? this.fboG : this.getScopedFbo(`mask_segment_${depth}`);
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
        const arrayUniformNames = this.dynamicArrayUniformNames[effect.type] ?? new Set<string>();
        const normalizedParams = provider.coerceParams(effect.params);

        for (const [uniformName, evaluator] of Object.entries(provider.uniforms)) {
            const value = evaluator(normalizedParams, context);
            if (arrayUniformNames.has(uniformName) && Array.isArray(value)) {
                evaluatedUniforms[uniformName] = value;
            } else {
                evaluatedUniforms[uniformName] = value;
            }
        }

        console.log(`[Compositor] applyEffect: ${effect.type}`, Object.keys(evaluatedUniforms));
        try {
            cmd(evaluatedUniforms);
        } catch (error) {
            console.error(`[Compositor] Effect draw failed: ${effect.type}`, error);
            return { tex: currentInputTex as Framebuffer2D, read: readFbo, write: writeFbo };
        }

        // 2. Blend original (currentInputTex) with effect (effectFbo) into writeFbo.
        // ASCII and dither cutout modes bypass blend-over-original so the base image
        // never bleeds under transparent output pixels.
        this.regl.clear({ color: [0, 0, 0, 0], framebuffer: writeFbo });
        const isAsciiCutout = effect.type === 'ascii'
            && (normalizedParams.background === false || normalizedParams.removeBgV2 === true);
        const isDitherCutout = effect.type === 'dithering'
            && normalizedParams.useColorMode !== true
            && String(normalizedParams.colorMode ?? 'monochrome') === 'monochrome'
            && (normalizedParams.removeBgV2 === true || normalizedParams.transparentBg === true);

        if (isAsciiCutout || isDitherCutout) {
            this.drawCommands['blit_fbo_to_fbo']({
                tInput: effectFbo,
                outFbo: writeFbo
            });
            return { tex: writeFbo, read: writeFbo, write: readFbo };
        }

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

    private buildImageLayerTexture(
        layer: Layer,
        readFbo: Framebuffer2D,
        writeFbo: Framebuffer2D,
        effectFbo: Framebuffer2D
    ): Framebuffer2D | null {
        const tex = this.layerTextures[layer.id];
        if (!tex) return null;

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

        this.regl.clear({ color: [0, 0, 0, 0], framebuffer: writeFbo });
        this.drawCommands['blit_to_fbo']({
            tInput: tex,
            outFbo: writeFbo,
            position: quadVals,
            uv: uvVals
        });

        let currentLayerTex: Framebuffer2D = writeFbo;
        let layerReadFbo = writeFbo;
        let layerWriteFbo = readFbo;

        for (const effect of layer.effects) {
            const result = this.applyEffect(effect, currentLayerTex, layerReadFbo, layerWriteFbo, effectFbo);
            currentLayerTex = result.tex;
            layerReadFbo = result.read;
            layerWriteFbo = result.write;
        }

        return currentLayerTex;
    }

    private buildSolidLayerTexture(
        layer: Layer,
        readFbo: Framebuffer2D,
        writeFbo: Framebuffer2D,
        effectFbo: Framebuffer2D
    ): Framebuffer2D {
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
        const fillColor = this.parseHex(layer.solidColor ?? '#000000');

        this.regl.clear({ color: [0, 0, 0, 0], framebuffer: writeFbo });
        this.drawCommands['fill_rect_to_fbo']({
            outFbo: writeFbo,
            position: quadVals,
            fillColor,
        });

        let currentLayerTex: Framebuffer2D = writeFbo;
        let layerReadFbo = writeFbo;
        let layerWriteFbo = readFbo;

        for (const effect of layer.effects) {
            const result = this.applyEffect(effect, currentLayerTex, layerReadFbo, layerWriteFbo, effectFbo);
            currentLayerTex = result.tex;
            layerReadFbo = result.read;
            layerWriteFbo = result.write;
        }

        return currentLayerTex;
    }

    private renderLayerOntoTarget(
        layer: Layer,
        layers: Record<string, Layer>,
        targetFbo: Framebuffer2D,
        depth: number,
        readFbo: Framebuffer2D,
        writeFbo: Framebuffer2D,
        effectFbo: Framebuffer2D
    ) {
        const scratchFbo = this.getBlendScratchFbo(depth);

        if (layer.kind === 'image') {
            if (layer.isMask) return;

            const layerTex = this.buildImageLayerTexture(layer, readFbo, writeFbo, effectFbo);
            if (!layerTex) return;

            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: scratchFbo });
            this.drawCommands['blend_layer']({
                tBase: targetFbo,
                tLayer: layerTex,
                opacity: layer.opacity,
                blendMode: Compositor.BLEND_MODE_MAP[layer.blendMode] ?? 0,
                outFbo: scratchFbo
            });

            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: targetFbo });
            this.drawCommands['blit_fbo_to_fbo']({ tInput: scratchFbo, outFbo: targetFbo });
            return;
        }

        if (layer.kind === 'solid') {
            const layerTex = this.buildSolidLayerTexture(layer, readFbo, writeFbo, effectFbo);

            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: scratchFbo });
            this.drawCommands['blend_layer']({
                tBase: targetFbo,
                tLayer: layerTex,
                opacity: layer.opacity,
                blendMode: Compositor.BLEND_MODE_MAP[layer.blendMode] ?? 0,
                outFbo: scratchFbo
            });

            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: targetFbo });
            this.drawCommands['blit_fbo_to_fbo']({ tInput: scratchFbo, outFbo: targetFbo });
            return;
        }

        if (layer.kind === 'adjustment') {
            let currentInput: Texture2D | Framebuffer2D = targetFbo;
            let layerReadFbo = readFbo;
            let layerWriteFbo = writeFbo;

            for (const effect of layer.effects) {
                if (!effect.visible) continue;
                const result = this.applyEffect(effect, currentInput, layerReadFbo, layerWriteFbo, effectFbo);
                currentInput = result.tex;
                layerReadFbo = result.read;
                layerWriteFbo = result.write;
            }

            if (currentInput !== targetFbo) {
                this.regl.clear({ color: [0, 0, 0, 0], framebuffer: targetFbo });
                this.drawCommands['blit_fbo_to_fbo']({ tInput: currentInput, outFbo: targetFbo });
            }
            return;
        }

        if (layer.kind === 'group') {
            const visibleChildren = layer.children.filter((childId) => {
                const child = layers[childId];
                return !!child && child.visible;
            });

            if (visibleChildren.length === 0) return;

            const groupContentFbo = this.getScopedFbo(`group_content_${depth + 1}`);

            // Groups are isolated containers: render children first, then apply group-level effects.
            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: groupContentFbo });
            this.renderLayerListOntoTarget(
                visibleChildren,
                layers,
                groupContentFbo,
                depth + 1,
                readFbo,
                writeFbo,
                effectFbo
            );

            let currentGroupTex: Texture2D | Framebuffer2D = groupContentFbo;
            let groupReadFbo = readFbo;
            let groupWriteFbo = writeFbo;

            for (const effect of layer.effects) {
                if (!effect.visible) continue;
                const result = this.applyEffect(effect, currentGroupTex, groupReadFbo, groupWriteFbo, effectFbo);
                currentGroupTex = result.tex;
                groupReadFbo = result.read;
                groupWriteFbo = result.write;
            }

            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: scratchFbo });
            this.drawCommands['blend_layer']({
                tBase: targetFbo,
                tLayer: currentGroupTex,
                opacity: layer.opacity,
                blendMode: Compositor.BLEND_MODE_MAP[layer.blendMode] ?? 0,
                outFbo: scratchFbo
            });

            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: targetFbo });
            this.drawCommands['blit_fbo_to_fbo']({ tInput: scratchFbo, outFbo: targetFbo });
        }
    }

    private renderLayerListOntoTarget(
        layerIds: string[],
        layers: Record<string, Layer>,
        targetFbo: Framebuffer2D,
        depth: number,
        readFbo: Framebuffer2D,
        writeFbo: Framebuffer2D,
        effectFbo: Framebuffer2D
    ) {
        type LayerSegment = { maskLayer: Layer | null; layers: Layer[] };

        const visibleLayers: Layer[] = [];
        for (const id of layerIds) {
            const layer = layers[id];
            if (!layer || !layer.visible) continue;
            visibleLayers.push(layer);
        }
        if (visibleLayers.length === 0) return;

        const segmentsTopToBottom: LayerSegment[] = [];
        let currentSegment: LayerSegment = { maskLayer: null, layers: [] };

        for (const layer of visibleLayers) {
            if (layer.kind === 'image' && layer.isMask) {
                if (currentSegment.maskLayer || currentSegment.layers.length > 0) {
                    segmentsTopToBottom.push(currentSegment);
                }
                currentSegment = { maskLayer: layer, layers: [] };
                continue;
            }
            currentSegment.layers.push(layer);
        }
        if (currentSegment.maskLayer || currentSegment.layers.length > 0) {
            segmentsTopToBottom.push(currentSegment);
        }

        const scratchFbo = this.getBlendScratchFbo(depth);
        const maskBaseFbo = this.getMaskBaseFbo(depth);
        const segmentFbo = this.getMaskSegmentFbo(depth);

        // Render segments bottom-to-top; each segment has its own mask scope.
        for (let i = segmentsTopToBottom.length - 1; i >= 0; i--) {
            const segment = segmentsTopToBottom[i];

            if (!segment.maskLayer) {
                for (let j = segment.layers.length - 1; j >= 0; j--) {
                    this.renderLayerOntoTarget(
                        segment.layers[j],
                        layers,
                        targetFbo,
                        depth,
                        readFbo,
                        writeFbo,
                        effectFbo
                    );
                }
                continue;
            }

            // Snapshot baseline (content outside this mask segment)
            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: maskBaseFbo });
            this.drawCommands['blit_fbo_to_fbo']({ tInput: targetFbo, outFbo: maskBaseFbo });

            // Render segment in isolation from the same baseline
            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: segmentFbo });
            this.drawCommands['blit_fbo_to_fbo']({ tInput: targetFbo, outFbo: segmentFbo });

            for (let j = segment.layers.length - 1; j >= 0; j--) {
                this.renderLayerOntoTarget(
                    segment.layers[j],
                    layers,
                    segmentFbo,
                    depth,
                    readFbo,
                    writeFbo,
                    effectFbo
                );
            }

            const maskTex = this.buildImageLayerTexture(segment.maskLayer, readFbo, writeFbo, effectFbo);

            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: scratchFbo });
            if (maskTex) {
                this.drawCommands['apply_mask']({
                    tBase: maskBaseFbo,
                    tSegment: segmentFbo,
                    tMask: maskTex,
                    invertMask: segment.maskLayer.invertMask ? 1 : 0,
                    maskThreshold: segment.maskLayer.maskThreshold ?? 0.5,
                    outFbo: scratchFbo
                });
            } else {
                this.drawCommands['blit_fbo_to_fbo']({ tInput: segmentFbo, outFbo: scratchFbo });
            }

            this.regl.clear({ color: [0, 0, 0, 0], framebuffer: targetFbo });
            this.drawCommands['blit_fbo_to_fbo']({ tInput: scratchFbo, outFbo: targetFbo });
        }
    }

    // ─── Main Render ────────────────────────────────────────────────────

    private render(layers: Record<string, Layer>, layerOrder: string[], bgColor: string, transparent: boolean) {
        const clearColor = transparent ? [0, 0, 0, 0] as [number, number, number, number] : this.parseHex(bgColor);

        // If no canvas dimensions yet, clear and abort
        if (this.canvas.width <= 1 || this.canvas.height <= 1) {
            this.regl.clear({ color: clearColor, depth: 1 });
            return;
        }

        const compFbo = this.fboA;
        const layerReadFbo = this.fboB;
        const layerWriteFbo = this.fboC;
        const effectFbo = this.fboD;

        this.regl.clear({ color: clearColor, framebuffer: compFbo });
        this.renderLayerListOntoTarget(layerOrder, layers, compFbo, 0, layerReadFbo, layerWriteFbo, effectFbo);

        // Final output to screen
        this.drawToScreen(compFbo, clearColor);
    }
}
