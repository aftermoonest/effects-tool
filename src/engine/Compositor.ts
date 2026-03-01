import createRegl from 'regl';
import type { Regl, Framebuffer2D, Texture2D } from 'regl';
import { useEditorStore } from '@/store/editorStore';
import type { Layer, Effect } from '@/store/editorStore';
import * as Shaders from './shaders';

export class Compositor {
    private regl: Regl;
    private canvas: HTMLCanvasElement;

    // Per-layer textures for image layers (keyed by layer ID)
    private layerTextures: Record<string, Texture2D> = {};

    // Framebuffer Objects (FBOs) for ping-pong and compositing
    private fboA: Framebuffer2D;
    private fboB: Framebuffer2D;
    private fboC: Framebuffer2D;

    // Cached compiled draw commands
    private drawCommands: Record<string, ReturnType<Regl>> = {};

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

        this.initDrawCommands();

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
            vert: Shaders.flipVertexShader,
            attributes: { position: this.regl.prop<any, 'position'>('position') },
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

        // Brightness / Contrast
        this.drawCommands['brightness_contrast'] = this.regl({
            frag: Shaders.brightnessContrastShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                brightness: this.regl.prop<any, 'brightness'>('brightness'),
                contrast: this.regl.prop<any, 'contrast'>('contrast'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Black & White
        this.drawCommands['black_white'] = this.regl({
            frag: Shaders.blackWhiteShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: { tInput: this.regl.prop<any, 'tInput'>('tInput') },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Levels
        this.drawCommands['levels'] = this.regl({
            frag: Shaders.levelsShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                inBlack: this.regl.prop<any, 'inBlack'>('inBlack'),
                inWhite: this.regl.prop<any, 'inWhite'>('inWhite'),
                gamma: this.regl.prop<any, 'gamma'>('gamma'),
                outBlack: this.regl.prop<any, 'outBlack'>('outBlack'),
                outWhite: this.regl.prop<any, 'outWhite'>('outWhite'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Curves
        this.drawCommands['curves'] = this.regl({
            frag: Shaders.curvesShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                shadows: this.regl.prop<any, 'shadows'>('shadows'),
                midtones: this.regl.prop<any, 'midtones'>('midtones'),
                highlights: this.regl.prop<any, 'highlights'>('highlights'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Selective Color
        this.drawCommands['selective_color'] = this.regl({
            frag: Shaders.selectiveColorShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                hueCenter: this.regl.prop<any, 'hueCenter'>('hueCenter'),
                hueRange: this.regl.prop<any, 'hueRange'>('hueRange'),
                satShift: this.regl.prop<any, 'satShift'>('satShift'),
                lumShift: this.regl.prop<any, 'lumShift'>('lumShift'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Unsharp Mask
        this.drawCommands['unsharp_mask'] = this.regl({
            frag: Shaders.unsharpMaskShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                texelSize: this.regl.prop<any, 'texelSize'>('texelSize'),
                amount: this.regl.prop<any, 'amount'>('amount'),
                radius: this.regl.prop<any, 'radius'>('radius'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Add Noise
        this.drawCommands['add_noise'] = this.regl({
            frag: Shaders.addNoiseShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                noiseAmount: this.regl.prop<any, 'noiseAmount'>('noiseAmount'),
                seed: this.regl.prop<any, 'seed'>('seed'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Ripple
        this.drawCommands['ripple'] = this.regl({
            frag: Shaders.rippleShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                amplitude: this.regl.prop<any, 'amplitude'>('amplitude'),
                frequency: this.regl.prop<any, 'frequency'>('frequency'),
                phase: this.regl.prop<any, 'phase'>('phase'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Minimum (Erode)
        this.drawCommands['minimum'] = this.regl({
            frag: Shaders.minimumShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                texelSize: this.regl.prop<any, 'texelSize'>('texelSize'),
                radius: this.regl.prop<any, 'radius'>('radius'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });

        // Find Edges
        this.drawCommands['find_edges'] = this.regl({
            frag: Shaders.findEdgesShader,
            vert: Shaders.baseVertexShader,
            attributes: { position: QUAD },
            uniforms: {
                tInput: this.regl.prop<any, 'tInput'>('tInput'),
                texelSize: this.regl.prop<any, 'texelSize'>('texelSize'),
                strength: this.regl.prop<any, 'strength'>('strength'),
            },
            framebuffer: this.regl.prop<any, 'outFbo'>('outFbo'),
            count: 6
        });
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
    ): { tex: Framebuffer2D; read: Framebuffer2D; write: Framebuffer2D } {
        const cmd = this.drawCommands[effect.type];
        if (!cmd || !effect.visible) {
            return { tex: currentInputTex as Framebuffer2D, read: readFbo, write: writeFbo };
        }

        this.regl.clear({ color: [0, 0, 0, 0], framebuffer: writeFbo });

        const props: any = { tInput: currentInputTex, outFbo: writeFbo };

        // Inject uniforms from params
        for (const [key, val] of Object.entries(effect.params)) {
            props[key] = val;
        }

        // Auto-inject texelSize for convolution shaders
        const needsTexelSize = ['unsharp_mask', 'minimum', 'find_edges'];
        if (needsTexelSize.includes(effect.type)) {
            props.texelSize = [1.0 / this.canvas.width, 1.0 / this.canvas.height];
        }

        // Auto-inject random seed for noise
        if (effect.type === 'add_noise') {
            props.seed = Math.random() * 100;
        }

        cmd(props);

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
        let layerWriteFbo = this.fboC; // Assuming fboC is declared as a class property

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

                this.regl.clear({ color: [0, 0, 0, 0], framebuffer: layerWriteFbo });
                this.drawCommands['blit_to_fbo']({ tInput: tex, outFbo: layerWriteFbo, position: quadVals });

                let currentLayerTex: Framebuffer2D = layerWriteFbo;

                // Swap so layerReadFbo has the initial image for effects
                let tmp = layerReadFbo;
                layerReadFbo = layerWriteFbo;
                layerWriteFbo = tmp;

                // Apply effects chain on this image layer
                for (const effect of layer.effects) {
                    const result = this.applyEffect(effect, currentLayerTex, layerReadFbo, layerWriteFbo);
                    currentLayerTex = result.tex;
                    layerReadFbo = result.read;
                    layerWriteFbo = result.write;
                }

                // Blend result onto composition FBO
                this.drawCommands['blend_to_fbo']({ tInput: currentLayerTex, outFbo: compFbo, opacity: layer.opacity });

            } else if (layer.kind === 'adjustment') {
                // Adjustment layer: apply its effects to the current composite
                for (const effect of layer.effects) {
                    if (!effect.visible) continue;

                    const result = this.applyEffect(effect, compFbo, layerReadFbo, layerWriteFbo);

                    // The result is in result.tex (which was layerWriteFbo)
                    // We need to swap compFbo to be this new texture.
                    compFbo = result.tex;
                    layerWriteFbo = result.read; // Give layerWriteFbo the old clean buffer
                }
            }
            // TODO: handle 'group' and 'mask' layer kinds
        }

        // Final output to screen
        // Write the composition FBO to screen. Screen clears itself in drawToScreen, then blits compFbo.
        this.drawToScreen(compFbo, clearColor);
    }
}
