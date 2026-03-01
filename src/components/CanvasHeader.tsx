import { useEditorStore } from '@/store/editorStore';
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

const PRESETS = [
    { label: '1080p (1920x1080)', width: 1920, height: 1080 },
    { label: 'Square (1080x1080)', width: 1080, height: 1080 },
    { label: 'Portrait (1080x1920)', width: 1080, height: 1920 },
    { label: '4K (3840x2160)', width: 3840, height: 2160 },
];

export const CanvasHeader = () => {
    const canvasWidth = useEditorStore(s => s.canvasWidth);
    const canvasHeight = useEditorStore(s => s.canvasHeight);
    const canvasBgColor = useEditorStore(s => s.canvasBgColor);
    const canvasTransparent = useEditorStore(s => s.canvasTransparent);
    const layerOrder = useEditorStore(s => s.layerOrder);
    const layers = useEditorStore(s => s.layers);
    const setCanvasSize = useEditorStore(s => s.setCanvasSize);
    const setCanvasBg = useEditorStore(s => s.setCanvasBg);

    const [w, setW] = useState(canvasWidth.toString());
    const [h, setH] = useState(canvasHeight.toString());

    useEffect(() => {
        setW(canvasWidth.toString());
        setH(canvasHeight.toString());
    }, [canvasWidth, canvasHeight]);

    const handleApplySize = () => {
        const nw = parseInt(w, 10);
        const nh = parseInt(h, 10);
        if (!isNaN(nw) && !isNaN(nh) && nw > 0 && nh > 0) {
            setCanvasSize(nw, nh);
        } else {
            setW(canvasWidth.toString());
            setH(canvasHeight.toString());
        }
    };

    const hasImageLayer = layerOrder.some(id => layers[id]?.kind === 'image');

    const handleExport = () => {
        const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
        if (!canvas || canvas.width <= 1 || canvas.height <= 1) {
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const link = document.createElement('a');
        link.download = `effects-export-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    return (
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0 uppercase tracking-widest text-xs font-bold w-full">
            <div className="flex items-center gap-4">
                <span className="text-primary font-mono text-lg leading-none">VFX</span>
            </div>

            {/* Canvas Editor */}
            <div className="flex items-center gap-6 font-mono text-muted-foreground mr-8">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">W:</span>
                    <input
                        type="number"
                        value={w}
                        onChange={e => setW(e.target.value)}
                        onBlur={handleApplySize}
                        onKeyDown={e => e.key === 'Enter' && handleApplySize()}
                        className="w-24 bg-secondary/50 border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-center appearance-none tabular-nums"
                    />
                    <span className="text-[10px] ml-2">H:</span>
                    <input
                        type="number"
                        value={h}
                        onChange={e => setH(e.target.value)}
                        onBlur={handleApplySize}
                        onKeyDown={e => e.key === 'Enter' && handleApplySize()}
                        className="w-24 bg-secondary/50 border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-center appearance-none tabular-nums"
                    />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 ml-1 text-muted-foreground hover:text-foreground">
                                <ChevronDown size={14} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs font-mono uppercase tracking-wider">
                            {PRESETS.map(p => (
                                <DropdownMenuItem
                                    key={p.label}
                                    onClick={() => setCanvasSize(p.width, p.height)}
                                    className="cursor-pointer"
                                >
                                    {p.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="w-px h-4 bg-border" />

                <div className="flex items-center gap-3">
                    <span className="text-[10px]">BG:</span>
                    <input
                        type="color"
                        value={canvasBgColor}
                        onChange={(e) => setCanvasBg(e.target.value, false)}
                        className={`w-6 h-6 p-0 border-0 rounded cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded ${canvasTransparent ? 'opacity-30' : 'opacity-100'}`}
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer ml-1">
                        <input
                            type="checkbox"
                            checked={canvasTransparent}
                            onChange={(e) => setCanvasBg(canvasBgColor, e.target.checked)}
                            className="w-3 h-3 accent-primary"
                        />
                        <span className="text-[10px] mt-0.5">Alpha</span>
                    </label>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={handleExport}
                    disabled={!hasImageLayer}
                    className="bg-primary text-primary-foreground px-4 py-1.5 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors uppercase font-bold tracking-wider rounded-sm text-xs"
                >
                    Export
                </button>
            </div>
        </header>
    );
};
