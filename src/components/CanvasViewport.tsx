import { useEditorStore } from '@/store/editorStore';
import type { Layer } from '@/store/editorStore';
import { Compositor } from '@/engine/Compositor';
import { Plus, Minus, Maximize, ScanLine, Undo2, Redo2 } from 'lucide-react';
import Moveable from 'react-moveable';
import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';

interface BoxRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

const MIN_LAYER_SIZE = 8;

import { isTextInputTarget } from '@/lib/utils';
import { importLayerImageFromFile } from '@/lib/importLayerFile';
import { Upload } from 'lucide-react';

const getVisibleImageLayers = (layers: Record<string, Layer>, layerOrder: string[]): Layer[] => {
    const ordered: Layer[] = [];

    const walk = (ids: string[]) => {
        for (const id of ids) {
            const layer = layers[id];
            if (!layer || !layer.visible) continue;

            if (layer.kind === 'group' && layer.children.length > 0) {
                walk(layer.children);
            }

            if (layer.kind === 'image') {
                ordered.push(layer);
            }
        }
    };

    walk(layerOrder);

    // Render hitboxes from bottom-to-top so top-most layers remain clickable.
    return ordered.reverse();
};

const hasVisibleSolidLayer = (layers: Record<string, Layer>, layerOrder: string[]): boolean => {
    const walk = (ids: string[]): boolean => {
        for (const id of ids) {
            const layer = layers[id];
            if (!layer || !layer.visible) continue;
            if (layer.kind === 'solid') return true;
            if (layer.kind === 'group' && layer.children.length > 0 && walk(layer.children)) {
                return true;
            }
        }
        return false;
    };
    return walk(layerOrder);
};

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
    const setActiveLayer = useEditorStore((s) => s.setActiveLayer);
    const asciiImportFontId = useEditorStore((s) => s.asciiImportFontId);

    // Undo/Redo Transform State
    const undoTransform = useEditorStore((s) => s.undoTransform);
    const redoTransform = useEditorStore((s) => s.redoTransform);
    const canUndo = useEditorStore((s) => s.transformUndoStack.length > 0);
    const canRedo = useEditorStore((s) => s.transformRedoStack.length > 0);

    const webglCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const moveableRef = useRef<any>(null);
    const layerBoxRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
    const [moveableTarget, setMoveableTarget] = useState<HTMLElement | null>(null);

    const [isSpaceDown, setIsSpaceDown] = useState(false);
    const [isShiftDown, setIsShiftDown] = useState(false);
    const [isAltDown, setIsAltDown] = useState(false);
    const [isMetaCtrlDown, setIsMetaCtrlDown] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    const panPointerIdRef = useRef<number | null>(null);
    const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

    const visibleImageLayers = useMemo(() => getVisibleImageLayers(layers, layerOrder), [layers, layerOrder]);
    const hasSolidLayer = useMemo(() => hasVisibleSolidLayer(layers, layerOrder), [layers, layerOrder]);
    const hasImage = visibleImageLayers.length > 0 || hasSolidLayer;

    const activeImageLayer = useMemo(() => {
        if (!activeLayerId) return null;
        const layer = layers[activeLayerId];
        if (!layer || layer.kind !== 'image') return null;
        return layer;
    }, [activeLayerId, layers]);

    // Initialize WebGL compositor once
    useEffect(() => {
        if (!webglCanvasRef.current) return;
        const compositor = new Compositor(webglCanvasRef.current);
        return () => compositor.destroy();
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        const updateSize = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setContainerSize({ width: rect.width, height: rect.height });
        };

        updateSize();

        const observer = new ResizeObserver(updateSize);
        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    // Auto fit-to-screen when canvas dimensions change.
    useEffect(() => {
        if (canvasWidth > 0 && canvasHeight > 0 && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            fitToScreen(rect.width, rect.height);
        }
    }, [canvasWidth, canvasHeight, fitToScreen]);

    useEffect(() => {
        if (!activeLayerId) {
            setMoveableTarget(null);
            return;
        }

        setMoveableTarget(layerBoxRefs.current[activeLayerId] ?? null);
    }, [activeLayerId, visibleImageLayers, zoom, panX, panY, containerSize.width, containerSize.height]);

    useEffect(() => {
        moveableRef.current?.updateRect();
    }, [moveableTarget, zoom, panX, panY, layers, containerSize.width, containerSize.height]);

    // Native wheel listener with { passive: false } to allow preventDefault.
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

            if (e.shiftKey || e.ctrlKey) {
                const zoomSensitivity = 600;
                const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
                const factor = 1 - delta / zoomSensitivity;
                const newZoom = Math.min(Math.max(currentZoom * factor, 0.05), 16);

                const rect = el.getBoundingClientRect();
                const cx = e.clientX - rect.left - rect.width / 2;
                const cy = e.clientY - rect.top - rect.height / 2;
                const scale = newZoom / currentZoom;

                state.setPan(cx - scale * (cx - currentPanX), cy - scale * (cy - currentPanY));
                state.setZoom(newZoom);
            } else {
                state.setPan(currentPanX - e.deltaX, currentPanY - e.deltaY);
            }
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // Keyboard modifiers + nudging + undo/redo.
    useEffect(() => {
        const updateModifierState = (e: KeyboardEvent) => {
            setIsShiftDown(e.shiftKey);
            setIsAltDown(e.altKey);
            setIsMetaCtrlDown(e.metaKey || e.ctrlKey);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            updateModifierState(e);

            if (e.code === 'Space' && !e.repeat && !isTextInputTarget(e.target)) {
                e.preventDefault();
                setIsSpaceDown(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpaceDown(false);
            }
            updateModifierState(e);
        };

        const handleBlur = () => {
            setIsSpaceDown(false);
            setIsShiftDown(false);
            setIsAltDown(false);
            setIsMetaCtrlDown(false);
            setIsPanning(false);
            panPointerIdRef.current = null;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    const canvasScreenRect = useMemo<BoxRect>(() => {
        const width = canvasWidth * zoom;
        const height = canvasHeight * zoom;
        return {
            width,
            height,
            left: containerSize.width / 2 + panX - width / 2,
            top: containerSize.height / 2 + panY - height / 2,
        };
    }, [canvasWidth, canvasHeight, zoom, panX, panY, containerSize.width, containerSize.height]);

    const getLayerScreenRect = useCallback((layer: Layer): BoxRect => {
        return {
            left: canvasScreenRect.left + layer.x * zoom,
            top: canvasScreenRect.top + layer.y * zoom,
            width: layer.width * zoom,
            height: layer.height * zoom,
        };
    }, [canvasScreenRect.left, canvasScreenRect.top, zoom]);

    const verticalGuidelines = useMemo(() => {
        return [
            canvasScreenRect.left,
            canvasScreenRect.left + canvasScreenRect.width / 2,
            canvasScreenRect.left + canvasScreenRect.width,
        ];
    }, [canvasScreenRect.left, canvasScreenRect.width]);

    const horizontalGuidelines = useMemo(() => {
        return [
            canvasScreenRect.top,
            canvasScreenRect.top + canvasScreenRect.height / 2,
            canvasScreenRect.top + canvasScreenRect.height,
        ];
    }, [canvasScreenRect.top, canvasScreenRect.height]);

    const elementGuidelines = useMemo(() => {
        if (!activeLayerId) return [];

        return visibleImageLayers
            .filter((layer) => layer.id !== activeLayerId)
            .map((layer) => layerBoxRefs.current[layer.id])
            .filter((element): element is HTMLDivElement => !!element);
    }, [activeLayerId, visibleImageLayers]);

    const updateLayerFromScreenRect = useCallback((layerId: string, rect: BoxRect) => {
        const state = useEditorStore.getState();
        const layer = state.layers[layerId];
        if (!layer || layer.kind !== 'image') return;

        const x = (rect.left - canvasScreenRect.left) / zoom;
        const y = (rect.top - canvasScreenRect.top) / zoom;
        const width = rect.width / zoom;
        const height = rect.height / zoom;

        state.setLayerTransform(
            layerId,
            { x, y, width, height },
            {
                minSize: MIN_LAYER_SIZE,
            }
        );
    }, [canvasScreenRect.left, canvasScreenRect.top, zoom]);

    const onPanPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const isPanStart = e.button === 1 || (e.button === 0 && isSpaceDown);

        if (isPanStart) {
            panPointerIdRef.current = e.pointerId;
            panStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                panX,
                panY,
            };
            setIsPanning(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
        }

        if (e.button !== 0) return;

        const target = e.target as HTMLElement;
        const hitbox = target.closest('[data-layer-hitbox="true"]');
        const moveableControl = target.closest('.moveable-control-box');
        if (!hitbox && !moveableControl) {
            setActiveLayer(null);
        }
    }, [isSpaceDown, panX, panY, setActiveLayer]);

    const onPanPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (panPointerIdRef.current !== e.pointerId) return;

        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy);
    }, [setPan]);

    const endPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (panPointerIdRef.current !== e.pointerId) return;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        panPointerIdRef.current = null;
        setIsPanning(false);
    }, []);

    const zoomIn = () => setZoom(Math.min(zoom * 1.25, 16));
    const zoomOut = () => setZoom(Math.max(zoom / 1.25, 0.05));

    const handleFit = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        fitToScreen(rect.width, rect.height);
    };

    const onDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current++;
        if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current--;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragOver(false);
        }
    }, []);

    const onDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            try {
                const { image, name, asciiTextSource } = await importLayerImageFromFile(file, { asciiFontId: asciiImportFontId });
                addImageLayer(image, name, {
                    asciiTextSource,
                    asciiTextFontId: asciiTextSource ? asciiImportFontId : undefined,
                });
            } catch {
                // Skip unsupported files silently
            }
        }
    }, [addImageLayer, asciiImportFontId]);

    const cursorClass = useMemo(() => {
        if (isPanning) return 'cursor-grabbing';
        if (isSpaceDown) return 'cursor-grab';
        return '';
    }, [isPanning, isSpaceDown]);

    const zoomPercent = Math.round(zoom * 100);

    return (
        <div className="flex-1 relative flex flex-col overflow-hidden">
            <div
                ref={containerRef}
                data-canvas-container
                className={`flex-1 relative overflow-hidden ${cursorClass}`}
                onPointerDown={onPanPointerDown}
                onPointerMove={onPanPointerMove}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <div
                    className="absolute"
                    style={{
                        width: canvasWidth,
                        height: canvasHeight,
                        left: '50%',
                        top: '50%',
                        transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                    }}
                >
                    <canvas
                        id="webgl-canvas"
                        ref={webglCanvasRef}
                        className="block"
                        style={{
                            width: canvasWidth,
                            height: canvasHeight,
                            imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                            backgroundImage: canvasTransparent ? 'repeating-conic-gradient(#1f1f1f 0% 25%, #2a2a2a 0% 50%)' : 'none',
                            backgroundSize: '16px 16px',
                        }}
                    />
                    <canvas
                        id="ascii-canvas"
                        className="absolute inset-0 pointer-events-none opacity-0"
                        style={{
                            width: canvasWidth,
                            height: canvasHeight,
                        }}
                    />
                </div>

                {hasImage && (
                    <div ref={overlayRef} className="absolute inset-0 z-20 pointer-events-none select-none">
                        {visibleImageLayers.map((layer) => {
                            const rect = getLayerScreenRect(layer);
                            const isActive = layer.id === activeLayerId;

                            return (
                                <div
                                    key={layer.id}
                                    data-layer-id={layer.id}
                                    data-layer-hitbox="true"
                                    ref={(node) => {
                                        layerBoxRefs.current[layer.id] = node;
                                    }}
                                    className={`canvas-layer-hitbox absolute pointer-events-auto ${isActive ? 'ring-1 ring-primary border border-primary/50' : 'border border-transparent hover:border-primary/30'}`}
                                    style={{
                                        left: rect.left,
                                        top: rect.top,
                                        width: rect.width,
                                        height: rect.height,
                                        boxSizing: 'border-box',
                                    }}
                                    onPointerDown={(e) => {
                                        if (isSpaceDown) return;
                                        if (e.button !== 0) return;
                                        e.stopPropagation();
                                        setActiveLayer(layer.id);
                                    }}
                                />
                            );
                        })}

                        {activeImageLayer && moveableTarget && (
                            <Moveable
                                ref={moveableRef}
                                target={moveableTarget}
                                container={overlayRef.current ?? undefined}
                                rootContainer={overlayRef.current ?? undefined}
                                draggable
                                resizable
                                origin={false}
                                keepRatio={false}
                                renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
                                controlPadding={8}
                                linePadding={12}
                                snappable={!isMetaCtrlDown}
                                snapThreshold={8}
                                snapGap
                                verticalGuidelines={verticalGuidelines}
                                horizontalGuidelines={horizontalGuidelines}
                                elementGuidelines={elementGuidelines}
                                snapDirections={{
                                    left: true,
                                    right: true,
                                    top: true,
                                    bottom: true,
                                    center: true,
                                    middle: true,
                                }}
                                elementSnapDirections={{
                                    left: true,
                                    right: true,
                                    top: true,
                                    bottom: true,
                                    center: true,
                                    middle: true,
                                }}
                                onDragStart={({ target }) => {
                                    const layerId = (target as HTMLElement).dataset.layerId;
                                    if (!layerId) return;

                                    const state = useEditorStore.getState();
                                    const layer = state.layers[layerId];
                                    if (!layer || layer.kind !== 'image') return;

                                    state.setActiveLayer(layerId);
                                    state.beginTransformSession();
                                }}
                                onDrag={({ target, left, top }) => {
                                    const layerId = (target as HTMLElement).dataset.layerId;
                                    if (!layerId) return;

                                    updateLayerFromScreenRect(layerId, {
                                        left,
                                        top,
                                        width: (target as HTMLElement).offsetWidth,
                                        height: (target as HTMLElement).offsetHeight,
                                    });
                                }}
                                onDragEnd={() => {
                                    useEditorStore.getState().commitTransformSession();
                                }}
                                onResizeStart={({ target }) => {
                                    const layerId = (target as HTMLElement).dataset.layerId;
                                    if (!layerId) return;

                                    const state = useEditorStore.getState();
                                    const layer = state.layers[layerId];
                                    if (!layer || layer.kind !== 'image') return;

                                    state.setActiveLayer(layerId);
                                    state.beginTransformSession();
                                    resizeStartRef.current = {
                                        x: layer.x,
                                        y: layer.y,
                                        width: layer.width,
                                        height: layer.height,
                                    };
                                }}
                                onResize={({ target, width, height, direction }) => {
                                    const layerId = (target as HTMLElement).dataset.layerId;
                                    if (!layerId) return;

                                    const resizeStart = resizeStartRef.current;
                                    if (!resizeStart) return;

                                    const sw = resizeStart.width * zoom;
                                    const sh = resizeStart.height * zoom;
                                    const sx = canvasScreenRect.left + resizeStart.x * zoom;
                                    const sy = canvasScreenRect.top + resizeStart.y * zoom;

                                    // Protect against 0 height images
                                    const aspect = sh === 0 ? 1 : sw / sh;

                                    let nextWidth = width;
                                    let nextHeight = height;

                                    // Photographer standard: keep ratio by default, Shift for free transform
                                    const isCorner = direction[0] !== 0 && direction[1] !== 0;
                                    const shouldKeepRatio = isCorner ? !isShiftDown : isShiftDown;

                                    if (shouldKeepRatio) {
                                        if (direction[0] !== 0 && direction[1] === 0) {
                                            // Edge E, W
                                            nextHeight = nextWidth / aspect;
                                        } else if (direction[0] === 0 && direction[1] !== 0) {
                                            // Edge N, S
                                            nextWidth = nextHeight * aspect;
                                        } else if (direction[0] !== 0 && direction[1] !== 0) {
                                            // Corner NW, NE, SW, SE
                                            if (Math.abs(width - sw) / sw > Math.abs(height - sh) / sh) {
                                                nextHeight = nextWidth / aspect;
                                            } else {
                                                nextWidth = nextHeight * aspect;
                                            }
                                        }
                                    }

                                    let nextLeft: number;
                                    let nextTop: number;

                                    if (isAltDown) {
                                        nextLeft = sx + (sw - nextWidth) / 2;
                                        nextTop = sy + (sh - nextHeight) / 2;
                                    } else {
                                        if (direction[0] === 1) nextLeft = sx;
                                        else if (direction[0] === -1) nextLeft = sx + sw - nextWidth;
                                        else nextLeft = sx + (sw - nextWidth) / 2;

                                        if (direction[1] === 1) nextTop = sy;
                                        else if (direction[1] === -1) nextTop = sy + sh - nextHeight;
                                        else nextTop = sy + (sh - nextHeight) / 2;
                                    }

                                    updateLayerFromScreenRect(layerId, {
                                        left: nextLeft,
                                        top: nextTop,
                                        width: nextWidth,
                                        height: nextHeight
                                    });
                                }}
                                onResizeEnd={() => {
                                    resizeStartRef.current = null;
                                    useEditorStore.getState().commitTransformSession();
                                }}
                            />
                        )}
                    </div>
                )}

                {isDragOver && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm border-2 border-dashed border-primary pointer-events-none">
                        <div className="flex flex-col items-center gap-2 text-primary">
                            <Upload size={32} />
                            <span className="font-mono text-xs uppercase tracking-widest font-bold">Drop Image</span>
                        </div>
                    </div>
                )}

            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0 bg-card/90 backdrop-blur-sm border border-border text-xs font-mono z-30 pointer-events-auto">
                    <button
                        onClick={undoTransform}
                        disabled={!canUndo}
                        className="px-2.5 py-2 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed border-r border-border"
                        title="Undo Transform"
                    >
                        <Undo2 size={14} />
                    </button>
                    <button
                        onClick={redoTransform}
                        disabled={!canRedo}
                        className="px-2.5 py-2 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed border-r border-border"
                        title="Redo Transform"
                    >
                        <Redo2 size={14} />
                    </button>

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
        </div>
    );
};
