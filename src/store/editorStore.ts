import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

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
    | 'ascii';

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

export type LayerKind = 'image' | 'adjustment' | 'group' | 'mask';

// Generic uniform bag — each effect populates its own keys
export interface EffectParams {
    [key: string]: number | number[] | boolean;
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
}

// ----------------------------------------------------------------------
// Store State & Actions
// ----------------------------------------------------------------------

export interface EditorState {
    // Layer system
    layers: Record<string, Layer>;
    layerOrder: string[];       // root-level ordering (top to bottom visually)
    activeLayerId: string | null;

    // Canvas dimensions and properties
    canvasWidth: number;
    canvasHeight: number;
    canvasBgColor: string;
    canvasTransparent: boolean;

    // Viewport zoom & pan
    zoom: number;
    panX: number;
    panY: number;

    // Global trigger for WebGL re-renders
    renderTrigger: number;
}

export interface EditorActions {
    // Layer CRUD
    addImageLayer: (img: HTMLImageElement, name?: string) => void;
    addAdjustmentLayer: (name?: string) => void;
    addGroup: (name?: string) => void;
    addMaskLayer: (name?: string) => void;
    removeLayer: (id: string) => void;
    setActiveLayer: (id: string | null) => void;
    toggleLayerVisibility: (id: string) => void;
    renameLayer: (id: string, name: string) => void;
    setLayerOpacity: (id: string, opacity: number) => void;
    setLayerBlendMode: (id: string, mode: BlendMode) => void;
    toggleLayerCollapsed: (id: string) => void;

    // Layer ordering (DnD)
    moveLayerToPosition: (activeId: string, overId: string, intent: 'before' | 'after' | 'into') => void;

    // Effect CRUD (scoped to a layer)
    addEffectToLayer: (layerId: string, effectType: EffectType, defaultParams?: EffectParams) => void;
    removeEffect: (layerId: string, effectId: string) => void;
    toggleEffectVisibility: (layerId: string, effectId: string) => void;
    setEffectBlendMode: (layerId: string, effectId: string, mode: BlendMode) => void;
    setEffectOpacity: (layerId: string, effectId: string, opacity: number) => void;
    updateEffectParam: (layerId: string, effectId: string, paramKey: string, value: number | number[] | boolean) => void;
    reorderEffects: (layerId: string, fromIndex: number, toIndex: number) => void;

    // Layer transforms
    setLayerPosition: (id: string, x: number, y: number) => void;
    setLayerSize: (id: string, width: number, height: number) => void;

    // Viewport
    setZoom: (zoom: number) => void;
    setPan: (x: number, y: number) => void;
    fitToScreen: (containerW: number, containerH: number) => void;
    resetZoom: () => void;

    // Canvas
    setCanvasSize: (width: number, height: number) => void;
    setCanvasBg: (color: string, transparent: boolean) => void;

    // Render
    triggerRender: () => void;
}

export type EditorStore = EditorState & EditorActions;

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

const generateId = () => Math.random().toString(36).substr(2, 9);

let layerCounter = 0;
const nextLayerName = (kind: LayerKind, customName?: string): string => {
    if (customName) return customName;
    layerCounter++;
    switch (kind) {
        case 'image': return `Image ${layerCounter}`;
        case 'adjustment': return `Adjustment ${layerCounter}`;
        case 'group': return `Group ${layerCounter}`;
        case 'mask': return `Mask ${layerCounter}`;
    }
};

// ----------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------

export const useEditorStore = create<EditorStore>()(
    subscribeWithSelector((set, get) => ({
        // Initial State
        layers: {},
        layerOrder: [],
        activeLayerId: null,
        canvasWidth: 0,
        canvasHeight: 0,
        canvasBgColor: '#000000',
        canvasTransparent: true,
        zoom: 1,
        panX: 0,
        panY: 0,
        renderTrigger: 0,

        // =====================================================================
        // Layer CRUD
        // =====================================================================

        addImageLayer: (img, name) => {
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
            };
            set((state) => {
                const newLayers = { ...state.layers, [id]: layer };
                // If this is the first image, set canvas dimensions
                const isFirst = Object.values(state.layers).filter(l => l.kind === 'image').length === 0;

                // If it's the first image, center it on the new canvas, otherwise center on current canvas
                const targetW = isFirst ? img.width : state.canvasWidth;
                const targetH = isFirst ? img.height : state.canvasHeight;

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
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setActiveLayer: (id) => set({ activeLayerId: id }),

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

        toggleLayerCollapsed: (id) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, collapsed: !layer.collapsed } },
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

        setLayerPosition: (id, x, y) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, x, y } },
                renderTrigger: state.renderTrigger + 1,
            };
        }),

        setLayerSize: (id, width, height) => set((state) => {
            const layer = state.layers[id];
            if (!layer) return state;
            return {
                layers: { ...state.layers, [id]: { ...layer, width, height } },
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

        // =====================================================================
        // Render trigger
        // =====================================================================

        triggerRender: () => set((state) => ({ renderTrigger: state.renderTrigger + 1 })),
    }))
);
