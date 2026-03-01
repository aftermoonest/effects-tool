import { useEditorStore } from '@/store/editorStore';
import { AlignLeft, AlignCenter, AlignRight, Maximize, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PropertiesPanel = () => {
    const layers = useEditorStore(s => s.layers);
    const activeLayerId = useEditorStore(s => s.activeLayerId);
    const setLayerPosition = useEditorStore(s => s.setLayerPosition);
    const setLayerSize = useEditorStore(s => s.setLayerSize);
    const canvasWidth = useEditorStore(s => s.canvasWidth);
    const canvasHeight = useEditorStore(s => s.canvasHeight);

    const activeLayer = activeLayerId ? layers[activeLayerId] : null;

    if (!activeLayer || activeLayer.kind !== 'image') {
        return (
            <div className="text-muted-foreground text-center py-8 font-mono uppercase tracking-wider border border-dashed border-border m-3 text-[10px]">
                <Settings2 size={16} className="mx-auto mb-2 text-muted-foreground/50" />
                No properties for<br />
                <span className="text-foreground">{activeLayer ? activeLayer.name : 'Selection'}</span>
            </div>
        );
    }

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

        setLayerPosition(activeLayer.id, nx, ny);
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

        setLayerSize(activeLayer.id, nw, nh);
        setLayerPosition(activeLayer.id, nx, ny);
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

        setLayerSize(activeLayer.id, nw, nh);
        setLayerPosition(activeLayer.id, nx, ny);
    };

    return (
        <div className="p-4 space-y-6">
            <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Align</h3>
                <div className="flex gap-1 bg-secondary/30 p-1 rounded border border-border">
                    <Button variant="ghost" size="sm" className="flex-1 h-7" onClick={() => handleAlign('left')} title="Align Left">
                        <AlignLeft size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 h-7 text-[10px] uppercase font-bold" onClick={() => handleAlign('centerH')} title="Align Horizontal Center">
                        <AlignCenter size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 h-7" onClick={() => handleAlign('right')} title="Align Right">
                        <AlignRight size={14} />
                    </Button>
                </div>
                <div className="flex gap-1 bg-secondary/30 p-1 rounded border border-border">
                    <Button variant="ghost" size="sm" className="flex-1 h-7 text-[10px] uppercase font-bold tracking-wider" onClick={() => handleAlign('top')} title="Align Top">
                        Top
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 h-7 text-[10px] uppercase font-bold tracking-wider" onClick={() => handleAlign('centerV')} title="Align Vertical Center">
                        Center
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 h-7 text-[10px] uppercase font-bold tracking-wider" onClick={() => handleAlign('bottom')} title="Align Bottom">
                        Bottom
                    </Button>
                </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Size</h3>
                <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase">Width</label>
                        <input
                            type="number"
                            value={Math.round(width)}
                            onChange={(e) => setLayerSize(activeLayer.id, parseInt(e.target.value) || 0, height)}
                            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                        />
                    </div>
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase">Height</label>
                        <input
                            type="number"
                            value={Math.round(height)}
                            onChange={(e) => setLayerSize(activeLayer.id, width, parseInt(e.target.value) || 0)}
                            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                        />
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <Button variant="secondary" className="flex-1 text-[10px] uppercase font-bold tracking-wider h-8" onClick={handleFitCanvas}>
                        <Maximize className="mr-2" size={12} /> Fit Canvas
                    </Button>
                    <Button variant="secondary" className="flex-1 text-[10px] uppercase font-bold tracking-wider h-8" onClick={handleFillCanvas}>
                        <Maximize className="mr-2" size={12} /> Fill Canvas
                    </Button>
                </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Position</h3>
                <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase pl-1">X</label>
                        <input
                            type="number"
                            value={Math.round(x)}
                            onChange={(e) => setLayerPosition(activeLayer.id, parseInt(e.target.value) || 0, y)}
                            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                        />
                    </div>
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase pl-1">Y</label>
                        <input
                            type="number"
                            value={Math.round(y)}
                            onChange={(e) => setLayerPosition(activeLayer.id, x, parseInt(e.target.value) || 0)}
                            className="w-full bg-secondary/50 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
