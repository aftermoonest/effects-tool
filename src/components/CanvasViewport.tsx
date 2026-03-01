import { useEditorStore } from '@/store/editorStore';
import { Compositor } from '@/engine/Compositor';
import { Upload, Plus, Minus, Maximize, ScanLine } from 'lucide-react';
import React, { useRef, useEffect, useCallback, useMemo } from 'react';

export const CanvasViewport = () => {
    const layers = useEditorStore((s) => s.layers);
    const layerOrder = useEditorStore((s) => s.layerOrder);
    const addImageLayer = useEditorStore((s) => s.addImageLayer);
    const canvasWidth = useEditorStore((s) => s.canvasWidth);
    const canvasHeight = useEditorStore((s) => s.canvasHeight);
    const canvasTransparent = useEditorStore((s) => s.canvasTransparent);
    const zoom = useEditorStore((s) => s.zoom);
    const panX = useEditorStore((s) => s.panX);
    const panY = useEditorStore((s) => s.panY);
    const setZoom = useEditorStore((s) => s.setZoom);
    const setPan = useEditorStore((s) => s.setPan);
    const fitToScreen = useEditorStore((s) => s.fitToScreen);
    const resetZoom = useEditorStore((s) => s.resetZoom);
    const activeLayerId = useEditorStore((s) => s.activeLayerId);
    const setLayerPosition = useEditorStore((s) => s.setLayerPosition);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const webglCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isPanning = useRef(false);
    const isDraggingLayer = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const [isSpaceDown, setIsSpaceDown] = React.useState(false);

    // Derive whether we have any image layer
    const hasImage = useMemo(() => {
        return layerOrder.some(id => layers[id]?.kind === 'image');
    }, [layers, layerOrder]);

    // Initialize WebGL compositor once
    useEffect(() => {
        if (!webglCanvasRef.current) return;
        const compositor = new Compositor(webglCanvasRef.current);
        return () => compositor.destroy();
    }, []);

    // Track spacebar for panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea') return;
                e.preventDefault();
                setIsSpaceDown(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpaceDown(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Auto fit-to-screen when canvas dimensions change (first image loaded)
    useEffect(() => {
        if (canvasWidth > 0 && canvasHeight > 0 && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            fitToScreen(rect.width, rect.height);
        }
    }, [canvasWidth, canvasHeight]);

    // Native wheel listener with { passive: false } to allow preventDefault
    // Uses continuous delta for smooth trackpad/mouse zoom
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            const state = useEditorStore.getState();
            if (state.canvasWidth === 0) return;
            e.preventDefault();

            const currentZoom = state.zoom;
            const currentPanX = state.panX;
            const currentPanY = state.panY;

            // Use continuous delta for smooth, proportional zoom
            // Trackpads send small deltas (~1-4), mice send larger (~100)
            // The divisor controls sensitivity — higher = slower
            const zoomSensitivity = 600;
            const factor = 1 - e.deltaY / zoomSensitivity;
            const newZoom = Math.min(Math.max(currentZoom * factor, 0.05), 16);

            // Zoom toward cursor position
            const rect = el.getBoundingClientRect();
            const cx = e.clientX - rect.left - rect.width / 2;
            const cy = e.clientY - rect.top - rect.height / 2;
            const scale = newZoom / currentZoom;

            state.setPan(cx - scale * (cx - currentPanX), cy - scale * (cy - currentPanY));
            state.setZoom(newZoom);
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            addImageLayer(img, file.name.replace(/\.[^/.]+$/, ''));
            URL.revokeObjectURL(url);
        };
        img.src = url;
    };

    // Pan / Drag via mouse
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && isSpaceDown)) {
            isPanning.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        } else if (e.button === 0) {
            // Check if we have an active image layer to drag
            const state = useEditorStore.getState();
            const activeId = state.activeLayerId;
            if (activeId) {
                const layer = state.layers[activeId];
                if (layer && layer.kind === 'image') {
                    isDraggingLayer.current = true;
                    lastMouse.current = { x: e.clientX, y: e.clientY };
                    e.preventDefault();
                }
            }
        }
    }, [isSpaceDown]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning.current && !isDraggingLayer.current) return;

        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };

        if (isPanning.current) {
            setPan(panX + dx, panY + dy);
        } else if (isDraggingLayer.current) {
            const state = useEditorStore.getState();
            const activeId = state.activeLayerId;
            if (activeId) {
                const layer = state.layers[activeId];
                if (layer) {
                    setLayerPosition(activeId, layer.x + dx / zoom, layer.y + dy / zoom);
                }
            }
        }
    }, [panX, panY, zoom, setPan, setLayerPosition]);

    const handleMouseUp = useCallback(() => {
        isPanning.current = false;
        isDraggingLayer.current = false;
    }, []);

    // Zoom step buttons
    const zoomIn = () => setZoom(Math.min(zoom * 1.25, 16));
    const zoomOut = () => setZoom(Math.max(zoom / 1.25, 0.05));

    const handleFit = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            fitToScreen(rect.width, rect.height);
        }
    };

    const zoomPercent = Math.round(zoom * 100);

    const cursorClass = useMemo(() => {
        if (!hasImage) return '';
        if (isSpaceDown) {
            return 'cursor-grab active:cursor-grabbing';
        }
        if (activeLayerId) {
            const layer = layers[activeLayerId];
            if (layer && layer.kind === 'image') {
                return 'cursor-move';
            }
        }
        return '';
    }, [hasImage, isSpaceDown, activeLayerId, layers]);

    return (
        <div className="flex-1 relative flex flex-col overflow-hidden">
            {/* Canvas pan/zoom area */}
            <div
                ref={containerRef}
                className={`flex-1 relative overflow-hidden ${cursorClass}`}
                onMouseDown={hasImage ? handleMouseDown : undefined}
                onMouseMove={hasImage ? handleMouseMove : undefined}
                onMouseUp={hasImage ? handleMouseUp : undefined}
                onMouseLeave={hasImage ? handleMouseUp : undefined}
            >
                {/* Transformable canvas wrapper — always rendered, hidden when no image */}
                <div
                    className="absolute"
                    style={{
                        width: hasImage ? canvasWidth : 1,
                        height: hasImage ? canvasHeight : 1,
                        left: '50%',
                        top: '50%',
                        transform: hasImage
                            ? `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`
                            : 'translate(-50%, -50%)',
                        transformOrigin: 'center center',
                        visibility: hasImage ? 'visible' : 'hidden',
                    }}
                >
                    <canvas
                        id="webgl-canvas"
                        ref={webglCanvasRef}
                        className="block"
                        style={{
                            width: hasImage ? canvasWidth : 1,
                            height: hasImage ? canvasHeight : 1,
                            imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                            backgroundImage: canvasTransparent ? 'repeating-conic-gradient(#1f1f1f 0% 25%, #2a2a2a 0% 50%)' : 'none',
                            backgroundSize: '16px 16px',
                        }}
                    />
                    {/* ASCII overlay canvas */}
                    <canvas
                        id="ascii-canvas"
                        className="absolute inset-0 pointer-events-none opacity-0"
                        style={{
                            width: hasImage ? canvasWidth : 1,
                            height: hasImage ? canvasHeight : 1,
                        }}
                    />
                </div>

                {/* Upload overlay when no image */}
                {!hasImage && (
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/10 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/png, image/jpeg, image/webp"
                            onChange={handleFileUpload}
                        />
                        <div className="text-center space-y-4 uppercase tracking-wider">
                            <Upload size={32} className="text-primary mx-auto mb-4" />
                            <h3 className="text-sm font-bold">Input Image Source</h3>
                            <p className="text-xs text-muted-foreground font-mono">Click to load data.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Zoom toolbar — floating bottom center */}
            {hasImage && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0 bg-card/90 backdrop-blur-sm border border-border text-xs font-mono z-10">
                    <button
                        onClick={zoomOut}
                        className="px-2.5 py-2 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground border-r border-border"
                        title="Zoom out"
                    >
                        <Minus size={14} />
                    </button>
                    <span className="px-3 py-2 min-w-[52px] text-center tabular-nums text-foreground select-none">
                        {zoomPercent}%
                    </span>
                    <button
                        onClick={zoomIn}
                        className="px-2.5 py-2 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground border-l border-border"
                        title="Zoom in"
                    >
                        <Plus size={14} />
                    </button>
                    <div className="w-px h-5 bg-border mx-0.5" />
                    <button
                        onClick={handleFit}
                        className="px-2.5 py-2 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground uppercase tracking-wider"
                        title="Fit to screen"
                    >
                        <Maximize size={14} />
                    </button>
                    <button
                        onClick={resetZoom}
                        className="px-2.5 py-2 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground border-l border-border uppercase tracking-wider"
                        title="100% (actual pixels)"
                    >
                        <ScanLine size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};
