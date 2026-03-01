import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Settings2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { EffectType, EffectParams, Layer } from '@/store/editorStore';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const AVAILABLE_EFFECTS: { id: EffectType; label: string; defaultParams: EffectParams }[] = [
    { id: 'brightness_contrast', label: 'Brightness & Contrast', defaultParams: { brightness: 0, contrast: 0 } },
    { id: 'black_white', label: 'Black & White', defaultParams: {} },
    { id: 'levels', label: 'Levels', defaultParams: { inBlack: 0, inWhite: 1, gamma: 1, outBlack: 0, outWhite: 1 } },
    { id: 'curves', label: 'Curves', defaultParams: { shadows: 0, midtones: 0, highlights: 0 } },
    { id: 'selective_color', label: 'Selective Color', defaultParams: { hueCenter: 0, hueRange: 0.15, satShift: 0, lumShift: 0 } },
    { id: 'unsharp_mask', label: 'Unsharp Mask', defaultParams: { amount: 0.5, radius: 1 } },
    { id: 'add_noise', label: 'Add Noise', defaultParams: { noiseAmount: 0.1 } },
    { id: 'ripple', label: 'Ripple', defaultParams: { amplitude: 0.01, frequency: 10, phase: 0 } },
    { id: 'minimum', label: 'Minimum (Erode)', defaultParams: { radius: 1 } },
    { id: 'find_edges', label: 'Find Edges', defaultParams: { strength: 1 } },
];

// Per-parameter slider configuration: [min, max, step]
const PARAM_RANGES: Record<string, [number, number, number]> = {
    brightness: [-1, 1, 0.01],
    contrast: [-1, 1, 0.01],
    inBlack: [0, 1, 0.01],
    inWhite: [0, 1, 0.01],
    gamma: [0.1, 4, 0.01],
    outBlack: [0, 1, 0.01],
    outWhite: [0, 1, 0.01],
    shadows: [-1, 1, 0.01],
    midtones: [-1, 1, 0.01],
    highlights: [-1, 1, 0.01],
    hueCenter: [0, 1, 0.01],
    hueRange: [0, 0.5, 0.01],
    satShift: [-1, 1, 0.01],
    lumShift: [-1, 1, 0.01],
    amount: [0, 3, 0.01],
    amplitude: [0, 0.05, 0.001],
    frequency: [1, 50, 0.5],
    phase: [0, 6.28, 0.01],
    radius: [0.5, 5, 0.1],
    strength: [0.5, 3, 0.01],
    noiseAmount: [0, 1, 0.01],
};

export const LayerPanel = () => {
    const layers = useEditorStore((s) => s.layers);
    const layerOrder = useEditorStore((s) => s.layerOrder);
    const activeLayerId = useEditorStore((s) => s.activeLayerId);
    const addAdjustmentLayer = useEditorStore((s) => s.addAdjustmentLayer);
    const addEffectToLayer = useEditorStore((s) => s.addEffectToLayer);
    const removeLayer = useEditorStore((s) => s.removeLayer);
    const removeEffect = useEditorStore((s) => s.removeEffect);
    const toggleLayerVisibility = useEditorStore((s) => s.toggleLayerVisibility);
    const toggleEffectVisibility = useEditorStore((s) => s.toggleEffectVisibility);
    const updateEffectParam = useEditorStore((s) => s.updateEffectParam);
    const setActiveLayer = useEditorStore((s) => s.setActiveLayer);

    // Get ordered layers (flattened from tree)
    const getRenderList = () => {
        const list: { layer: Layer; depth: number }[] = [];
        const walk = (ids: string[], depth: number) => {
            for (const id of ids) {
                const layer = layers[id];
                if (!layer) continue;
                list.push({ layer, depth });
                if (layer.kind === 'group' && layer.children.length > 0) {
                    walk(layer.children, depth + 1);
                }
            }
        };
        walk(layerOrder, 0);
        return list;
    };
    const renderList = getRenderList();

    // Add effect: if there's an active layer, add to it; otherwise create a new adjustment layer
    const handleAddEffect = (effectId: EffectType, defaultParams: EffectParams) => {
        if (activeLayerId && layers[activeLayerId]) {
            addEffectToLayer(activeLayerId, effectId, defaultParams);
        } else {
            // Create a new adjustment layer and add the effect to it
            addAdjustmentLayer();
            // The new layer will be active after creation, so add effect on next tick
            setTimeout(() => {
                const state = useEditorStore.getState();
                if (state.activeLayerId) {
                    state.addEffectToLayer(state.activeLayerId, effectId, defaultParams);
                }
            }, 0);
        }
    };

    return (
        <div className="w-80 h-full bg-card border-l border-border flex flex-col uppercase tracking-wider text-xs">

            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/50">
                <h2 className="font-bold flex items-center gap-2 text-sm">
                    <Settings2 size={18} className="text-primary" />
                    Effect Stack
                </h2>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                            <Plus size={16} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                        {AVAILABLE_EFFECTS.map((effect) => (
                            <DropdownMenuItem
                                key={effect.id}
                                onClick={() => handleAddEffect(effect.id, effect.defaultParams)}
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground font-bold"
                            >
                                {effect.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Layers Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {renderList.length === 0 && (
                    <div className="text-muted-foreground text-center py-8 font-mono border border-dashed border-border">
                        Stack Empty
                    </div>
                )}

                {renderList.map(({ layer, depth }) => (
                    <div
                        key={layer.id}
                        style={{ marginLeft: `${depth * 12}px` }}
                        className={`border bg-background p-4 group cursor-pointer ${activeLayerId === layer.id ? 'border-primary' : 'border-border'
                            }`}
                        onClick={() => setActiveLayer(layer.id)}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 w-full overflow-hidden mr-2">
                                <button
                                    className="text-muted-foreground hover:text-foreground shrink-0 p-1"
                                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                                >
                                    {layer.visible ? <Eye size={16} /> : <EyeOff size={16} className="opacity-50" />}
                                </button>
                                <span className={`font-bold text-sm truncate ${layer.visible ? 'text-primary' : 'text-muted-foreground line-through'}`}>
                                    {layer.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">
                                    {layer.kind}
                                </span>
                            </div>

                            <button
                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1"
                                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Effects list within layer */}
                        {layer.visible && layer.effects.length > 0 && (
                            <div className="space-y-3 mt-3 pl-4 border-l border-border/50">
                                {layer.effects.map((effect) => (
                                    <div key={effect.id} className="space-y-2">
                                        <div className="flex items-center gap-2 py-1">
                                            <button
                                                className="text-muted-foreground hover:text-foreground shrink-0 p-1"
                                                onClick={(e) => { e.stopPropagation(); toggleEffectVisibility(layer.id, effect.id); }}
                                            >
                                                {effect.visible ? <Eye size={14} /> : <EyeOff size={14} className="opacity-50" />}
                                            </button>
                                            <span className={`font-bold text-xs ${effect.visible ? '' : 'text-muted-foreground line-through'}`}>
                                                {effect.type.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                            <button
                                                className="text-muted-foreground hover:text-destructive ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                onClick={(e) => { e.stopPropagation(); removeEffect(layer.id, effect.id); }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        {/* Parameter sliders */}
                                        {effect.visible && (
                                            <div className="space-y-3 pl-4">
                                                {Object.entries(effect.params).map(([key, value]) => {
                                                    if (typeof value === 'number') {
                                                        const [min, max, step] = PARAM_RANGES[key] ?? [-1, 1, 0.01];
                                                        return (
                                                            <div key={key} className="space-y-2">
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground font-mono">{key}</span>
                                                                    <span className="font-mono text-primary">{value.toFixed(2)}</span>
                                                                </div>
                                                                <Slider
                                                                    defaultValue={[value]}
                                                                    min={min}
                                                                    max={max}
                                                                    step={step}
                                                                    onValueChange={(val) => updateEffectParam(layer.id, effect.id, key, val[0])}
                                                                />
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

            </div>
        </div>
    );
};
