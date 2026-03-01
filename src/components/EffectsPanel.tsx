import { useState, useRef, useEffect, useCallback } from 'react';
import { PropertiesPanel } from './PropertiesPanel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Settings2, Plus, Trash2, Eye, EyeOff, GripVertical, PanelRightClose, PanelRight, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { Effect, EffectType } from '@/store/editorStore';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Available Effects Catalog ──────────────────────────────────────────

interface EffectDef {
    id: EffectType;
    label: string;
    defaultParams: Record<string, number>;
}

const AVAILABLE_EFFECTS: EffectDef[] = [
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

// ─── Sortable Effect Card ───────────────────────────────────────────────

interface SortableEffectCardProps {
    effect: Effect;
    layerId: string;
    index: number;
}

const SortableEffectCard = ({ effect, layerId }: SortableEffectCardProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: effect.id });
    const toggleEffectVisibility = useEditorStore(s => s.toggleEffectVisibility);
    const removeEffect = useEditorStore(s => s.removeEffect);
    const updateEffectParam = useEditorStore(s => s.updateEffectParam);
    const [isExpanded, setIsExpanded] = useState(true);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const effectLabel = AVAILABLE_EFFECTS.find(e => e.id === effect.type)?.label ?? effect.type;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                relative flex flex-col border-b border-border/50 group bg-background
                transition-colors text-xs uppercase tracking-wider
                ${!effect.visible ? 'opacity-40' : ''}
                ${isDragging ? 'opacity-30 z-50 shadow-xl' : ''}
            `}
        >
            {/* Effect header */}
            <div
                className={`
                    flex items-center gap-2 py-3 pr-2 pl-3 cursor-pointer
                    hover:bg-secondary/30 border-l-2 border-l-transparent
                `}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* Drag handle */}
                <button
                    className="shrink-0 p-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={14} />
                </button>

                {/* Collapse toggle */}
                <button
                    className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-0.5"
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {/* Effect Icon */}
                <Settings2 size={14} className="text-muted-foreground shrink-0" />

                {/* Name */}
                <span className="flex-1 truncate font-bold text-xs pointer-events-none">
                    {effectLabel}
                </span>

                {/* Visibility */}
                <button
                    className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-0.5"
                    onClick={(e) => { e.stopPropagation(); toggleEffectVisibility(layerId, effect.id); }}
                >
                    {effect.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                {/* Delete */}
                <button
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 z-10 relative p-0.5"
                    onClick={(e) => { e.stopPropagation(); removeEffect(layerId, effect.id); }}
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Parameter sliders */}
            {effect.visible && isExpanded && (
                <div className="space-y-4 px-4 pb-4 pt-1 bg-secondary/10 border-t border-border/10">
                    {Object.entries(effect.params).map(([key, value]) => {
                        if (typeof value !== 'number') return null;
                        const [min, max, step] = PARAM_RANGES[key] ?? [-1, 1, 0.01];
                        return (
                            <div key={key} className="space-y-2">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-muted-foreground font-mono uppercase truncate mr-2">{key}</span>
                                    <input
                                        type="number"
                                        value={Number(value.toFixed(3))}
                                        min={min}
                                        max={max}
                                        step={step}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                            updateEffectParam(layerId, effect.id, key, val);
                                        }}
                                        className="w-14 bg-secondary/50 border border-border rounded px-1.5 py-0.5 text-right font-mono text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-primary focus:bg-secondary transition-colors"
                                    />
                                </div>
                                <Slider
                                    value={[value]}
                                    min={min}
                                    max={max}
                                    step={step}
                                    onValueChange={(val) => updateEffectParam(layerId, effect.id, key, val[0])}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Main EffectsPanel Component ────────────────────────────────────────

export const EffectsPanel = () => {
    const layers = useEditorStore(s => s.layers);
    const activeLayerId = useEditorStore(s => s.activeLayerId);
    const addEffectToLayer = useEditorStore(s => s.addEffectToLayer);
    const reorderEffects = useEditorStore(s => s.reorderEffects);

    const activeLayer = activeLayerId ? layers[activeLayerId] : null;

    const [width, setWidth] = useState(288);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState<'properties' | 'effects'>('properties');
    const isResizing = useRef(false);

    const startResizing = useCallback(() => {
        isResizing.current = true;
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
    }, []);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing.current) {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth > 200 && newWidth < 600) {
                    setWidth(newWidth);
                    setIsMinimized(false);
                }
            }
        },
        []
    );

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        if (!activeLayer) return;
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const fromIndex = activeLayer.effects.findIndex(e => e.id === active.id);
        const toIndex = activeLayer.effects.findIndex(e => e.id === over.id);
        if (fromIndex !== -1 && toIndex !== -1) {
            reorderEffects(activeLayer.id, fromIndex, toIndex);
        }
    };

    return (
        <div
            className={`h-full bg-card border-l border-border flex flex-col text-xs relative shrink-0 whitespace-nowrap overflow-hidden ${isResizing.current ? '' : 'transition-[width] duration-300 ease-in-out'}`}
            style={{ width: isMinimized ? 48 : `${width}px` }}
        >
            {/* Drag Handle */}
            {!isMinimized && (
                <div
                    className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-10"
                    onMouseDown={startResizing}
                />
            )}

            {/* Header / Tabs */}
            <div className={`flex flex-col border-b border-border bg-secondary/50 w-full`}>
                <div className={`p-4 flex ${isMinimized ? 'justify-center' : 'justify-between'} items-center uppercase tracking-wider`}>
                    {!isMinimized && (
                        <h2 className="font-bold text-xs flex items-center gap-1.5 truncate">
                            <Settings2 size={14} className="text-primary shrink-0" />
                            Settings
                        </h2>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setIsMinimized(!isMinimized)}>
                            {isMinimized ? <PanelRight size={16} /> : <PanelRightClose size={16} />}
                        </Button>
                    </div>
                </div>

                {!isMinimized && (
                    <div className="flex w-full px-3 pb-3 gap-2">
                        <button
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors ${activeTab === 'properties' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                            onClick={() => setActiveTab('properties')}
                        >
                            Properties
                        </button>
                        <button
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors ${activeTab === 'effects' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                            onClick={() => setActiveTab('effects')}
                        >
                            Effects
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            {!isMinimized ? (
                <div className="flex-1 overflow-y-auto w-full relative">
                    {activeTab === 'properties' ? (
                        <PropertiesPanel />
                    ) : !activeLayer ? (
                        <div className="text-muted-foreground text-center py-8 font-mono uppercase tracking-wider border border-dashed border-border m-3 text-[10px]">
                            Select a layer
                        </div>
                    ) : activeLayer.effects.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8 font-mono uppercase tracking-wider border border-dashed border-border m-3 text-[10px]">
                            <Settings2 size={16} className="mx-auto mb-2 text-muted-foreground/50" />
                            No effects on<br />
                            <span className="text-foreground">{activeLayer.name}</span>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={activeLayer.effects.map(e => e.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {activeLayer.effects.map((effect, index) => (
                                    <SortableEffectCard
                                        key={effect.id}
                                        effect={effect}
                                        layerId={activeLayer.id}
                                        index={index}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto flex flex-col items-center py-4 gap-4 w-full">
                    <Settings2 size={16} className="text-muted-foreground opacity-30" />
                </div>
            )}

            {/* Footer Action */}
            {!isMinimized && activeLayer && activeTab === 'effects' && (
                <div className="p-3 border-t border-border bg-secondary/30 flex justify-center w-full relative z-20">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider">
                                <Plus size={14} className="mr-2" /> Add Effect
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center" className="w-48 bg-card border-border max-h-[400px] overflow-y-auto">
                            {AVAILABLE_EFFECTS.map((effect) => (
                                <DropdownMenuItem
                                    key={effect.id}
                                    onClick={() => addEffectToLayer(activeLayer.id, effect.id, effect.defaultParams)}
                                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground font-bold text-xs uppercase tracking-wider"
                                >
                                    {effect.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
};
