import { useEditorStore } from '@/store/editorStore';
import type { Layer, LayerKind } from '@/store/editorStore';
import {
    DndContext,
    pointerWithin,
    PointerSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable,
    useDndContext,
    DragOverlay,
    defaultDropAnimationSideEffects,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    Image as ImageIcon,
    Sliders,
    Folder,
    CircleDashed,
    Eye,
    EyeOff,
    Trash2,
    ChevronDown,
    ChevronRight,
    Plus,
    GripVertical,
    Upload,
    PanelLeftClose,
    PanelLeft,
    Copy,
    Pencil,
    MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import React, { useRef, useState, useEffect, useCallback } from 'react';

// Icon for each layer kind
const LAYER_ICONS: Record<LayerKind, React.ElementType> = {
    image: ImageIcon,
    adjustment: Sliders,
    group: Folder,
    mask: CircleDashed,
};

// Colors for layer kind badges
const KIND_COLORS: Record<LayerKind, string> = {
    image: 'text-blue-400',
    adjustment: 'text-amber-400',
    group: 'text-emerald-400',
    mask: 'text-purple-400',
};

// ─── Draggable/Droppable Layer Row ─────────────────────────────────────────
interface LayerRowProps {
    layer: Layer;
    isActive: boolean;
    depth: number;
    intent?: 'before' | 'after' | 'into' | null;
    isDropTarget?: boolean;
    isOverlay?: boolean;
    maskedBy?: string | null; // name of the mask layer that affects this layer
    onStartRename?: (id: string) => void;
    isRenaming?: boolean;
    renameValue?: string;
    onRenameChange?: (value: string) => void;
    onRenameCommit?: () => void;
    onRenameCancel?: () => void;
}

const LayerRow = ({ layer, isActive, depth, intent, isDropTarget, isOverlay, maskedBy, onStartRename, isRenaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel }: LayerRowProps) => {
    const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
        id: layer.id,
        data: { layer }
    });

    const { setNodeRef: setDroppableRef } = useDroppable({
        id: layer.id,
        data: { layer }
    });

    const setActiveLayer = useEditorStore(s => s.setActiveLayer);
    const toggleVisibility = useEditorStore(s => s.toggleLayerVisibility);
    const removeLayer = useEditorStore(s => s.removeLayer);
    const duplicateLayer = useEditorStore(s => s.duplicateLayer);
    const toggleCollapsed = useEditorStore(s => s.toggleLayerCollapsed);

    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isRenaming && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [isRenaming]);

    const Icon = LAYER_ICONS[layer.kind];
    const kindColor = KIND_COLORS[layer.kind];

    const setNodeRef = (node: HTMLElement | null) => {
        if (!isOverlay) {
            setDraggableRef(node);
            setDroppableRef(node);
        }
    };

    const isNesting = isDropTarget && intent === 'into';

    // Drop indicator styles
    let dropIndicator = null;
    if (isDropTarget && !isOverlay) {
        if (intent === 'before') {
            dropIndicator = <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none" />;
        } else if (intent === 'after') {
            dropIndicator = <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none" />;
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') onRenameCommit?.();
        if (e.key === 'Escape') onRenameCancel?.();
    };

    const rowContent = (
        <div
            ref={setNodeRef}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            className={`
                relative flex items-center gap-2 py-3 pr-2 border-b border-border/50 group cursor-pointer overflow-hidden
                transition-colors text-xs uppercase tracking-wider
                ${isActive && !isOverlay ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-secondary/30 border-l-2 border-l-transparent'}
                ${!layer.visible && !isOverlay ? 'opacity-40' : ''}
                ${isDragging && !isOverlay ? 'opacity-30' : ''}
                ${isOverlay ? 'bg-card border shadow-xl opacity-90 cursor-grabbing' : ''}
                ${isNesting ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-500/10' : ''}
            `}
            onClick={() => { if (!isOverlay) setActiveLayer(layer.id); }}
        >
            {dropIndicator}

            {/* Drag handle */}
            <button
                className={`shrink-0 p-0.5 ${isOverlay ? 'cursor-grabbing text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing'}`}
                {...attributes}
                {...listeners}
            >
                <GripVertical size={14} />
            </button>

            {/* Group collapse toggle */}
            {layer.kind === 'group' ? (
                <button
                    className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-0.5"
                    onClick={(e) => { e.stopPropagation(); toggleCollapsed(layer.id); }}
                >
                    {layer.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
            ) : (
                <span className="w-4 shrink-0" />
            )}

            {/* Kind icon */}
            <Icon size={14} className={`${kindColor} shrink-0`} />

            {/* Name – inline rename overlays static label to avoid row resize */}
            <div className="relative flex-1 min-w-0">
                <span
                    className={`block truncate font-bold text-xs select-none ${isRenaming && !isOverlay ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'}`}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!isOverlay) onStartRename?.(layer.id);
                    }}
                >
                    {layer.name}
                </span>
                {isRenaming && !isOverlay && (
                    <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue ?? ''}
                        onChange={(e) => onRenameChange?.(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={() => onRenameCommit?.()}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-0 w-full bg-secondary/50 border border-primary/50 rounded px-1.5 py-0 font-bold text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary uppercase tracking-wider"
                    />
                )}
            </div>

            {/* Mask badge */}
            {layer.isMask && (
                <span className="text-[9px] font-mono bg-purple-500/20 text-purple-400 px-1.5 py-0.5 border border-purple-500/30 shrink-0 pointer-events-none uppercase tracking-wider font-bold">
                    mask{layer.invertMask ? ' inv' : ''}
                </span>
            )}

            {/* Masked-by indicator */}
            {maskedBy && !layer.isMask && (
                <span className="text-[8px] font-mono text-purple-400/60 px-1 shrink-0 pointer-events-none truncate max-w-[60px]" title={`Masked by ${maskedBy}`}>
                    ◈ {maskedBy}
                </span>
            )}

            {/* Effect count badge */}
            {layer.effects.length > 0 && (
                <span className="text-[9px] font-mono bg-secondary/50 px-1.5 py-0.5 text-muted-foreground shrink-0 pointer-events-none">
                    {layer.effects.length} fx
                </span>
            )}

            {/* Visibility */}
            {!isOverlay && (
                <button
                    className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-0.5"
                    onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            )}

            {/* 3-dots menu */}
            {!isOverlay && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-0.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal size={14} />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                            onClick={() => onStartRename?.(layer.id)}
                            className="cursor-pointer text-xs font-bold uppercase tracking-wider gap-2"
                        >
                            <Pencil size={12} /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => duplicateLayer(layer.id)}
                            className="cursor-pointer text-xs font-bold uppercase tracking-wider gap-2"
                        >
                            <Copy size={12} /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => removeLayer(layer.id)}
                            className="cursor-pointer text-xs font-bold uppercase tracking-wider gap-2 text-destructive focus:text-destructive"
                        >
                            <Trash2 size={12} /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );

    // Wrap overlay rows without context menu
    if (isOverlay) return rowContent;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {rowContent}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">
                <ContextMenuItem
                    onClick={() => onStartRename?.(layer.id)}
                    className="cursor-pointer text-xs font-bold uppercase tracking-wider gap-2"
                >
                    <Pencil size={12} /> Rename
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() => duplicateLayer(layer.id)}
                    className="cursor-pointer text-xs font-bold uppercase tracking-wider gap-2"
                >
                    <Copy size={12} /> Duplicate
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    onClick={() => removeLayer(layer.id)}
                    className="cursor-pointer text-xs font-bold uppercase tracking-wider gap-2 text-destructive focus:text-destructive"
                >
                    <Trash2 size={12} /> Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

// ─── Root Drop Zone (for easy un-nesting) ──────────────────────────────
const RootDropZone = () => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'ROOT_ZONE',
        data: { isRootZone: true }
    });

    const { active } = useDndContext();
    const isDragging = !!active;

    return (
        <div
            ref={setNodeRef}
            className={`w-full overflow-hidden shrink-0 transition-all flex flex-col items-center justify-center 
                ${isDragging ? 'min-h-[80px] opacity-100 mt-4 border-2 border-dashed border-border' : 'h-0 min-h-0 opacity-0 m-0 border-0'}
                ${isOver ? 'bg-emerald-500/10 border-emerald-500 border-solid' : ''}
            `}
        >
            <span className={`text-[10px] uppercase tracking-wider font-bold transition-colors ${isOver ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                Drop at Root
            </span>
        </div>
    );
};

// ─── Main LayerTree Component ───────────────────────────────────────────
export const LayerTree = () => {
    const layers = useEditorStore(s => s.layers);
    const layerOrder = useEditorStore(s => s.layerOrder);
    const activeLayerId = useEditorStore(s => s.activeLayerId);
    const moveLayerToPosition = useEditorStore(s => s.moveLayerToPosition);
    const addImageLayer = useEditorStore(s => s.addImageLayer);
    const addAdjustmentLayer = useEditorStore(s => s.addAdjustmentLayer);
    const addGroup = useEditorStore(s => s.addGroup);
    const addMaskLayer = useEditorStore(s => s.addMaskLayer);
    const renameLayer = useEditorStore(s => s.renameLayer);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dropState, setDropState] = useState<{ overId: string; intent: 'before' | 'after' | 'into' } | null>(null);

    // Rename state
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const startRename = useCallback((id: string) => {
        const layer = useEditorStore.getState().layers[id];
        if (layer) {
            setRenamingId(id);
            setRenameValue(layer.name);
        }
    }, []);

    const commitRename = useCallback(() => {
        if (renamingId && renameValue.trim()) {
            renameLayer(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    }, [renamingId, renameValue, renameLayer]);

    const cancelRename = useCallback(() => {
        setRenamingId(null);
    }, []);

    const [width, setWidth] = useState(256);
    const [isMinimized, setIsMinimized] = useState(false);
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
                const newWidth = e.clientX;
                if (newWidth > 150 && newWidth < 600) {
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

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
        setDropState(null);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) {
            setDropState(null);
            return;
        }

        if (over.id === 'ROOT_ZONE') {
            setDropState({ overId: 'ROOT_ZONE', intent: 'into' });
            return;
        }

        const activeRect = active.rect.current.translated;
        const overRect = over.rect;

        if (activeRect && overRect) {
            const activeCenterY = activeRect.top + activeRect.height / 2;
            const overHeight = overRect.height;
            const offset = activeCenterY - overRect.top;

            const layer = layers[over.id as string];
            let intent: 'before' | 'after' | 'into' = 'after';

            if (layer?.kind === 'group') {
                if (offset < overHeight * 0.1) intent = 'before';
                else if (offset > overHeight * 0.9) intent = 'after';
                else intent = 'into';
            } else {
                intent = offset < overHeight * 0.5 ? 'before' : 'after';
            }

            setDropState({ overId: over.id as string, intent });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (dropState && dropState.overId !== event.active.id) {
            moveLayerToPosition(event.active.id as string, dropState.overId, dropState.intent);
        }
        setActiveDragId(null);
        setDropState(null);
    };

    const handleDragCancel = () => {
        setActiveDragId(null);
        setDropState(null);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            addImageLayer(img, file.name.replace(/\.[^.]+$/, ''));
            URL.revokeObjectURL(url);
        };
        img.src = url;
        e.target.value = '';
    };

    const buildRenderList = (): { layer: Layer; depth: number; maskedBy: string | null }[] => {
        const list: { layer: Layer; depth: number; maskedBy: string | null }[] = [];
        const walk = (ids: string[], depth: number) => {
            // First pass: find mask layers at this level
            // A mask affects all layers below it until the next mask
            const maskMap = new Map<string, string>(); // layerId -> maskName
            let currentMask: string | null = null;
            for (let i = 0; i < ids.length; i++) {
                const layer = layers[ids[i]];
                if (!layer) continue;
                if (layer.isMask) {
                    currentMask = layer.name;
                } else if (currentMask) {
                    maskMap.set(ids[i], currentMask);
                }
            }

            for (const id of ids) {
                const layer = layers[id];
                if (!layer) continue;
                list.push({ layer, depth, maskedBy: maskMap.get(id) || null });
                if (layer.kind === 'group' && !layer.collapsed && layer.children.length > 0) {
                    walk(layer.children, depth + 1);
                }
            }
        };
        walk(layerOrder, 0);
        return list;
    };

    const renderList = buildRenderList();
    const activeLayer = activeDragId ? layers[activeDragId] : null;

    return (
        <div
            className={`h-full bg-card border-r border-border flex flex-col text-xs relative shrink-0 whitespace-nowrap overflow-hidden ${isResizing.current ? '' : 'transition-[width] duration-300 ease-in-out'}`}
            style={{ width: isMinimized ? 48 : `${width}px` }}
        >
            {/* Drag Handle */}
            {!isMinimized && (
                <div
                    className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-10"
                    onMouseDown={startResizing}
                />
            )}

            {/* Header */}
            <div className={`p-4 border-b border-border flex ${isMinimized ? 'justify-center' : 'justify-between'} items-center bg-secondary/50 uppercase tracking-wider w-full`}>
                {!isMinimized && <h2 className="font-bold text-xs truncate">Layers</h2>}

                <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setIsMinimized(!isMinimized)}>
                        {isMinimized ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
                    </Button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleImageUpload}
                />
            </div>

            {/* Draggable layer list */}
            {!isMinimized ? (
                <div className="flex-1 overflow-y-auto relative w-full">
                    {renderList.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8 font-mono uppercase tracking-wider border border-dashed border-border m-3 text-[10px]">
                            <Upload size={16} className="mx-auto mb-2 text-muted-foreground/50" />
                            No Layers
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={pointerWithin}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onDragCancel={handleDragCancel}
                        >
                            {renderList.map(({ layer, depth, maskedBy }) => {
                                const isDropTarget = dropState?.overId === layer.id && activeDragId !== layer.id;
                                return (
                                    <LayerRow
                                        key={layer.id}
                                        layer={layer}
                                        isActive={layer.id === activeLayerId}
                                        depth={depth}
                                        isDropTarget={isDropTarget}
                                        intent={isDropTarget ? dropState.intent : null}
                                        maskedBy={maskedBy}
                                        onStartRename={startRename}
                                        isRenaming={renamingId === layer.id}
                                        renameValue={renamingId === layer.id ? renameValue : undefined}
                                        onRenameChange={setRenameValue}
                                        onRenameCommit={commitRename}
                                        onRenameCancel={cancelRename}
                                    />
                                );
                            })}

                            <RootDropZone />

                            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
                                {activeLayer ? (
                                    <LayerRow
                                        layer={activeLayer}
                                        isActive={true}
                                        depth={0}
                                        isOverlay
                                    />
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto flex flex-col items-center py-4 gap-4 w-full">
                    <Folder size={16} className="text-muted-foreground opacity-30" />
                </div>
            )}

            {/* Footer Action */}
            {!isMinimized && (
                <div className="p-3 border-t border-border bg-secondary/30 flex justify-center w-full relative z-20">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider">
                                <Plus size={14} className="mr-2" /> Add Layer
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center" className="w-48 bg-card border-border">
                            <DropdownMenuItem
                                onClick={() => fileInputRef.current?.click()}
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground font-bold text-xs uppercase tracking-wider"
                            >
                                <ImageIcon size={12} className="mr-2 text-blue-400" />
                                Image Layer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => addAdjustmentLayer()}
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground font-bold text-xs uppercase tracking-wider"
                            >
                                <Sliders size={12} className="mr-2 text-amber-400" />
                                Adjustment Layer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => addGroup()}
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground font-bold text-xs uppercase tracking-wider"
                            >
                                <Folder size={12} className="mr-2 text-emerald-400" />
                                Group
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => addMaskLayer()}
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground font-bold text-xs uppercase tracking-wider"
                            >
                                <CircleDashed size={12} className="mr-2 text-purple-400" />
                                Mask Layer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
};
