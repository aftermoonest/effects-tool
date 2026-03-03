import { useEditorStore } from '@/store/editorStore';
import { useState } from 'react';
import { ChevronDown, LayoutTemplate } from 'lucide-react';
import { Button } from './ui/button';
import { NumberInput } from './ui/number-input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { TemplatesPanel } from './TemplatesPanel';

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



    const hasImageLayer = layerOrder.some(id => {
        const kind = layers[id]?.kind;
        return kind === 'image' || kind === 'solid';
    });

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

    const [showTemplates, setShowTemplates] = useState(false);

    return (
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0 uppercase tracking-widest text-xs font-bold w-full">
            <div className="flex items-center gap-4">
                <span className="text-primary font-mono text-lg leading-none">AF /  Effects</span>
            </div>

            {/* Canvas Editor */}
            <div className="flex items-center gap-4 font-mono text-muted-foreground mr-8">
                <div className="flex items-center gap-1.5">
                    <NumberInput
                        label="W"
                        value={canvasWidth}
                        onChange={(val) => { if (val > 0) setCanvasSize(val, canvasHeight); }}
                        step={1}
                        min={1}
                        className="w-24"
                    />
                    <NumberInput
                        label="H"
                        value={canvasHeight}
                        onChange={(val) => { if (val > 0) setCanvasSize(canvasWidth, val); }}
                        step={1}
                        min={1}
                        className="w-24"
                    />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground">
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
                        aria-label="Canvas background color"
                        className={`w-6 h-6 p-0 border-0 rounded cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded ${canvasTransparent ? 'opacity-30' : 'opacity-100'}`}
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer ml-1">
                        <input
                            type="checkbox"
                            checked={canvasTransparent}
                            onChange={(e) => setCanvasBg(canvasBgColor, e.target.checked)}
                            aria-label="Toggle transparent background"
                            className="w-3 h-3 accent-primary"
                        />
                        <span className="text-[10px] mt-0.5">Alpha</span>
                    </label>
                </div>

            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => setShowTemplates(true)}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 border border-border hover:border-primary/50 uppercase font-bold tracking-wider text-xs"
                >
                    <LayoutTemplate size={14} />
                    Templates
                </button>
                <Button
                    onClick={handleExport}
                    disabled={!hasImageLayer}
                    size="sm"
                >
                    Export
                </Button>
            </div>

            <TemplatesPanel open={showTemplates} onClose={() => setShowTemplates(false)} />
        </header>
    );
};
