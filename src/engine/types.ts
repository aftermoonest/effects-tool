import type { Texture2D, Framebuffer2D, Regl } from 'regl';
import type { EffectParams, EffectType } from '@/store/editorStore';

// ----------------------------------------------------------------------
// Effect Rendering Types
// ----------------------------------------------------------------------

export interface RenderContext {
    inputTex: Texture2D | Framebuffer2D;
    width: number;
    height: number;
    time: number;
}

// ----------------------------------------------------------------------
// Effect UI Schema Types
// ----------------------------------------------------------------------

export type EffectParamValue = number | string | boolean | number[];

export interface EffectOption {
    value: string;
    label: string;
}

export type EffectControlType =
    | 'slider'
    | 'select'
    | 'checkbox'
    | 'color'
    | 'text'
    | 'segmented'
    | 'levels_editor'
    | 'curves_editor';

export interface EffectControlDef {
    key: string;
    label: string;
    type: EffectControlType;
    min?: number;
    max?: number;
    step?: number;
    options?: EffectOption[];
    unit?: string;
    showWhen?: (params: EffectParams) => boolean;
    helpText?: string;
}

// ----------------------------------------------------------------------
// Unified Effect Plugin Interface
// ----------------------------------------------------------------------

export interface EffectPlugin {
    // Identifier & Metadata
    id: EffectType;
    name: string;

    // WebGL Rendering Logic
    fragmentShader: string;
    vertexShader?: string;
    uniforms: Record<string, (params: any, context: RenderContext) => any>;
    init?: (regl: Regl) => void;
    destroy?: () => void;

    // UI Configuration
    defaultParams: EffectParams;
    controls: EffectControlDef[];
    isExtension?: boolean;
    helpText?: string;

    // Param Migration & Validation
    coerceParams: (params: EffectParams | undefined) => EffectParams;
}
