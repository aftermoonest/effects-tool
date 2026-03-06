import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { DEFAULT_ASCII_IMPORT_FONT_ID, renderAsciiTextToImage } from '@/lib/importLayerFile';
import { editorSessionStorage, type PersistedEditorState } from './sessionPersistence';

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

export type EffectType =
    | 'brightness_contrast'
    | 'black_white'
    | 'levels'
    | 'curves'
    | 'selective_color'
    | 'unsharp_mask'
    | 'add_noise'
    | 'ripple'
    | 'minimum'
    | 'find_edges'
    | 'ascii'
    | 'dithering'
    | 'stippling'
    | 'cellular_automata';

export type BlendMode =
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'soft_light'
    | 'hard_light'
    | 'difference'
    | 'exclusion'
    | 'color_dodge'
    | 'color_burn';

export type LayerKind = 'image' | 'adjustment' | 'group' | 'mask' | 'solid';

// Generic uniform bag — each effect populates its own keys
export interface EffectParams {
    [key: string]: number | number[] | boolean | string;
}

export interface Effect {
    id: string;
    type: EffectType;
    visible: boolean;
    blendMode: BlendMode;
    opacity: number;        // 0–1
    params: EffectParams;
}

export interface Layer {
    id: string;
    name: string;
    kind: LayerKind;
    visible: boolean;
    opacity: number;        // 0–1
    blendMode: BlendMode;
    effects: Effect[];
    children: string[];     // child layer IDs (only meaningful for 'group')
    parentId: string | null;
    collapsed: boolean;     // UI: whether group is collapsed in tree
    // Spatial properties (used mapped from source, or generic if needed)
    x: number;
    y: number;
    width: number;
    height: number;
    // Image layer data
    sourceImage?: HTMLImageElement;
    imageWidth?: number;
    imageHeight?: number;
    // Mask properties (image layers only)
    isMask?: boolean;       // when true, this image layer acts as an alpha mask
    invertMask?: boolean;   // when true, invert the mask alpha
    maskThreshold?: number; // 0..1 threshold used for luminance-derived mask alpha
    // Solid layer properties
    solidColor?: string;    // hex color (solid layers only)
    // Imported ASCII text source (if this image layer was created from a text file)
    asciiTextSource?: string;
    asciiTextFontId?: string;
}

export interface LayerUndoSnapshot {
    layers: Record<string, Layer>;
    layerOrder: string[];
    activeLayerId: string | null;
}

export interface LayerTransformSnapshot {
    [layerId: string]: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

// ----------------------------------------------------------------------
// Store State & Actions
// ----------------------------------------------------------------------

export interface EditorState {
    // Layer system
    layers: Record<string, Layer>;
    layerOrder: string[];       // root-level ordering (top to bottom visually)
    activeLayerId: string | null;
    activeEffectId: string | null;

    // Canvas dimensions and properties
    canvasWidth: number;
    canvasHeight: number;
    canvasBgColor: string;
    canvasTransparent: boolean;
    asciiImportFontId: string;

    // Viewport zoom & pan
    zoom: number;
    panX: number;
    panY: number;

    // Layer undo (for destructive ops like delete)
    layerUndoStack: LayerUndoSnapshot[];
    layerRedoStack: LayerUndoSnapshot[];

    // Transform behavior
    transformUndoStack: LayerTransformSnapshot[];
    transformRedoStack: LayerTransformSnapshot[];
    transformSessionStart: LayerTransformSnapshot | null;

    // Global trigger for WebGL re-renders
    renderTrigger: number;

    // UI panel state
    shortcutsPanelOpen: boolean;
    effectDropdownRequested: boolean;
    imageUploadRequested: boolean;
    templatesPanelOpen: boolean;
}

export interface EditorActions {
    // Layer CRUD
    addImageLayer: (
        img: HTMLImageElement,
        name?: string,
        options?: { asciiTextSource?: string; asciiTextFontId?: string }
    ) => string;
    addSolidLayer: (name?: string, color?: string) => void;
    addAdjustmentLayer: (name?: string) => void;
    addGroup: (name?: string) => void;
    addMaskLayer: (name?: string) => void;
    removeLayer: (id: string) => void;
    duplicateLayer: (id: string) => void;
    setActiveLayer: (id: string | null) => void;
    toggleLayerVisibility: (id: string) => void;
    renameLayer: (id: string, name: string) => void;
    setLayerOpacity: (id: string, opacity: number) => void;
    setLayerBlendMode: (id: string, mode: BlendMode) => void;
    setSolidLayerColor: (id: string, color: string) => void;
    toggleLayerCollapsed: (id: string) => void;
    toggleLayerMask: (id: string) => void;
    toggleLayerInvertMask: (id: string) => void;
    setLayerMaskThreshold: (id: string, threshold: number) => void;

    // Layer ordering (DnD)
    moveLayerToPosition: (activeId: string, overId: string, intent: 'before' | 'after' | 'into') => void;

    // Effect CRUD (scoped to a layer)
    addEffectToLayer: (layerId: string, effectType: EffectType, defaultParams?: EffectParams) => void;
    removeEffect: (layerId: string, effectId: string) => void;
    duplicateEffect: (layerId: string, effectId: string) => void;
    toggleEffectVisibility: (layerId: string, effectId: string) => void;
    setEffectBlendMode: (layerId: string, effectId: string, mode: BlendMode) => void;
    setEffectOpacity: (layerId: string, effectId: string, opacity: number) => void;
    updateEffectParam: (layerId: string, effectId: string, paramKey: string, value: number | number[] | boolean | string) => void;
    reorderEffects: (layerId: string, fromIndex: number, toIndex: number) => void;

    // Layer transforms
    setLayerTransform: (
        id: string,
        updates: Partial<Pick<Layer, 'x' | 'y' | 'width' | 'height'>>,
        options?: { minSize?: number }
    ) => void;
    setLayerPosition: (id: string, x: number, y: number) => void;
    setLayerSize: (id: string, width: number, height: number, options?: { minSize?: number }) => void;
    beginTransformSession: () => void;
    commitTransformSession: () => void;
    cancelTransformSession: () => void;
    undoTransform: () => void;
    redoTransform: () => void;

    // General undo (layer delete, etc.)
    undoLayerAction: () => void;
    redoLayerAction: () => void;

    // Viewport
    setZoom: (zoom: number) => void;
    setPan: (x: number, y: number) => void;
    fitToScreen: (containerW: number, containerH: number) => void;
    resetZoom: () => void;

    // Canvas
    setCanvasSize: (width: number, height: number) => void;
    setCanvasBg: (color: string, transparent: boolean) => void;
    setAsciiImportFontId: (fontId: string) => void;

    // Templates
    applyTemplate: (bgImg: HTMLImageElement, overlayImg: HTMLImageElement, name: string) => void;

    // Active effect
    setActiveEffect: (effectId: string | null) => void;

    // Render
    triggerRender: () => void;

    // UI panels
    setShortcutsPanelOpen: (open: boolean) => void;
    requestEffectDropdown: () => void;
    clearEffectDropdownRequest: () => void;
    requestImageUpload: () => void;
    clearImageUploadRequest: () => void;
    setTemplatesPanelOpen: (open: boolean) => void;

    // Project persistence
    loadProject: (state: Partial<EditorState>) => void;
    resetEditor: () => void;
}

export type EditorStore = EditorState & EditorActions;

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

const generateId = () => Math.random().toString(36).substr(2, 9);
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;
const DEFAULT_MIN_LAYER_SIZE = 8;
const MAX_TRANSFORM_HISTORY = 100;

let layerCounter = 0;
const nextLayerName = (kind: LayerKind, customName?: string): string => {
    if (customName) return customName;
    layerCounter++;
    switch (kind) {
        case 'image': return `Image ${layerCounter}`;
        case 'solid': return `Solid ${layerCounter}`;
        case 'adjustment': return `Adjustment ${layerCounter}`;
        case 'group': return `Group ${layerCounter}`;
        case 'mask': return `Mask ${layerCounter}`;
    }
};

const toFiniteNumber = (value: number, fallback: number): number => {
    return Number.isFinite(value) ? value : fallback;
};

const captureLayerTransforms = (layers: Record<string, Layer>): LayerTransformSnapshot => {
    const snapshot: LayerTransformSnapshot = {};
    for (const [id, layer] of Object.entries(layers)) {
        snapshot[id] = {
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
        };
    }
    return snapshot;
};

const snapshotsEqual = (a: LayerTransformSnapshot, b: LayerTransformSnapshot): boolean => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
        const va = a[key];
        const vb = b[key];
        if (!vb) return false;
        if (va.x !== vb.x || va.y !== vb.y || va.width !== vb.width || va.height !== vb.height) {
            return false;
        }
    }
    return true;
};

const applyLayerTransforms = (layers: Record<string, Layer>, snapshot: LayerTransformSnapshot): Record<string, Layer> => {
    let changed = false;
    const nextLayers: Record<string, Layer> = {};

    for (const [id, layer] of Object.entries(layers)) {
        const transform = snapshot[id];
        if (!transform) {
            nextLayers[id] = layer;
            continue;
        }

        if (
            layer.x === transform.x
            && layer.y === transform.y
            && layer.width === transform.width
            && layer.height === transform.height
        ) {
            nextLayers[id] = layer;
            continue;
        }

        changed = true;
        nextLayers[id] = {
            ...layer,
            x: transform.x,
            y: transform.y,
            width: transform.width,
            height: transform.height,
        };
    }

    return changed ? nextLayers : layers;
};

// ----------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------

export const useEditorStore = create<EditorStore>()(
    subscribeWithSelector(persist((set, get) => ({
        // Initial State
        layers: {},
        layerOrder: [],
        activeLayerId: null,
        activeEffectId: null,
        canvasWidth: DEFAULT_CANVAS_WIDTH,
        canvasHeight: DEFAULT_CANVAS_HEIGHT,
        canvasBgColor: '#000000',
        canvasTransparent: true,
        asciiImportFontId: DEFAULT_ASCII_IMPORT_FONT_ID,
        zoom: 1,
        panX: 0,
        panY: 0,
        layerUndoStack: [],
        layerRedoStack: [],
        transformUndoStack: [],
        transformRedoStack: [],
        transformSessionStart: null,
        renderTrigger: 0,
        shortcutsPanelOpen: false,
        effectDropdownRequested: false,
        imageUploadRequested: false,
        templatesPanelOpen: false,

        // =====================================================================
        // Layer CRUD
        // =====================================================================

        addImageLayer: (img, name, options) => {
            const id = generateId();
            const layer: Layer = {
                id,
                name: nextLayerName('image', name),
                kind: 'image',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                effects: [],
                children: [],
                parentId: null,
                collapsed: false,
                x: 0,
                y: 0,
                width: img.width,
                height: img.height,
                sourceImage: img,
                imageWidth: img.width,
                imageHeight: img.height,
                asciiTextSource: options?.asciiTextSource,
                asciiTextFontId: options?.asciiTextSource
                    ? (options.asciiTextFontId ?? DEFAULT_ASCII_IMPORT_FONT_ID)
                    : undefined,
            };
            set((state) => {
                const newLayers = { ...state.layers, [id]: layer };
                const isFirstImage = Object.values(state.layers).filter(l => l.kind === 'image').length === 0;
                const hasCanvasSize = state.canvasWidth > 0 && state.canvasHeight > 0;

                // Keep an explicit canvas size; only fall back to image dimensions if canvas size is unset.
                const targetW = isFirstImage && !hasCanvasSize ? img.width : state.canvasWidth;
                const targetH = isFirstImage && !hasCanvasSize ? img.height : state.canvasHeight;

                const scaleX = targetW / img.width;
                const scaleY = targetH / img.height;
                const scale = Math.max(scaleX, scaleY);

                layer.width = img.width * scale;
                layer.height = img.height * scale;

                layer.x = (targetW - layer.width) / 2;
                layer.y = (targetH - layer.height) / 2;

                return {
                    layers: newLayers,
                    layerOrder: [id, ...state.layerOrder], // add to top
                    activeLayerId: id,
                    canvasWidth: targetW,
                    canvasHeight: targetH,
                    renderTrigger: state.renderTrigger + 1,
                };
            });
            return id;
        },

        addSolidLayer: (name, color = '#000000') => {
            const id = generateId();
            set((state) => {
                const width = Math.max(state.canvasWidth, 1);
                const height = Math.max(state.canvasHeight, 1);
                const layer: Layer = {
                    id,
                    name: nextLayerName('solid', name),
                    kind: 'solid',
                    visible: true,
                    opacity: 1,
                    blendMode: 'normal',
                    effects: [],
                    children: [],
                    parentId: null,
                    collapsed: false,
                    x: 0,
                    y: 0,
                    width,
                    height,
                    solidColor: color,
                };
                return {
                    layers: { ...state.layers, [id]: layer },
                    layerOrder: [id, ...state.layerOrder],
                    activeLayerId: id,
                    renderTrigger: state.renderTrigger + 1,
                };
            });
        },

        addAdjustmentLayer: (name) => {
            const id = generateId();
            const layer: Layer = {
                id,
                name: nextLayerName('adjustment', name),
                kind: 'adjustment',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                effects: [],
                children: [],
                parentId: null,
                collapsed: false,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            };
            set((state) => ({
                layers: { ...state.layers, [id]: layer },
                layerOrder: [id, ...state.layerOrder],
                activeLayerId: id,
                renderTrigger: state.renderTrigger + 1,
            }));
        },

        addGroup: (name) => {
            const id = generateId();
            const layer: Layer = {
                id,
                name: nextLayerName('group', name),
                kind: 'group',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                effects: [],
                children: [],
                parentId: null,
                collapsed: false,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            };
            set((state) => ({
                layers: { ...state.layers, [id]: layer },
                layerOrder: [id, ...state.layerOrder],
                activeLayerId: id,
                renderTrigger: state.renderTrigger + 1,
            }));
        },

        addMaskLayer: (name) => {
            const id = generateId();
            const layer: Layer = {
                id,
                name: nextLayerName('mask', name),
                kind: 'mask',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                effects: [],
                children: [],
                parentId: null,
                collapsed: false,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            };
            set((state) => ({
                layers: { ...state.layers, [id]: layer },
                // Masks go to bottom
                layerOrder: [...state.layerOrder, id],
                activeLayerId: id,
                renderTrigger: state.renderTrigger + 1,
            }));
        },

        removeLayer: (id) => set((state) => {
            const newLayers = { ...state.layers };
            const layer = newLayers[id];
            if (!layer) return state;

            // Snapshot for undo
            const snapshot: LayerUndoSnapshot = {
                layers: { ...state.layers },
                layerOrder: [...state.layerOrder],
                activeLayerId: state.activeLayerId,
            };
            const nextUndoStack = [...state.layerUndoStack, snapshot];
            if (nextUndoStack.length > MAX_TRANSFORM_HISTORY) {
                nextUndoStack.splice(0, nextUndoStack.length - MAX_TRANSFORM_HISTORY);
            }

            // Recursively remove children if group
            const toRemove = [id];
            const collectChildren = (layerId: string) => {
                const l = newLayers[layerId];
                if (l?.children) {
                    l.children.forEach(childId => {
                        toRemove.push(childId);
                        collectChildren(childId);
                    });
                }
            };
            collectChildren(id);

            toRemove.forEach(rid => delete newLayers[rid]);

            // Remove from parent's children if nested
            if (layer.parentId && newLayers[layer.parentId]) {
                newLayers[layer.parentId] = {
                    ...newLayers[layer.parentId],
                    children: newLayers[layer.parentId].children.filter(c => c !== id),
                };
            }

            return {
                layers: newLayers,
                layerOrder: state.layerOrder.filter(lid => !toRemove.includes(lid)),
                activeLayerId: state.activeLayerId === id ? null : state.activeLayerId,
                layerUndoStack: nextUndoStack,
                layerRedoStack: [],
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        duplicateLayer: (id) => set((state) => {
            const source = state.layers[id];
            if (!source) return state;

            const newLayers = { ...state.layers };
            const idMap = new Map<string, string>(); // old -> new

            // Deep-clone a layer (and recursively its children for groups)
            const cloneLayer = (srcId: string, newParentId: string | null): string => {
                const src = state.layers[srcId];
                if (!src) return srcId;
                const newId = generateId();
                idMap.set(srcId, newId);

                // Clone children recursively
                const newChildren: string[] = [];
                if (src.kind === 'group') {
                    for (const childId of src.children) {
                        newChildren.push(cloneLayer(childId, newId));
                    }
                }

                // Clone effects with new IDs
                const newEffects = src.effects.map(e => ({
                    ...e,
                    id: generateId(),
                    params: { ...e.params },
                }));

                newLayers[newId] = {
                    ...src,
                    id: newId,
                    name: `${src.name} copy`,
                    children: newChildren,
                    parentId: newParentId,
                    effects: newEffects,
                };

                return newId;
            };

            const newId = cloneLayer(id, source.parentId);

            // Insert right after the original in its container
            let newOrder = [...state.layerOrder];
            if (source.parentId && newLayers[source.parentId]) {
                const parent = newLayers[source.parentId];
                const idx = parent.children.indexOf(id);
                const newChildren = [...parent.children];
                newChildren.splice(idx + 1, 0, newId);
                newLayers[source.parentId] = { ...parent, children: newChildren };
            } else {
                const idx = newOrder.indexOf(id);
                newOrder.splice(idx + 1, 0, newId);
            }

            return {
                layers: newLayers,
                layerOrder: newOrder,
                activeLayerId: newId,
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setActiveLayer: (id) => set({ activeLayerId: id, activeEffectId: null }),
        setActiveEffect: (effectId) => set({ activeEffectId: effectId }),

        toggleLayerVisibility: (id) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, visible: !layer.visible } },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        renameLayer: (id, name) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, name } },
            };
        }),

        setLayerOpacity: (id, opacity) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, opacity: Math.min(Math.max(opacity, 0), 1) } },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setLayerBlendMode: (id, mode) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, blendMode: mode } },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setSolidLayerColor: (id, color) => set((state) => {
            const layer = state.layers[id];
            if (!layer || layer.kind !== 'solid') return state;
            const nextColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : (layer.solidColor ?? '#000000');
            if (nextColor === layer.solidColor) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, solidColor: nextColor } },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        toggleLayerCollapsed: (id) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, collapsed: !layer.collapsed } },
            };
        }),

        toggleLayerMask: (id) => set((state) => {
            const layer = state.layers[id];
            if (!layer || layer.kind !== 'image') return state;
            const newIsMask = !layer.isMask;
            return {
                layers: {
                    ...state.layers,
                    [id]: {
                        ...layer,
                        isMask: newIsMask,
                        invertMask: newIsMask ? layer.invertMask : false,
                        maskThreshold: newIsMask ? (layer.maskThreshold ?? 0.5) : layer.maskThreshold
                    }
                },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        toggleLayerInvertMask: (id) => set((state) => {
            const layer = state.layers[id];
            if (!layer || !layer.isMask) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, invertMask: !layer.invertMask } },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setLayerMaskThreshold: (id, threshold) => set((state) => {
            const layer = state.layers[id];
            if (!layer || !layer.isMask) return state;
            const clamped = Math.min(Math.max(threshold, 0), 1);
            return {
                layers: { ...state.layers, [id]: { ...layer, maskThreshold: clamped } },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        // DnD: move activeId relative to overId
        moveLayerToPosition: (activeId, overId, intent) => set((state) => {
            if (activeId === overId) return state;

            const newLayers = { ...state.layers };
            const activeLayer = newLayers[activeId];
            if (!activeLayer) return state;

            if (overId !== 'ROOT_ZONE') {
                const overLayer = newLayers[overId];
                if (!overLayer) return state;

                // Prevent dropping a group into its own descendant
                if (activeLayer.kind === 'group') {
                    let current = overLayer;
                    while (current.parentId) {
                        if (current.parentId === activeId) return state; // circular
                        current = newLayers[current.parentId];
                    }
                }
            }

            // 1. Remove activeId from its current container
            let newOrder = [...state.layerOrder];
            if (activeLayer.parentId) {
                const parent = newLayers[activeLayer.parentId];
                if (parent) {
                    newLayers[activeLayer.parentId] = {
                        ...parent,
                        children: parent.children.filter(id => id !== activeId)
                    };
                }
            } else {
                newOrder = newOrder.filter(id => id !== activeId);
            }

            // 2. Insert activeId into its new container
            if (overId === 'ROOT_ZONE') {
                newOrder.push(activeId);
                newLayers[activeId] = { ...activeLayer, parentId: null };
            } else {
                const overLayer = newLayers[overId];
                if (intent === 'into' && overLayer.kind === 'group') {
                    // Append to group children
                    newLayers[overId] = {
                        ...overLayer,
                        children: [...overLayer.children, activeId]
                    };
                    newLayers[activeId] = { ...activeLayer, parentId: overId };
                } else {
                    // Reorder at same level as overLayer
                    const newParentId = overLayer.parentId;
                    newLayers[activeId] = { ...activeLayer, parentId: newParentId };

                    if (newParentId) {
                        const parent = newLayers[newParentId];
                        if (parent) {
                            const children = [...parent.children];
                            const overIndex = children.indexOf(overId);
                            const insertIndex = intent === 'before' ? overIndex : overIndex + 1;
                            children.splice(insertIndex, 0, activeId);
                            newLayers[newParentId] = { ...parent, children };
                        }
                    } else {
                        const overIndex = newOrder.indexOf(overId);
                        const insertIndex = intent === 'before' ? overIndex : overIndex + 1;
                        newOrder.splice(insertIndex, 0, activeId);
                    }
                }
            }

            return {
                layers: newLayers,
                layerOrder: newOrder,
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        // =====================================================================
        // Effect CRUD
        // =====================================================================

        addEffectToLayer: (layerId, effectType, defaultParams = {}) => {
            const id = generateId();
            const effect: Effect = {
                id,
                type: effectType,
                visible: true,
                blendMode: 'normal',
                opacity: 1,
                params: defaultParams,
            };
            set((state) => {
                const layer = state.layers[layerId];
                if (!layer) return state;
                return {
                    layers: {
                        ...state.layers,
                        [layerId]: { ...layer, effects: [...layer.effects, effect] },
                    },
                    renderTrigger: state.renderTrigger + 1,
                };
            });
        },

        removeEffect: (layerId, effectId) => set((state) => {
            const layer = state.layers[layerId];
            if (!layer) return state;
            return {
                layers: {
                    ...state.layers,
                    [layerId]: { ...layer, effects: layer.effects.filter(e => e.id !== effectId) },
                },
                activeEffectId: state.activeEffectId === effectId ? null : state.activeEffectId,
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        duplicateEffect: (layerId, effectId) => set((state) => {
            const layer = state.layers[layerId];
            if (!layer) return state;
            const idx = layer.effects.findIndex(e => e.id === effectId);
            if (idx === -1) return state;
            const source = layer.effects[idx];
            const newEffect = {
                ...source,
                id: generateId(),
                params: { ...source.params },
            };
            const newEffects = [...layer.effects];
            newEffects.splice(idx + 1, 0, newEffect);
            return {
                layers: {
                    ...state.layers,
                    [layerId]: { ...layer, effects: newEffects },
                },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        toggleEffectVisibility: (layerId, effectId) => set((state) => {
            const layer = state.layers[layerId];
            if (!layer) return state;
            return {
                layers: {
                    ...state.layers,
                    [layerId]: {
                        ...layer,
                        effects: layer.effects.map(e =>
                            e.id === effectId ? { ...e, visible: !e.visible } : e
                        ),
                    },
                },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setEffectBlendMode: (layerId, effectId, mode) => set((state) => {
            const layer = state.layers[layerId];
            if (!layer) return state;
            return {
                layers: {
                    ...state.layers,
                    [layerId]: {
                        ...layer,
                        effects: layer.effects.map(e =>
                            e.id === effectId ? { ...e, blendMode: mode } : e
                        ),
                    },
                },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setEffectOpacity: (layerId, effectId, opacity) => set((state) => {
            const layer = state.layers[layerId];
            if (!layer) return state;
            return {
                layers: {
                    ...state.layers,
                    [layerId]: {
                        ...layer,
                        effects: layer.effects.map(e =>
                            e.id === effectId ? { ...e, opacity: Math.min(Math.max(opacity, 0), 1) } : e
                        ),
                    },
                },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        updateEffectParam: (layerId, effectId, paramKey, value) => {
            set((state) => {
                const layer = state.layers[layerId];
                if (!layer) return state;
                return {
                    layers: {
                        ...state.layers,
                        [layerId]: {
                            ...layer,
                            effects: layer.effects.map(e =>
                                e.id === effectId
                                    ? { ...e, params: { ...e.params, [paramKey]: value } }
                                    : e
                            ),
                        },
                    },
                    renderTrigger: state.renderTrigger + 1,
                };
            });
        },

        reorderEffects: (layerId, fromIndex, toIndex) => set((state) => {
            const layer = state.layers[layerId];
            if (!layer) return state;
            const effects = [...layer.effects];
            const [moved] = effects.splice(fromIndex, 1);
            effects.splice(toIndex, 0, moved);
            return {
                layers: {
                    ...state.layers,
                    [layerId]: { ...layer, effects },
                },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        // =====================================================================
        // Layer transforms
        // =====================================================================

        setLayerTransform: (id, updates, options) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;

            const minSize = Math.max(options?.minSize ?? DEFAULT_MIN_LAYER_SIZE, 1);

            let nextX = toFiniteNumber(updates.x ?? layer.x, layer.x);
            let nextY = toFiniteNumber(updates.y ?? layer.y, layer.y);
            let nextWidth = Math.max(toFiniteNumber(updates.width ?? layer.width, layer.width), minSize);
            let nextHeight = Math.max(toFiniteNumber(updates.height ?? layer.height, layer.height), minSize);

            if (
                nextX === layer.x
                && nextY === layer.y
                && nextWidth === layer.width
                && nextHeight === layer.height
            ) {
                return state;
            }

            return {
                layers: {
                    ...state.layers,
                    [id]: {
                        ...layer,
                        x: nextX,
                        y: nextY,
                        width: nextWidth,
                        height: nextHeight,
                    },
                },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setLayerPosition: (id, x, y) => {
            get().setLayerTransform(id, { x, y });
        },

        setLayerSize: (id, width, height, options) => {
            get().setLayerTransform(id, { width, height }, options);
        },

        beginTransformSession: () => set((state) => {
            if (state.transformSessionStart) return state;
            return {
                transformSessionStart: captureLayerTransforms(state.layers),
            };
        }),

        commitTransformSession: () => set((state) => {
            const sessionStart = state.transformSessionStart;
            if (!sessionStart) return state;

            const current = captureLayerTransforms(state.layers);
            if (snapshotsEqual(sessionStart, current)) {
                return { transformSessionStart: null };
            }

            const nextUndo = [...state.transformUndoStack, sessionStart];
            if (nextUndo.length > MAX_TRANSFORM_HISTORY) {
                nextUndo.splice(0, nextUndo.length - MAX_TRANSFORM_HISTORY);
            }

            return {
                transformUndoStack: nextUndo,
                transformRedoStack: [],
                transformSessionStart: null,
            };
        }),

        cancelTransformSession: () => set((state) => {
            const sessionStart = state.transformSessionStart;
            if (!sessionStart) return state;
            const restoredLayers = applyLayerTransforms(state.layers, sessionStart);
            const changed = restoredLayers !== state.layers;

            return {
                layers: restoredLayers,
                transformSessionStart: null,
                renderTrigger: changed ? state.renderTrigger + 1 : state.renderTrigger,
            };
        }),

        undoTransform: () => set((state) => {
            if (state.transformUndoStack.length === 0) return state;

            const current = captureLayerTransforms(state.layers);
            const previous = state.transformUndoStack[state.transformUndoStack.length - 1];
            const restoredLayers = applyLayerTransforms(state.layers, previous);
            const changed = restoredLayers !== state.layers;

            const nextUndo = state.transformUndoStack.slice(0, -1);
            const nextRedo = [...state.transformRedoStack, current];
            if (nextRedo.length > MAX_TRANSFORM_HISTORY) {
                nextRedo.splice(0, nextRedo.length - MAX_TRANSFORM_HISTORY);
            }

            return {
                layers: restoredLayers,
                transformUndoStack: nextUndo,
                transformRedoStack: nextRedo,
                transformSessionStart: null,
                renderTrigger: changed ? state.renderTrigger + 1 : state.renderTrigger,
            };
        }),

        redoTransform: () => set((state) => {
            if (state.transformRedoStack.length === 0) return state;

            const current = captureLayerTransforms(state.layers);
            const next = state.transformRedoStack[state.transformRedoStack.length - 1];
            const restoredLayers = applyLayerTransforms(state.layers, next);
            const changed = restoredLayers !== state.layers;

            const nextRedo = state.transformRedoStack.slice(0, -1);
            const nextUndo = [...state.transformUndoStack, current];
            if (nextUndo.length > MAX_TRANSFORM_HISTORY) {
                nextUndo.splice(0, nextUndo.length - MAX_TRANSFORM_HISTORY);
            }

            return {
                layers: restoredLayers,
                transformUndoStack: nextUndo,
                transformRedoStack: nextRedo,
                transformSessionStart: null,
                renderTrigger: changed ? state.renderTrigger + 1 : state.renderTrigger,
            };
        }),

        // =====================================================================
        // Layer undo/redo (destructive ops like delete)
        // =====================================================================

        undoLayerAction: () => set((state) => {
            if (state.layerUndoStack.length === 0) return state;
            const snapshot = state.layerUndoStack[state.layerUndoStack.length - 1];
            const currentSnapshot: LayerUndoSnapshot = {
                layers: state.layers,
                layerOrder: state.layerOrder,
                activeLayerId: state.activeLayerId,
            };
            const nextRedo = [...state.layerRedoStack, currentSnapshot];
            if (nextRedo.length > MAX_TRANSFORM_HISTORY) {
                nextRedo.splice(0, nextRedo.length - MAX_TRANSFORM_HISTORY);
            }
            return {
                layers: snapshot.layers,
                layerOrder: snapshot.layerOrder,
                activeLayerId: snapshot.activeLayerId,
                layerUndoStack: state.layerUndoStack.slice(0, -1),
                layerRedoStack: nextRedo,
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        redoLayerAction: () => set((state) => {
            if (state.layerRedoStack.length === 0) return state;
            const snapshot = state.layerRedoStack[state.layerRedoStack.length - 1];
            const currentSnapshot: LayerUndoSnapshot = {
                layers: state.layers,
                layerOrder: state.layerOrder,
                activeLayerId: state.activeLayerId,
            };
            const nextUndo = [...state.layerUndoStack, currentSnapshot];
            if (nextUndo.length > MAX_TRANSFORM_HISTORY) {
                nextUndo.splice(0, nextUndo.length - MAX_TRANSFORM_HISTORY);
            }
            return {
                layers: snapshot.layers,
                layerOrder: snapshot.layerOrder,
                activeLayerId: snapshot.activeLayerId,
                layerUndoStack: nextUndo,
                layerRedoStack: state.layerRedoStack.slice(0, -1),
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        // =====================================================================
        // Viewport
        // =====================================================================

        setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 0.05), 16) }),
        setPan: (x, y) => set({ panX: x, panY: y }),

        fitToScreen: (containerW, containerH) => {
            const { canvasWidth, canvasHeight } = get();
            if (!canvasWidth || !canvasHeight) return;
            const padding = 40;
            const scaleX = (containerW - padding * 2) / canvasWidth;
            const scaleY = (containerH - padding * 2) / canvasHeight;
            const zoom = Math.min(scaleX, scaleY, 1);
            set({ zoom, panX: 0, panY: 0 });
        },

        resetZoom: () => set({ zoom: 1, panX: 0, panY: 0 }),

        // =====================================================================
        // Canvas
        // =====================================================================

        setCanvasSize: (width, height) => set((state) => ({
            canvasWidth: width,
            canvasHeight: height,
            renderTrigger: state.renderTrigger + 1
        })),

        setCanvasBg: (color, transparent) => set((state) => ({
            canvasBgColor: color,
            canvasTransparent: transparent,
            renderTrigger: state.renderTrigger + 1
        })),

        setAsciiImportFontId: (fontId) => {
            set(() => ({ asciiImportFontId: fontId }));

            const textLayers = Object.entries(get().layers)
                .filter(([, layer]) => layer.kind === 'image' && typeof layer.asciiTextSource === 'string' && layer.asciiTextSource.length > 0)
                .map(([id, layer]) => ({ id, text: layer.asciiTextSource as string }));

            for (const { id, text } of textLayers) {
                void renderAsciiTextToImage(text, { asciiFontId: fontId })
                    .then((image) => {
                        // Ignore stale async results from older font selections.
                        if (get().asciiImportFontId !== fontId) return;

                        set((state) => {
                            const layer = state.layers[id];
                            if (!layer || layer.kind !== 'image' || layer.asciiTextSource !== text) {
                                return state;
                            }

                            return {
                                layers: {
                                    ...state.layers,
                                    [id]: {
                                        ...layer,
                                        sourceImage: image,
                                        imageWidth: image.width,
                                        imageHeight: image.height,
                                        asciiTextFontId: fontId,
                                    },
                                },
                                renderTrigger: state.renderTrigger + 1,
                            };
                        });
                    })
                    .catch((error) => {
                        console.error('[ASCII] Failed to re-render text layer with selected font:', error);
                    });
            }
        },

        // =====================================================================
        // Templates
        // =====================================================================

        applyTemplate: (bgImg, overlayImg, name) => {
            // Reset layer counter
            layerCounter = 0;

            const bgId = generateId();
            const overlayId = generateId();
            const W = 1920;
            const H = 1080;

            // Scale bg to cover canvas
            const bgScaleX = W / bgImg.width;
            const bgScaleY = H / bgImg.height;
            const bgScale = Math.max(bgScaleX, bgScaleY);
            const bgW = bgImg.width * bgScale;
            const bgH = bgImg.height * bgScale;

            // Scale overlay to fit canvas
            const ovScaleX = W / overlayImg.width;
            const ovScaleY = H / overlayImg.height;
            const ovScale = Math.min(ovScaleX, ovScaleY);
            const ovW = overlayImg.width * ovScale;
            const ovH = overlayImg.height * ovScale;

            const bgLayer: Layer = {
                id: bgId,
                name: `${name} — BG`,
                kind: 'image',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                effects: [],
                children: [],
                parentId: null,
                collapsed: false,
                x: (W - bgW) / 2,
                y: (H - bgH) / 2,
                width: bgW,
                height: bgH,
                sourceImage: bgImg,
                imageWidth: bgImg.width,
                imageHeight: bgImg.height,
            };

            const overlayLayer: Layer = {
                id: overlayId,
                name: `${name} — Overlay`,
                kind: 'image',
                visible: true,
                opacity: 1,
                blendMode: 'screen',
                effects: [],
                children: [],
                parentId: null,
                collapsed: false,
                x: (W - ovW) / 2,
                y: (H - ovH) / 2,
                width: ovW,
                height: ovH,
                sourceImage: overlayImg,
                imageWidth: overlayImg.width,
                imageHeight: overlayImg.height,
            };

            set({
                layers: { [bgId]: bgLayer, [overlayId]: overlayLayer },
                layerOrder: [overlayId, bgId],
                activeLayerId: overlayId,
                canvasWidth: W,
                canvasHeight: H,
                canvasBgColor: '#000000',
                canvasTransparent: false,
                layerUndoStack: [],
                layerRedoStack: [],
                transformUndoStack: [],
                transformRedoStack: [],
                transformSessionStart: null,
                renderTrigger: Date.now(),
            });
        },

        // =====================================================================
        // Render trigger
        // =====================================================================

        triggerRender: () => set((state) => ({ renderTrigger: state.renderTrigger + 1 })),

        // UI panels
        setShortcutsPanelOpen: (open) => set({ shortcutsPanelOpen: open }),
        requestEffectDropdown: () => set({ effectDropdownRequested: true }),
        clearEffectDropdownRequest: () => set({ effectDropdownRequested: false }),
        requestImageUpload: () => set({ imageUploadRequested: true }),
        clearImageUploadRequest: () => set({ imageUploadRequested: false }),
        setTemplatesPanelOpen: (open) => set({ templatesPanelOpen: open }),

        // =====================================================================
        // Project persistence
        // =====================================================================

        loadProject: (state) => {
            // Restore layerCounter from loaded layers
            const maxNum = Object.values(state.layers ?? {}).reduce((max, layer) => {
                const match = layer.name.match(/(?:Image|Solid|Adjustment|Group|Mask)\s+(\d+)/);
                return match ? Math.max(max, parseInt(match[1], 10)) : max;
            }, 0);
            layerCounter = maxNum;

            set({
                layers: state.layers ?? {},
                layerOrder: state.layerOrder ?? [],
                activeLayerId: state.activeLayerId ?? null,
                activeEffectId: state.activeEffectId ?? null,
                canvasWidth: state.canvasWidth ?? DEFAULT_CANVAS_WIDTH,
                canvasHeight: state.canvasHeight ?? DEFAULT_CANVAS_HEIGHT,
                canvasBgColor: state.canvasBgColor ?? '#000000',
                canvasTransparent: state.canvasTransparent ?? true,
                asciiImportFontId: state.asciiImportFontId ?? DEFAULT_ASCII_IMPORT_FONT_ID,
                zoom: 1,
                panX: 0,
                panY: 0,
                layerUndoStack: [],
                layerRedoStack: [],
                transformUndoStack: [],
                transformRedoStack: [],
                transformSessionStart: null,
                renderTrigger: Date.now(),
                shortcutsPanelOpen: false,
                effectDropdownRequested: false,
                imageUploadRequested: false,
                templatesPanelOpen: false,
            });
        },

        resetEditor: () => {
            layerCounter = 0;
            set({
                layers: {},
                layerOrder: [],
                activeLayerId: null,
                activeEffectId: null,
                canvasWidth: DEFAULT_CANVAS_WIDTH,
                canvasHeight: DEFAULT_CANVAS_HEIGHT,
                canvasBgColor: '#000000',
                canvasTransparent: true,
                asciiImportFontId: DEFAULT_ASCII_IMPORT_FONT_ID,
                zoom: 1,
                panX: 0,
                panY: 0,
                layerUndoStack: [],
                layerRedoStack: [],
                transformUndoStack: [],
                transformRedoStack: [],
                transformSessionStart: null,
                renderTrigger: Date.now(),
                shortcutsPanelOpen: false,
                effectDropdownRequested: false,
                imageUploadRequested: false,
                templatesPanelOpen: false,
            });
        },
    }), {
        name: 'effects-tool-session',
        storage: editorSessionStorage,
        version: 1,
        partialize: (state): PersistedEditorState => ({
            layers: state.layers,
            layerOrder: state.layerOrder,
            activeLayerId: state.activeLayerId,
            activeEffectId: state.activeEffectId,
            canvasWidth: state.canvasWidth,
            canvasHeight: state.canvasHeight,
            canvasBgColor: state.canvasBgColor,
            canvasTransparent: state.canvasTransparent,
            asciiImportFontId: state.asciiImportFontId,
            zoom: state.zoom,
            panX: state.panX,
            panY: state.panY,
        }),
        merge: (persisted, current) => {
            if (!persisted) return current;
            return {
                ...current,
                ...(persisted as Partial<PersistedEditorState>),
                // Force ephemeral state to defaults
                renderTrigger: 0,
                layerUndoStack: [],
                layerRedoStack: [],
                transformUndoStack: [],
                transformRedoStack: [],
                transformSessionStart: null,
                shortcutsPanelOpen: false,
                effectDropdownRequested: false,
                imageUploadRequested: false,
                templatesPanelOpen: false,
            };
        },
        onRehydrateStorage: () => {
            return (state, error) => {
                if (error) {
                    console.warn('[Persist] Rehydration error:', error);
                    return;
                }
                if (state) {
                    // Restore layerCounter to avoid duplicate layer names
                    const maxNum = Object.values(state.layers).reduce((max, layer) => {
                        const match = layer.name.match(/(?:Image|Solid|Adjustment|Group|Mask)\s+(\d+)/);
                        return match ? Math.max(max, parseInt(match[1], 10)) : max;
                    }, 0);
                    layerCounter = maxNum;
                    state.triggerRender();
                }
            };
        },
    }))
);
