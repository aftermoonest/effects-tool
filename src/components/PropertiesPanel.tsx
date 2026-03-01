import { useEditorStore } from '@/store/editorStore';
import type { BlendMode } from '@/store/editorStore';
import { AlignLeft, AlignCenter, AlignRight, Maximize, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BLEND_MODE_OPTIONS: { value: BlendMode; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'soft_light', label: 'Soft Light' },
    { value: 'hard_light', label: 'Hard Light' },
    { value: 'difference', label: 'Difference' },
    { value: 'exclusion', label: 'Exclusion' },
    { value: 'color_dodge', label: 'Color Dodge' },
    { value: 'color_burn', label: 'Color Burn' },
];

export const PropertiesPanel = () => {
    const layers = useEditorStore(s => s.layers);
    const activeLayerId = useEditorStore(s => s.activeLayerId);
    const setLayerTransform = useEditorStore(s => s.setLayerTransform);
    const setLayerOpacity = useEditorStore(s => s.setLayerOpacity);
    const setLayerBlendMode = useEditorStore(s => s.setLayerBlendMode);
    const toggleLayerMask = useEditorStore(s => s.toggleLayerMask);
    const toggleLayerInvertMask = useEditorStore(s => s.toggleLayerInvertMask);
    const canvasWidth = useEditorStore(s => s.canvasWidth);
    const canvasHeight = useEditorStore(s => s.canvasHeight);

    const activeLayer = activeLayerId ? layers[activeLayerId] : null;

    if (!activeLayer) {
        return (
            <div className="text-muted-foreground text-center py-8 font-mono uppercase tracking-wider border border-dashed border-border m-3 text-[10px]">
                <Settings2 size={16} className="mx-auto mb-2 text-muted-foreground/50" />
                No layer selected
            </div>
        );
    }

    const isImage = activeLayer.kind === 'image';
    const { x, y, width, height } = activeLayer;

    const handleAlign = (type: string) => {
        let nx = x;
        let ny = y;

        if (type === 'left') nx = 0;
        if (type === 'centerH') nx = (canvasWidth - width) / 2;
        if (type === 'right') nx = canvasWidth - width;

        if (type === 'top') ny = 0;
        if (type === 'centerV') ny = (canvasHeight - height) / 2;
        if (type === 'bottom') ny = canvasHeight - height;

        setLayerTransform(activeLayer.id, { x: nx, y: ny, width, height });
    };

    const handleFitCanvas = () => {
        if (!activeLayer.imageWidth || !activeLayer.imageHeight) return;
        const scaleX = canvasWidth / activeLayer.imageWidth;
        const scaleY = canvasHeight / activeLayer.imageHeight;
        const scale = Math.min(scaleX, scaleY);

        const nw = activeLayer.imageWidth * scale;
        const nh = activeLayer.imageHeight * scale;
        const nx = (canvasWidth - nw) / 2;
        const ny = (canvasHeight - nh) / 2;

        setLayerTransform(activeLayer.id, { x: nx, y: ny, width: nw, height: nh });
    };

    const handleFillCanvas = () => {
        if (!activeLayer.imageWidth || !activeLayer.imageHeight) return;
        const scaleX = canvasWidth / activeLayer.imageWidth;
        const scaleY = canvasHeight / activeLayer.imageHeight;
        const scale = Math.max(scaleX, scaleY);

        const nw = activeLayer.imageWidth * scale;
        const nh = activeLayer.imageHeight * scale;
        const nx = (canvasWidth - nw) / 2;
        const ny = (canvasHeight - nh) / 2;

        setLayerTransform(activeLayer.id, { x: nx, y: ny, width: nw, height: nh });
    };

    return (
        <div className="p-4 space-y-5">
            {/* ── Opacity & Blend Mode (all layer types) ── */}
            <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Appearance</h3>

                {/* Opacity */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold">Opacity</label>
                        <span className="text-[10px] tabular-nums text-foreground font-mono">{Math.round(activeLayer.opacity * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(activeLayer.opacity * 100)}
                        onChange={(e) => setLayerOpacity(activeLayer.id, parseInt(e.target.value) / 100)}
                        className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                    />
                </div>

                {/* Blend Mode */}
                <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">Blend</label>
                    <select
                        value={activeLayer.blendMode}
                        onChange={(e) => setLayerBlendMode(activeLayer.id, e.target.value as BlendMode)}
                        className="flex-1 bg-secondary/50 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer appearance-none"
                    >
                        {BLEND_MODE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Mask Controls (image layers only) ── */}
            {isImage && (
                <div className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Mask</h3>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={!!activeLayer.isMask}
                            onChange={() => toggleLayerMask(activeLayer.id)}
                            className="w-3.5 h-3.5 rounded border-border accent-purple-500 cursor-pointer"
                        />
                        <span className="text-xs uppercase font-bold tracking-wider group-hover:text-foreground text-muted-foreground transition-colors">
                            Use as Mask
                        </span>
                    </label>

                    {activeLayer.isMask && (
                        <label className="flex items-center gap-2 cursor-pointer group ml-5">
                            <input
                                type="checkbox"
                                checked={!!activeLayer.invertMask}
                                onChange={() => toggleLayerInvertMask(activeLayer.id)}
                                className="w-3.5 h-3.5 rounded border-border accent-purple-500 cursor-pointer"
                            />
                            <span className="text-xs uppercase font-bold tracking-wider group-hover:text-foreground text-muted-foreground transition-colors">
                                Invert Mask
                            </span>
                        </label>
                    )}
                </div>
            )}

            {/* ── Transform (image layers only) ── */}
            {isImage && (
                <div className="space-y-2 border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transform</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center bg-secondary/50 border border-border rounded px-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
                            <label className="text-[10px] text-muted-foreground uppercase font-bold w-3">X</label>
                            <input
                                type="number"
                                value={Math.round(x)}
                                onChange={(e) => setLayerTransform(activeLayer.id, { x: parseInt(e.target.value) || 0, y, width, height })}
                                className="w-full bg-transparent border-none py-1.5 text-foreground text-xs focus:outline-none tabular-nums text-right"
                            />
                        </div>
                        <div className="flex items-center bg-secondary/50 border border-border rounded px-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
                            <label className="text-[10px] text-muted-foreground uppercase font-bold w-3">Y</label>
                            <input
                                type="number"
                                value={Math.round(y)}
                                onChange={(e) => setLayerTransform(activeLayer.id, { x, y: parseInt(e.target.value) || 0, width, height })}
                                className="w-full bg-transparent border-none py-1.5 text-foreground text-xs focus:outline-none tabular-nums text-right"
                            />
                        </div>
                        <div className="flex items-center bg-secondary/50 border border-border rounded px-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
                            <label className="text-[10px] text-muted-foreground uppercase font-bold w-3">W</label>
                            <input
                                type="number"
                                value={Math.round(width)}
                                onChange={(e) => setLayerTransform(activeLayer.id, { x, y, width: parseInt(e.target.value) || 0, height })}
                                className="w-full bg-transparent border-none py-1.5 text-foreground text-xs focus:outline-none tabular-nums text-right"
                            />
                        </div>
                        <div className="flex items-center bg-secondary/50 border border-border rounded px-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
                            <label className="text-[10px] text-muted-foreground uppercase font-bold w-3">H</label>
                            <input
                                type="number"
                                value={Math.round(height)}
                                onChange={(e) => setLayerTransform(activeLayer.id, { x, y, width, height: parseInt(e.target.value) || 0 })}
                                className="w-full bg-transparent border-none py-1.5 text-foreground text-xs focus:outline-none tabular-nums text-right"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Align (image layers only) ── */}
            {isImage && (
                <div className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Align</h3>
                    <div className="flex items-center justify-between gap-1 bg-secondary/30 p-1 rounded border border-border">
                        <Button variant="ghost" size="sm" className="flex-1 h-7 px-0" onClick={() => handleAlign('left')} title="Align Left">
                            <AlignLeft size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 h-7 px-0" onClick={() => handleAlign('centerH')} title="Align Horizontal Center">
                            <AlignCenter size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 h-7 px-0" onClick={() => handleAlign('right')} title="Align Right">
                            <AlignRight size={14} />
                        </Button>

                        <div className="w-[1px] h-4 bg-border mx-1" />

                        <Button variant="ghost" size="sm" className="flex-1 h-7 px-0" onClick={() => handleAlign('top')} title="Align Top">
                            <AlignLeft size={14} className="rotate-90" />
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 h-7 px-0" onClick={() => handleAlign('centerV')} title="Align Vertical Center">
                            <AlignCenter size={14} className="rotate-90" />
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 h-7 px-0" onClick={() => handleAlign('bottom')} title="Align Bottom">
                            <AlignRight size={14} className="rotate-90" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Scale (image layers only) ── */}
            {isImage && (
                <div className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Scale</h3>

                    <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1 text-[10px] uppercase font-bold tracking-wider h-8" onClick={handleFitCanvas}>
                            <Maximize className="mr-1.5" size={12} /> Fit
                        </Button>
                        <Button variant="secondary" className="flex-1 text-[10px] uppercase font-bold tracking-wider h-8" onClick={handleFillCanvas}>
                            <Maximize className="mr-1.5 opacity-50" size={12} /> Fill
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
