import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { NumericSliderControl } from '@/components/ui/numeric-slider-control';
import { Checkbox } from '@/components/ui/checkbox';
import { PropertiesPanel } from './PropertiesPanel';
import {
    Settings2,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    GripVertical,
    PanelRightClose,
    PanelRight,
    ChevronDown,
    ChevronRight,
    RotateCcw,
    Copy,
    Search,
    SlidersHorizontal,
    Sparkles,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { Effect, EffectParams } from '@/store/editorStore';
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
import { effectRegistry } from '@/engine/effectRegistry';
import type { EffectControlDef } from '@/engine/types';
import { getLevelsKeysForChannel } from '@/engine/effects/levels';
import { applyAsciiPreset } from '@/engine/effects/ascii';
import { applyBlackWhitePreset } from '@/engine/effects/blackWhite';
import { flattenCurvePoints, parseCurvePoints } from '@/engine/effects/toneUtils';

const BLEND_MODES = [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'soft_light',
    'hard_light',
    'difference',
    'exclusion',
    'color_dodge',
    'color_burn',
] as const;

const EFFECT_CATEGORIES: Record<string, string> = {
    'brightness_contrast': 'Color Adjustments',
    'black_white': 'Color Adjustments',
    'levels': 'Color Adjustments',
    'curves': 'Color Adjustments',
    'selective_color': 'Color Adjustments',

    'ascii': 'Stylization & Generative Art',
    'dithering': 'Stylization & Generative Art',
    'stippling': 'Stylization & Generative Art',
    'cellular_automata': 'Stylization & Generative Art',

    'unsharp_mask': 'Filters & Convolutions',
    'find_edges': 'Filters & Convolutions',
    'minimum': 'Filters & Convolutions',
    'add_noise': 'Filters & Convolutions',
    'ripple': 'Filters & Convolutions',
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));



const CurveEditor = ({
    value,
    onChange,
}: {
    value: number[];
    onChange: (next: number[]) => void;
}) => {
    const size = 180;
    const points = useMemo(() => parseCurvePoints(value), [value]);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const safeSelectedIdx = clamp(selectedIdx, 0, points.length - 1);

    const toSvg = (x: number, y: number) => ({
        x: (x / 255) * size,
        y: size - (y / 255) * size,
    });

    const fromEvent = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };

        const localX = clamp(event.clientX - rect.left, 0, size);
        const localY = clamp(event.clientY - rect.top, 0, size);

        return {
            x: clamp((localX / size) * 255, 0, 255),
            y: clamp(((size - localY) / size) * 255, 0, 255),
        };
    };

    const emit = (nextPoints: Array<{ x: number; y: number }>, nextSelected = safeSelectedIdx) => {
        const sorted = [...nextPoints].sort((a, b) => a.x - b.x);
        const finalPoints = sorted.map((point, index) => {
            if (index === 0) return { x: 0, y: clamp(point.y, 0, 255) };
            if (index === sorted.length - 1) return { x: 255, y: clamp(point.y, 0, 255) };
            return { x: clamp(point.x, 0, 255), y: clamp(point.y, 0, 255) };
        });
        onChange(flattenCurvePoints(finalPoints));
        setSelectedIdx(clamp(nextSelected, 0, finalPoints.length - 1));
    };

    const updatePoint = (index: number, x: number, y: number) => {
        const next = points.map((point) => ({ ...point }));

        const minX = index === 0 ? 0 : next[index - 1].x + 1;
        const maxX = index === next.length - 1 ? 255 : next[index + 1].x - 1;

        next[index].x = index === 0 ? 0 : index === next.length - 1 ? 255 : clamp(x, minX, maxX);
        next[index].y = clamp(y, 0, 255);
        emit(next, index);
    };

    const addPoint = (x: number, y: number) => {
        const next = points.map((point) => ({ ...point }));
        next.push({ x, y });
        next.sort((a, b) => a.x - b.x);
        const idx = next.findIndex((point) => Math.abs(point.x - x) < 0.5 && Math.abs(point.y - y) < 0.5);
        emit(next, idx);
    };

    const removePoint = (index: number) => {
        if (index <= 0 || index >= points.length - 1) return;
        const next = points.filter((_, idx) => idx !== index);
        emit(next, Math.max(0, index - 1));
    };

    const selected = points[safeSelectedIdx] ?? points[0];
    const polyline = points.map((point) => {
        const p = toSvg(point.x, point.y);
        return `${p.x},${p.y}`;
    }).join(' ');

    return (
        <div className="space-y-2 mt-2">
            <svg
                ref={svgRef}
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="w-full max-w-[220px] border border-border rounded bg-secondary/20 cursor-crosshair"
                onMouseMove={(event) => {
                    if (draggingIdx === null) return;
                    const pos = fromEvent(event);
                    updatePoint(draggingIdx, pos.x, pos.y);
                }}
                onMouseUp={() => setDraggingIdx(null)}
                onMouseLeave={() => setDraggingIdx(null)}
                onDoubleClick={(event) => {
                    const pos = fromEvent(event);
                    addPoint(pos.x, pos.y);
                }}
            >
                {[0.25, 0.5, 0.75].map((t) => (
                    <g key={t}>
                        <line x1={t * size} y1={0} x2={t * size} y2={size} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                        <line x1={0} y1={t * size} x2={size} y2={t * size} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    </g>
                ))}
                <line x1={0} y1={size} x2={size} y2={0} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <polyline points={polyline} fill="none" stroke="rgb(96,165,250)" strokeWidth="2" />
                {points.map((point, index) => {
                    const p = toSvg(point.x, point.y);
                    const selectedPoint = index === safeSelectedIdx;
                    return (
                        <circle
                            key={`${point.x}-${point.y}-${index}`}
                            cx={p.x}
                            cy={p.y}
                            r={selectedPoint ? 4 : 3}
                            fill={selectedPoint ? 'rgb(191,219,254)' : 'rgb(147,197,253)'}
                            stroke="rgb(30,64,175)"
                            strokeWidth="1"
                            onMouseDown={(event) => {
                                event.stopPropagation();
                                setSelectedIdx(index);
                                setDraggingIdx(index);
                            }}
                            onDoubleClick={(event) => {
                                event.stopPropagation();
                                removePoint(index);
                            }}
                        />
                    );
                })}
            </svg>

            <div className="grid grid-cols-2 gap-2">
                <NumericSliderControl
                    label="Point Input"
                    value={selected.x}
                    min={0}
                    max={255}
                    step={1}
                    onChange={(next) => updatePoint(safeSelectedIdx, next, selected.y)}
                />
                <NumericSliderControl
                    label="Point Output"
                    value={selected.y}
                    min={0}
                    max={255}
                    step={1}
                    onChange={(next) => updatePoint(safeSelectedIdx, selected.x, next)}
                />
            </div>
            <p className="text-[10px] text-muted-foreground">Double-click graph to add point. Double-click point to remove.</p>
        </div>
    );
};

const LevelsEditor = ({
    params,
    onChange,
}: {
    params: EffectParams;
    onChange: (key: string, value: number) => void;
}) => {
    const channel = String(params.selectedChannel ?? 'RGB');
    const keys = getLevelsKeysForChannel(channel);

    return (
        <div className="space-y-2 mt-2">
            <NumericSliderControl
                label="Input Black"
                value={Number(params[keys.inBlack])}
                min={0}
                max={255}
                step={1}
                onChange={(value) => onChange(keys.inBlack, value)}
            />
            <NumericSliderControl
                label="Input White"
                value={Number(params[keys.inWhite])}
                min={0}
                max={255}
                step={1}
                onChange={(value) => onChange(keys.inWhite, value)}
            />
            <NumericSliderControl
                label="Input Gamma"
                value={Number(params[keys.gamma])}
                min={0.1}
                max={9.99}
                step={0.01}
                onChange={(value) => onChange(keys.gamma, value)}
            />
            <NumericSliderControl
                label="Output Black"
                value={Number(params[keys.outBlack])}
                min={0}
                max={255}
                step={1}
                onChange={(value) => onChange(keys.outBlack, value)}
            />
            <NumericSliderControl
                label="Output White"
                value={Number(params[keys.outWhite])}
                min={0}
                max={255}
                step={1}
                onChange={(value) => onChange(keys.outWhite, value)}
            />
        </div>
    );
};

interface SortableEffectCardProps {
    effect: Effect;
    layerId: string;
}

const SortableEffectCard = ({ effect, layerId }: SortableEffectCardProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: effect.id });
    const toggleEffectVisibility = useEditorStore((s) => s.toggleEffectVisibility);
    const removeEffect = useEditorStore((s) => s.removeEffect);
    const duplicateEffect = useEditorStore((s) => s.duplicateEffect);
    const updateEffectParam = useEditorStore((s) => s.updateEffectParam);
    const setEffectBlendMode = useEditorStore((s) => s.setEffectBlendMode);
    const setEffectOpacity = useEditorStore((s) => s.setEffectOpacity);
    const [isExpanded, setIsExpanded] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const spec = effectRegistry.get(effect.type);
    const params = useMemo(() => spec ? spec.coerceParams(effect.params) : effect.params, [spec, effect.params]);

    if (!spec) return null;

    const applyPatch = (patch: Record<string, string | number | boolean | number[]>) => {
        for (const [key, value] of Object.entries(patch)) {
            updateEffectParam(layerId, effect.id, key, value);
        }
    };

    const setParam = (key: string, value: string | number | boolean | number[]) => {
        if (effect.type === 'black_white' && key === 'preset' && typeof value === 'string') {
            applyPatch(applyBlackWhitePreset(value, { ...params, preset: value }));
            return;
        }
        if (effect.type === 'ascii' && key === 'preset' && typeof value === 'string') {
            applyPatch(applyAsciiPreset(value, { ...params, preset: value }));
            return;
        }
        updateEffectParam(layerId, effect.id, key, value);
    };

    const renderControl = (control: EffectControlDef) => {
        if (control.showWhen && !control.showWhen(params)) return null;

        const value = params[control.key] as string | number | boolean | number[] | undefined;

        if (control.type === 'slider') {
            if (typeof value !== 'number') return null;
            return (
                <NumericSliderControl
                    key={control.key}
                    label={control.label}
                    value={value}
                    min={control.min ?? 0}
                    max={control.max ?? 1}
                    step={control.step ?? 0.01}
                    unit={control.unit}
                    onChange={(next) => setParam(control.key, next)}
                />
            );
        }

        if (control.type === 'checkbox') {
            return (
                <div key={control.key} className="mt-2">
                    <Checkbox
                        checked={Boolean(value)}
                        onChange={(checked) => setParam(control.key, checked)}
                        label={control.label}
                    />
                </div>
            );
        }

        if (control.type === 'text') {
            return (
                <div key={control.key} className="space-y-1 mt-2">
                    <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground font-mono uppercase truncate mr-2">{control.label}</span>
                    </div>
                    <input
                        type="text"
                        value={String(value ?? '')}
                        onChange={(event) => setParam(control.key, event.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded px-2 py-1 font-mono text-primary text-[10px] focus:outline-none focus:ring-1 focus:ring-primary focus:bg-secondary transition-colors"
                    />
                </div>
            );
        }

        if (control.type === 'color') {
            return (
                <div key={control.key} className="flex justify-between items-center text-[10px] mt-2">
                    <span className="text-muted-foreground font-mono uppercase truncate mr-2">{control.label}</span>
                    <input
                        type="color"
                        value={typeof value === 'string' ? value : '#000000'}
                        onChange={(event) => setParam(control.key, event.target.value)}
                        className="h-5 w-8 p-0 border-0 rounded cursor-pointer bg-transparent"
                    />
                </div>
            );
        }

        if (control.type === 'select') {
            return (
                <div key={control.key} className="flex justify-between items-center text-[10px] mt-2">
                    <span className="text-muted-foreground font-mono uppercase truncate mr-2">{control.label}</span>
                    <select
                        value={String(value ?? '')}
                        onChange={(event) => setParam(control.key, event.target.value)}
                        className="bg-secondary/50 border border-border rounded px-2 py-1 text-right font-mono text-primary focus:outline-none focus:ring-1 focus:ring-primary h-6 max-w-[140px]"
                    >
                        {(control.options ?? []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
            );
        }

        if (control.type === 'segmented') {
            return (
                <div key={control.key} className="space-y-1 mt-2">
                    <span className="text-muted-foreground font-mono uppercase text-[10px]">{control.label}</span>
                    <SegmentedControl
                        value={String(value ?? '')}
                        options={control.options ?? []}
                        onChange={(next) => setParam(control.key, next)}
                    />
                </div>
            );
        }

        if (control.type === 'levels_editor') {
            return (
                <div key={control.key}>
                    <LevelsEditor
                        params={params}
                        onChange={(key, nextValue) => setParam(key, nextValue)}
                    />
                </div>
            );
        }

        if (control.type === 'curves_editor') {
            const channel = String(params.selectedChannel ?? 'RGB');
            const key = channel === 'R' ? 'pointsR' : channel === 'G' ? 'pointsG' : channel === 'B' ? 'pointsB' : 'pointsRGB';
            const curveValues = Array.isArray(params[key]) ? (params[key] as number[]) : [0, 0, 255, 255];
            return (
                <div key={control.key}>
                    <CurveEditor value={curveValues} onChange={(next) => setParam(key, next)} />
                </div>
            );
        }

        return null;
    };

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
            <div
                className="flex items-center gap-2 py-3 pr-2 pl-3 cursor-pointer hover:bg-secondary/30 border-l-2 border-l-transparent"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <button
                    className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Drag to reorder"
                >
                    <GripVertical size={14} />
                </button>

                <button
                    className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-1"
                    onClick={(event) => { event.stopPropagation(); setIsExpanded(!isExpanded); }}
                    aria-label={isExpanded ? 'Collapse effect' : 'Expand effect'}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                <Settings2 size={14} className="text-muted-foreground shrink-0" />

                <div className="flex-1 min-w-0">
                    <span className="block truncate font-bold text-xs pointer-events-none">{spec.name}</span>
                </div>

                <button
                    className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-1"
                    onClick={(event) => { event.stopPropagation(); toggleEffectVisibility(layerId, effect.id); }}
                    aria-label={effect.visible ? 'Hide effect' : 'Show effect'}
                >
                    {effect.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                <button
                    className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 z-10 relative p-1"
                    onClick={(event) => { event.stopPropagation(); duplicateEffect(layerId, effect.id); }}
                    title="Duplicate effect"
                    aria-label="Duplicate effect"
                >
                    <Copy size={14} />
                </button>

                <button
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 z-10 relative p-1"
                    onClick={(event) => { event.stopPropagation(); removeEffect(layerId, effect.id); }}
                    aria-label="Remove effect"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {effect.visible && isExpanded && (
                <div className="space-y-4 px-4 pb-4 pt-4 bg-secondary/10 border-t border-border/10">
                    <div className="flex justify-between items-center pb-2 border-b border-border/10 gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 font-mono uppercase tracking-wider">
                                    Blend: {effect.blendMode}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="text-xs font-mono uppercase tracking-widest min-w-[120px]">
                                {BLEND_MODES.map((mode) => (
                                    <DropdownMenuItem
                                        key={mode}
                                        onClick={() => setEffectBlendMode(layerId, effect.id, mode)}
                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-[10px]"
                                    >
                                        {mode}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <button
                            className="flex items-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(event) => {
                                event.stopPropagation();
                                applyPatch(spec.defaultParams);
                            }}
                        >
                            <RotateCcw size={12} className="mr-1.5" /> Reset
                        </button>
                    </div>

                    {spec.helpText && <p className="text-[10px] text-muted-foreground">{spec.helpText}</p>}

                    <NumericSliderControl
                        label="Opacity"
                        value={Number((effect.opacity ?? 1).toFixed(3))}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) => setEffectOpacity(layerId, effect.id, value)}
                    />

                    {spec.controls.map((control) => renderControl(control))}
                </div>
            )}
        </div>
    );
};

export const EffectsPanel = () => {
    const layers = useEditorStore((s) => s.layers);
    const activeLayerId = useEditorStore((s) => s.activeLayerId);
    const addEffectToLayer = useEditorStore((s) => s.addEffectToLayer);
    const reorderEffects = useEditorStore((s) => s.reorderEffects);

    const activeLayer = activeLayerId ? layers[activeLayerId] : null;

    const [width, setWidth] = useState(288);
    const [isMinimized, setIsMinimized] = useState(false);
    const [propertiesOpen, setPropertiesOpen] = useState(true);
    const [effectsOpen, setEffectsOpen] = useState(true);
    const [effectSearch, setEffectSearch] = useState('');
    const [effectMenuOpen, setEffectMenuOpen] = useState(false);
    const isResizing = useRef(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const startResizing = useCallback(() => {
        isResizing.current = true;
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
    }, []);

    const resize = useCallback((event: MouseEvent) => {
        if (!isResizing.current) return;
        const newWidth = window.innerWidth - event.clientX;
        setWidth(Math.max(250, Math.min(newWidth, 520)));
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    useEffect(() => {
        if (effectMenuOpen && searchInputRef.current) {
            requestAnimationFrame(() => searchInputRef.current?.focus());
        }
    }, [effectMenuOpen]);

    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: { distance: 4 },
    }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!activeLayer || !over || active.id === over.id) return;

        const fromIndex = activeLayer.effects.findIndex((item) => item.id === active.id);
        const toIndex = activeLayer.effects.findIndex((item) => item.id === over.id);
        if (fromIndex !== -1 && toIndex !== -1) {
            reorderEffects(activeLayer.id, fromIndex, toIndex);
        }
    };

    const filtered = useMemo(
        () => effectRegistry.getAll().filter((effect) => effect.name.toLowerCase().includes(effectSearch.toLowerCase())),
        [effectSearch],
    );

    const groupedEffects = useMemo(() => {
        const groups: Record<string, typeof filtered> = {
            'Color Adjustments': [],
            'Stylization & Generative Art': [],
            'Filters & Convolutions': [],
            'Other': []
        };

        filtered.forEach(effect => {
            const cat = EFFECT_CATEGORIES[effect.id] || 'Other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(effect);
        });

        return groups;
    }, [filtered]);

    return (
        <div
            className={`h-full bg-card border-l border-border flex flex-col text-xs relative shrink-0 whitespace-nowrap overflow-hidden ${isResizing.current ? '' : 'transition-[width] duration-300 ease-in-out'
                }`}
            style={{ width: isMinimized ? 48 : `${width}px` }}
        >
            {!isMinimized && (
                <div
                    className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-10"
                    onMouseDown={startResizing}
                />
            )}

            <div className="flex flex-col border-b border-border bg-secondary/50 w-full">
                <div className={`p-4 flex ${isMinimized ? 'justify-center' : 'justify-between'} items-center uppercase tracking-wider`}>
                    {!isMinimized && (
                        <h2 className="font-bold text-xs flex items-center gap-1.5 truncate">
                            <Settings2 size={14} className="text-primary shrink-0" />
                            Settings
                        </h2>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => setIsMinimized((prev) => !prev)}
                        >
                            {isMinimized ? <PanelRight size={16} /> : <PanelRightClose size={16} />}
                        </Button>
                    </div>
                </div>
            </div>

            {!isMinimized ? (
                <div className="flex-1 overflow-y-auto w-full relative">
                    {/* ── Properties Accordion ── */}
                    <button
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-secondary/30 border-b border-border hover:bg-secondary/40 transition-colors cursor-pointer"
                        onClick={() => setPropertiesOpen(!propertiesOpen)}
                    >
                        <ChevronDown
                            size={12}
                            className={`text-muted-foreground transition-transform duration-200 ${!propertiesOpen ? '-rotate-90' : ''}`}
                        />
                        <SlidersHorizontal size={12} className="text-primary/70" />
                        <span className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
                            Properties
                        </span>
                    </button>
                    {propertiesOpen && <PropertiesPanel />}

                    {/* ── Effects Accordion ── */}
                    <button
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-secondary/30 border-b border-border hover:bg-secondary/40 transition-colors cursor-pointer"
                        onClick={() => setEffectsOpen(!effectsOpen)}
                    >
                        <ChevronDown
                            size={12}
                            className={`text-muted-foreground transition-transform duration-200 ${!effectsOpen ? '-rotate-90' : ''}`}
                        />
                        <Sparkles size={12} className="text-primary/70" />
                        <span className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
                            Effects
                        </span>
                        {activeLayer && activeLayer.effects.length > 0 && (
                            <span className="ml-auto text-[9px] font-mono text-muted-foreground/60 tabular-nums">
                                {activeLayer.effects.length}
                            </span>
                        )}
                    </button>

                    {effectsOpen && (
                        <>
                            {!activeLayer ? (
                                <div className="text-muted-foreground text-center py-8 font-mono uppercase tracking-wider border border-dashed border-border m-3 text-[10px]">
                                    <Settings2 size={16} className="mx-auto mb-2 text-muted-foreground/50" />
                                    Select a layer to edit effects.
                                </div>
                            ) : activeLayer.effects.length === 0 ? (
                                <div className="text-muted-foreground text-center py-8 font-mono uppercase tracking-wider border border-dashed border-border m-3 text-[10px]">
                                    <Settings2 size={16} className="mx-auto mb-2 text-muted-foreground/50" />
                                    No effects on<br />
                                    <span className="text-foreground">{activeLayer.name}</span>
                                </div>
                            ) : (
                                <div className="pb-16 flex flex-col">
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                        <SortableContext
                                            items={activeLayer.effects.map((effect) => effect.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {activeLayer.effects.map((effect) => (
                                                <SortableEffectCard key={effect.id} effect={effect} layerId={activeLayer.id} />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto flex flex-col items-center py-4 gap-4 w-full">
                    <Settings2 size={16} className="text-muted-foreground opacity-30" />
                </div>
            )}

            {!isMinimized && activeLayer && (
                <div className="p-3 border-t border-border bg-secondary/30 flex justify-center w-full relative z-20 shrink-0">
                    <DropdownMenu
                        open={effectMenuOpen}
                        onOpenChange={(open) => {
                            setEffectMenuOpen(open);
                            if (!open) setEffectSearch('');
                        }}
                    >
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full text-xs font-bold uppercase tracking-wider">
                                <Plus size={14} className="mr-2" /> Add Effect
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center" className="w-64 bg-card border-border max-h-[600px] overflow-y-auto">
                            <div className="px-2 py-2 border-b border-border/60 sticky top-0 bg-card z-20">
                                <div className="relative">
                                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        ref={searchInputRef}
                                        className="w-full h-7 pl-7 pr-2 rounded border border-border bg-secondary/30 text-[11px]"
                                        placeholder="Search effects..."
                                        value={effectSearch}
                                        onChange={(event) => setEffectSearch(event.target.value)}
                                        onKeyDown={(event) => event.stopPropagation()}
                                    />
                                </div>
                            </div>

                            {Object.entries(groupedEffects).map(([category, effects]) => {
                                if (effects.length === 0) return null;
                                return (
                                    <div key={category} className="mb-2 last:mb-0">
                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/40 sticky top-[45px] z-10 backdrop-blur-md border-b border-border/40">
                                            {category}
                                        </div>
                                        {effects.map((effect) => (
                                            <DropdownMenuItem
                                                key={effect.id}
                                                onClick={() => addEffectToLayer(activeLayer.id, effect.id, effect.defaultParams)}
                                                className="cursor-pointer text-[11px] flex justify-between rounded-none px-3"
                                            >
                                                <span>{effect.name}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                );
                            })}

                            {filtered.length === 0 && (
                                <div className="px-3 py-2 text-[10px] text-muted-foreground">No effects found</div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
};
