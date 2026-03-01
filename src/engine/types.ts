import type { Texture2D, Framebuffer2D, Regl } from 'regl';

export interface RenderContext {
    inputTex: Texture2D | Framebuffer2D;
    width: number;
    height: number;
    time: number;
}

export interface EffectProvider {
    id: string; // Must map to effect.type from editorStore

    name: string; // Human readable name for the UI

    fragmentShader: string;
    vertexShader?: string; // Optional override, otherwise uses standard baseVertexShader

    // Evaluators to map UI params -> WebGL uniforms
    // The key is the exact uniform name used in the shader.
    uniforms: Record<string, (params: any, context: RenderContext) => any>;

    // Optional setup hooks for complex effects that need own FBOs/textures
    init?: (regl: Regl) => void;

    // Optional cleanup
    destroy?: () => void;
}
