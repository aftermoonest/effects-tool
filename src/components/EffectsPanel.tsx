import { useState, useRef, useEffect, useCallback } from 'react';
import { PropertiesPanel } from './PropertiesPanel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Settings2, Plus, Trash2, Eye, EyeOff, GripVertical, PanelRightClose, PanelRight, ChevronDown, ChevronRight, RotateCcw, Copy, Search } from 'lucide-react';
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
    defaultParams: Record<string, number | string | boolean>;
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
    { id: 'ascii', label: 'ASCII Art', defaultParams: { preset: 'Classic', characters: ' .:-=+*#%@', scale: 50, asciiGamma: 40, asciiPhase: 0, colorMode: 'Texture', background: false, bgColor: '#000000', textColor: '#ffffff', invertOrder: false } },
    {
        id: 'dithering', label: 'Dithering', defaultParams: {
            pattern: 'F-S', colorMode: 'tritone', shadows: '#000000', midtones: '#ff4500', highlights: '#ffffff',
            imagePreprocessing: false, preBlur: 0.5, preGrain: 0.1, preGamma: 1.0, preBlackPoint: 0, preWhitePoint: 255,
            showEffect: true, pixelSize: 2, useColorMode: false, threshold: 128, transparentBg: false
        }
    },
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
    scale: [0, 100, 1],
    asciiGamma: [0, 100, 1],
    asciiPhase: [0, 100, 1],
    preBlur: [0, 5, 0.1],
    preGrain: [0, 1, 0.01],
    preGamma: [0.1, 4, 0.01],
    preBlackPoint: [0, 255, 1],
    preWhitePoint: [0, 255, 1],
    pixelSize: [1, 20, 1],
    threshold: [0, 255, 1],
};

const ASCII_PRESETS: Record<string, string> = {
    'Classic': ' .:-=+*#%@', 'Minimal': ' .+', 'Binary': ' 01', 'Matrix': ' 01',
    'Hex': ' 0123456789ABCDEF', 'Grades': ' FDCBA', 'Math': ' +-*/=', 'Punctuation': ' .,:;!?',
    'Brackets': ' ()[]{}', 'Angles': ' <>^v', 'Slashes': ' /\\|', 'Quotes': ' `\'"',
    'Alpha': ' ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Lower': ' abcdefghijklmnopqrstuvwxyz',
    'Numeric': ' 0123456789', 'Vowels': ' aeiou', 'Consonants': ' bcdfghjklmnpqrstvwxyz',
    'Lines': ' -_~', 'Dense': ' WMB80@#%', 'Sparse': ' .:,', 'Stars': ' +*#', 'Mixed': ' .o0O'
};

const SliderParam = ({ label, paramKey, effect, layerId, val }: any) => {
    const updateEffectParam = useEditorStore(s => s.updateEffectParam);
    const [min, max, step] = PARAM_RANGES[paramKey] ?? [-1, 1, 0.01];
    return (
        <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-mono uppercase truncate mr-2">{label}</span>
                <input
                    type="number"
                    value={Number(val?.toFixed(3) ?? 0)}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => {
                        const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        updateEffectParam(layerId, effect.id, paramKey, v);
                    }}
                    className="w-14 bg-secondary/50 border border-border rounded px-1.5 py-0.5 text-right font-mono text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-primary focus:bg-secondary transition-colors"
                />
            </div>
            <Slider
                value={[val ?? 0]}
                min={min}
                max={max}
                step={step}
                onValueChange={(v) => updateEffectParam(layerId, effect.id, paramKey, v[0])}
            />
        </div>
    );
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
    const duplicateEffect = useEditorStore(s => s.duplicateEffect);
    const updateEffectParam = useEditorStore(s => s.updateEffectParam);
    const setEffectBlendMode = useEditorStore(s => s.setEffectBlendMode);
    const setEffectOpacity = useEditorStore(s => s.setEffectOpacity);
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

                {/* Duplicate */}
                <button
                    className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 z-10 relative p-0.5"
                    onClick={(e) => { e.stopPropagation(); duplicateEffect(layerId, effect.id); }}
                    title="Duplicate effect"
                >
                    <Copy size={14} />
                </button>

                {/* Delete */}
                <button
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 z-10 relative p-0.5"
                    onClick={(e) => { e.stopPropagation(); removeEffect(layerId, effect.id); }}
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Parameter sliders and controls */}
            {effect.visible && isExpanded && (
                <div className="space-y-4 px-4 pb-4 pt-4 bg-secondary/10 border-t border-border/10">
                    {/* Controls Row */}
                    <div className="flex justify-between items-center pb-2 border-b border-border/10">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 font-mono uppercase tracking-wider">
                                    Blend: {effect.blendMode}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="text-xs font-mono uppercase tracking-widest min-w-[120px]">
                                {['normal', 'multiply', 'screen', 'overlay', 'soft_light', 'hard_light', 'difference', 'exclusion', 'color_dodge', 'color_burn'].map(mode => (
                                    <DropdownMenuItem
                                        key={mode}
                                        onClick={() => setEffectBlendMode(layerId, effect.id, mode as any)}
                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-[10px]"
                                    >
                                        {mode}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <button
                            className="flex items-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                const defs = AVAILABLE_EFFECTS.find(e => e.id === effect.type)?.defaultParams;
                                if (defs) {
                                    Object.entries(defs).forEach(([k, v]) => {
                                        updateEffectParam(layerId, effect.id, k, v);
                                    });
                                }
                            }}
                        >
                            <RotateCcw size={12} className="mr-1.5" /> Reset
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-muted-foreground font-mono uppercase truncate mr-2">opacity</span>
                            <input
                                type="number"
                                value={Number((effect.opacity ?? 1).toFixed(3))}
                                min={0}
                                max={1}
                                step={0.01}
                                onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    setEffectOpacity(layerId, effect.id, val);
                                }}
                                className="w-14 bg-secondary/50 border border-border rounded px-1.5 py-0.5 text-right font-mono text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-primary focus:bg-secondary transition-colors"
                            />
                        </div>
                        <Slider
                            value={[effect.opacity ?? 1]}
                            min={0}
                            max={1}
                            step={0.01}
                            onValueChange={(val) => setEffectOpacity(layerId, effect.id, val[0])}
                        />
                    </div>

                    {/* Generic param rendering */}
                    {effect.type !== 'dithering' && Object.entries(effect.params).map(([key, value]) => {
                        // Custom Controls for Dithering/ASCII (strings/booleans)
                        if (typeof value === 'boolean') {
                            return (
                                <div key={key} className="flex justify-between items-center text-[10px] mt-2">
                                    <span className="text-muted-foreground font-mono uppercase truncate mr-2">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <input
                                        type="checkbox"
                                        checked={value}
                                        onChange={(e) => updateEffectParam(layerId, effect.id, key, e.target.checked)}
                                        className="h-3 w-3 rounded border-border bg-secondary text-primary accent-primary"
                                    />
                                </div>
                            );
                        }

                        if (typeof value === 'string') {
                            if (key === 'characters') {
                                return (
                                    <div key={key} className="space-y-1 mt-2">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-muted-foreground font-mono uppercase truncate mr-2">{key}</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={value}
                                            onChange={(e) => updateEffectParam(layerId, effect.id, key, e.target.value)}
                                            className="w-full bg-secondary/50 border border-border rounded px-2 py-1 font-mono text-primary text-[10px] focus:outline-none focus:ring-1 focus:ring-primary focus:bg-secondary transition-colors"
                                        />
                                    </div>
                                );
                            }

                            if (key === 'preset' || key === 'colorMode' || key === 'algorithm') {
                                let options: string[] = [];
                                if (key === 'preset') options = Object.keys(ASCII_PRESETS);
                                if (key === 'colorMode' && effect.type === 'ascii') options = ['Texture', 'Grayscale', 'Monochrome'];
                                if (key === 'colorMode' && effect.type === 'dithering') options = ['monochrome', 'duotone', 'tritone'];
                                if (key === 'algorithm') options = ['atkinson', 'bayer', 'floyd_steinberg'];

                                return (
                                    <div key={key} className="flex justify-between items-center text-[10px] mt-2">
                                        <span className="text-muted-foreground font-mono uppercase truncate mr-2">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <select
                                            value={value}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                updateEffectParam(layerId, effect.id, key, val);
                                                if (key === 'preset' && ASCII_PRESETS[val]) {
                                                    updateEffectParam(layerId, effect.id, 'characters', ASCII_PRESETS[val]);
                                                }
                                            }}
                                            className="bg-secondary/50 border border-border rounded px-1.5 py-0.5 text-right font-mono text-primary focus:outline-none focus:ring-1 focus:ring-primary h-6 max-w-[120px]"
                                        >
                                            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                );
                            }

                            if (key === 'shadows' || key === 'midtones' || key === 'highlights' || key === 'bgColor' || key === 'textColor') {
                                if (effect.params.colorMode === 'monochrome' && (key === 'midtones' || key === 'highlights')) return null;
                                if (effect.params.colorMode === 'duotone' && key === 'midtones') return null;
                                if (effect.type === 'ascii' && key === 'bgColor' && !effect.params.background) return null;
                                if (effect.type === 'ascii' && key === 'textColor' && effect.params.colorMode !== 'Monochrome') return null;

                                return (
                                    <div key={key} className="flex justify-between items-center text-[10px] mt-2">
                                        <span className="text-muted-foreground font-mono uppercase truncate mr-2">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <input
                                            type="color"
                                            value={value}
                                            onChange={(e) => updateEffectParam(layerId, effect.id, key, e.target.value)}
                                            className="h-5 w-8 p-0 border-0 rounded cursor-pointer bg-transparent"
                                        />
                                    </div>
                                );
                            }
                            return null;
                        }

                        if (typeof value !== 'number') return null;
                        const [min, max, step] = PARAM_RANGES[key] ?? [-1, 1, 0.01];
                        return (
                            <div key={key} className="space-y-2 mt-2">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-muted-foreground font-mono uppercase truncate mr-2">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
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

                    {/* Custom Dithering UI */}
                    {effect.type === 'dithering' && (
                        <div className="space-y-4 mt-4">
                            {/* Bypass Toggle */}
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-muted-foreground font-mono uppercase truncate mr-2">Enable Effect</span>
                                <input
                                    type="checkbox"
                                    checked={effect.params.showEffect as boolean}
                                    onChange={(e) => updateEffectParam(layerId, effect.id, 'showEffect', e.target.checked)}
                                    className="h-3 w-3 rounded border-border bg-secondary text-primary accent-primary"
                                />
                            </div>

                            {/* Main algorithm/pattern selector */}
                            <div className="space-y-1">
                                <span className="text-muted-foreground font-mono uppercase text-[10px]">Pattern</span>
                                <div className="flex bg-secondary/50 p-0.5 rounded border border-border">
                                    {['F-S', 'Bayer', 'Random'].map(pat => (
                                        <button
                                            key={pat}
                                            onClick={() => updateEffectParam(layerId, effect.id, 'pattern', pat)}
                                            className={`flex-1 text-[10px] font-mono py-1 rounded transition-colors ${effect.params.pattern === pat ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-secondary text-muted-foreground'}`}
                                        >
                                            {pat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <SliderParam label="Threshold" paramKey="threshold" effect={effect} layerId={layerId} val={effect.params.threshold as number} />
                            <SliderParam label="Pixel Size" paramKey="pixelSize" effect={effect} layerId={layerId} val={effect.params.pixelSize as number} />

                            {/* Color Mode Section */}
                            <div className="pt-3 border-t border-border/10 space-y-2">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-muted-foreground font-mono uppercase truncate mr-2">Use Original Colors</span>
                                    <input
                                        type="checkbox"
                                        checked={effect.params.useColorMode as boolean}
                                        onChange={(e) => updateEffectParam(layerId, effect.id, 'useColorMode', e.target.checked)}
                                        className="h-3 w-3 rounded border-border bg-secondary text-primary accent-primary"
                                    />
                                </div>
                                {!effect.params.useColorMode && (
                                    <div className="space-y-2 mt-2">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-muted-foreground font-mono uppercase truncate mr-2">Palette Mode</span>
                                            <select
                                                value={effect.params.colorMode as string}
                                                onChange={(e) => updateEffectParam(layerId, effect.id, 'colorMode', e.target.value)}
                                                className="bg-secondary/50 border border-border rounded px-1.5 py-0.5 text-right font-mono text-primary focus:outline-none focus:ring-1 focus:ring-primary h-6 max-w-[120px]"
                                            >
                                                {['monochrome', 'duotone', 'tritone'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        {effect.params.colorMode === 'monochrome' && (
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-muted-foreground font-mono uppercase truncate mr-2">Transparent Background</span>
                                                <input
                                                    type="checkbox"
                                                    checked={effect.params.transparentBg as boolean}
                                                    onChange={(e) => updateEffectParam(layerId, effect.id, 'transparentBg', e.target.checked)}
                                                    className="h-3 w-3 rounded border-border bg-secondary text-primary accent-primary"
                                                />
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-muted-foreground font-mono uppercase truncate mr-2">{effect.params.transparentBg ? 'Color' : 'Shadows'}</span>
                                            <input type="color" value={effect.params.shadows as string} onChange={(e) => updateEffectParam(layerId, effect.id, 'shadows', e.target.value)} className="h-5 w-8 p-0 border-0 rounded cursor-pointer bg-transparent" disabled={effect.params.colorMode === 'monochrome' && effect.params.transparentBg as boolean} style={{ opacity: effect.params.colorMode === 'monochrome' && effect.params.transparentBg ? 0.2 : 1 }} />
                                        </div>
                                        {effect.params.colorMode !== 'monochrome' && effect.params.colorMode !== 'duotone' && (
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-muted-foreground font-mono uppercase truncate mr-2">Midtones</span>
                                                <input type="color" value={effect.params.midtones as string} onChange={(e) => updateEffectParam(layerId, effect.id, 'midtones', e.target.value)} className="h-5 w-8 p-0 border-0 rounded cursor-pointer bg-transparent" />
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-muted-foreground font-mono uppercase truncate mr-2">{effect.params.transparentBg && effect.params.colorMode === 'monochrome' ? 'Color' : 'Highlights'}</span>
                                            <input type="color" value={effect.params.highlights as string} onChange={(e) => updateEffectParam(layerId, effect.id, 'highlights', e.target.value)} className="h-5 w-8 p-0 border-0 rounded cursor-pointer bg-transparent" />
                                        </div>
                                        {/* Presets Grid */}
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] uppercase tracking-wider font-bold">
                                            <button className="bg-secondary hover:bg-primary transition-colors hover:text-primary-foreground py-1 rounded"
                                                onClick={() => { updateEffectParam(layerId, effect.id, 'shadows', '#000000'); updateEffectParam(layerId, effect.id, 'midtones', '#808080'); updateEffectParam(layerId, effect.id, 'highlights', '#ffffff'); }}>Minimal</button>
                                            <button className="bg-secondary hover:bg-primary transition-colors hover:text-primary-foreground py-1 rounded"
                                                onClick={() => { updateEffectParam(layerId, effect.id, 'shadows', '#43523d'); updateEffectParam(layerId, effect.id, 'midtones', '#8cb484'); updateEffectParam(layerId, effect.id, 'highlights', '#c7f0d8'); }}>Nokia</button>
                                            <button className="bg-secondary hover:bg-primary transition-colors hover:text-primary-foreground py-1 rounded"
                                                onClick={() => { updateEffectParam(layerId, effect.id, 'shadows', '#1b2f15'); updateEffectParam(layerId, effect.id, 'midtones', '#4c8742'); updateEffectParam(layerId, effect.id, 'highlights', '#b3e8a6'); }}>Garden</button>
                                            <button className="bg-secondary hover:bg-primary transition-colors hover:text-primary-foreground py-1 rounded"
                                                onClick={() => { updateEffectParam(layerId, effect.id, 'shadows', '#0a0a1a'); updateEffectParam(layerId, effect.id, 'midtones', '#4a4a8a'); updateEffectParam(layerId, effect.id, 'highlights', '#e0e0ff'); }}>Star</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preprocessing Group */}
                            <div className="pt-3 border-t border-border/10 space-y-2">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-muted-foreground font-mono uppercase truncate mr-2">Image Preprocessing</span>
                                    <input
                                        type="checkbox"
                                        checked={effect.params.imagePreprocessing as boolean}
                                        onChange={(e) => updateEffectParam(layerId, effect.id, 'imagePreprocessing', e.target.checked)}
                                        className="h-3 w-3 rounded border-border bg-secondary text-primary accent-primary"
                                    />
                                </div>

                                {effect.params.imagePreprocessing && (
                                    <div className="space-y-4 mt-3 pl-3 border-l-2 border-border/20">
                                        <SliderParam label="Pre-Blur" paramKey="preBlur" effect={effect} layerId={layerId} val={effect.params.preBlur as number} />
                                        <SliderParam label="Pre-Grain" paramKey="preGrain" effect={effect} layerId={layerId} val={effect.params.preGrain as number} />
                                        <SliderParam label="Gamma Factor" paramKey="preGamma" effect={effect} layerId={layerId} val={effect.params.preGamma as number} />
                                        <SliderParam label="Black Point" paramKey="preBlackPoint" effect={effect} layerId={layerId} val={effect.params.preBlackPoint as number} />
                                        <SliderParam label="White Point" paramKey="preWhitePoint" effect={effect} layerId={layerId} val={effect.params.preWhitePoint as number} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )
            }
        </div >
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

                {/* Removed tabs */}
            </div>

            {/* Content */}
            {!isMinimized ? (
                <div className="flex-1 overflow-y-auto w-full relative">
                    <PropertiesPanel />
                    {activeLayer && (
                        <>
                            <div className="bg-secondary/30 px-4 py-2 border-y border-border flex items-center gap-2">
                                <h3 className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Effects</h3>
                            </div>
                            {activeLayer.effects.length === 0 ? (
                                <div className="text-muted-foreground text-center py-8 font-mono uppercase tracking-wider border border-dashed border-border m-3 text-[10px]">
                                    <Settings2 size={16} className="mx-auto mb-2 text-muted-foreground/50" />
                                    No effects on<br />
                                    <span className="text-foreground">{activeLayer.name}</span>
                                </div>
                            ) : (
                                <div className="pb-16 flex flex-col">
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

            {/* Footer Action */}
            {!isMinimized && activeLayer && (
                <div className="p-3 border-t border-border bg-secondary/30 flex justify-center w-full relative z-20 shrink-0">
                    <DropdownMenu open={effectMenuOpen} onOpenChange={(open) => {
                        setEffectMenuOpen(open);
                        if (open) {
                            setEffectSearch('');
                            setTimeout(() => searchInputRef.current?.focus(), 0);
                        }
                    }}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider">
                                <Plus size={14} className="mr-2" /> Add Effect
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center" className="w-56 bg-card border-border max-h-[400px] overflow-y-auto">
                            <div className="p-1.5 sticky top-0 bg-card z-10 border-b border-border/50">
                                <div className="relative">
                                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search effects…"
                                        value={effectSearch}
                                        onChange={(e) => setEffectSearch(e.target.value)}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="w-full bg-secondary/50 border border-border rounded pl-7 pr-2 py-1.5 text-xs font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-secondary transition-colors"
                                    />
                                </div>
                            </div>
                            {AVAILABLE_EFFECTS
                                .filter(e => e.label.toLowerCase().includes(effectSearch.toLowerCase()))
                                .map((effect) => (
                                    <DropdownMenuItem
                                        key={effect.id}
                                        onClick={() => addEffectToLayer(activeLayer.id, effect.id, effect.defaultParams)}
                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground font-bold text-xs uppercase tracking-wider"
                                    >
                                        {effect.label}
                                    </DropdownMenuItem>
                                ))}
                            {AVAILABLE_EFFECTS.filter(e => e.label.toLowerCase().includes(effectSearch.toLowerCase())).length === 0 && (
                                <div className="text-center text-muted-foreground text-[10px] py-4 font-mono uppercase tracking-wider">
                                    No effects found
                                </div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
};
