import { useEditorStore } from '@/store/editorStore';
import type { Layer, LayerKind } from '@/store/editorStore';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragOverEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Image as ImageIcon,
    Sliders,
    Folder,
    CircleDashed,
    Palette,
    Eye,
    EyeOff,
    Trash2,
    ChevronDown,
    ChevronRight,
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
import { importLayerImageFromFile, LAYER_UPLOAD_ACCEPT } from '@/lib/importLayerFile';
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

// Icon for each layer kind
const LAYER_ICONS: Record<LayerKind, React.ElementType> = {
    image: ImageIcon,
    solid: Palette,
    adjustment: Sliders,
    group: Folder,
    mask: CircleDashed,
};

// Colors for layer kind badges
const KIND_COLORS: Record<LayerKind, string> = {
    image: 'text-blue-400',
    solid: 'text-rose-400',
    adjustment: 'text-amber-400',
    group: 'text-emerald-400',
    mask: 'text-purple-400',
};

// ─── Draggable/Droppable Layer Row ─────────────────────────────────────────
type DropIntent = 'before' | 'after' | 'into';

interface LayerRowProps {
    layer: Layer;
    isActive: boolean;
    depth: number;
    maskedBy?: string | null;
    onStartRename?: (id: string) => void;
    isRenaming?: boolean;
    renameValue?: string;
    onRenameChange?: (value: string) => void;
    onRenameCommit?: () => void;
    onRenameCancel?: () => void;
}

const LayerRow = React.memo(({ layer, isActive, depth, maskedBy, onStartRename, isRenaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel }: LayerRowProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: layer.id,
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
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') onRenameCommit?.();
        if (e.key === 'Escape') onRenameCancel?.();
    };

    return (
        <div
            ref={setNodeRef}
            data-layer-id={layer.id}
            style={style}
            className={`
                relative flex flex-col border-b border-border/50 group bg-card
                transition-colors text-xs uppercase tracking-wider
                ${!layer.visible ? 'opacity-40' : ''}
                ${isDragging ? 'opacity-30 z-50 shadow-xl' : ''}
            `}
        >
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        style={{ paddingLeft: `${12 + depth * 16}px` }}
                        className={`
                            flex items-center gap-2 py-3 pr-2 cursor-pointer
                            ${isActive ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-secondary/30 border-l-2 border-l-transparent'}
                        `}
                        onClick={() => setActiveLayer(layer.id)}
                    >
                        {/* Drag handle */}
                        <button
                            className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                            {...attributes}
                            {...listeners}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Drag to reorder layer"
                        >
                            <GripVertical size={14} />
                        </button>

                        {/* Group collapse toggle */}
                        {layer.kind === 'group' ? (
                            <button
                                className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-1"
                                onClick={(e) => { e.stopPropagation(); toggleCollapsed(layer.id); }}
                                aria-label={layer.collapsed ? 'Expand group' : 'Collapse group'}
                            >
                                {layer.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                        ) : (
                            <span className="w-4 shrink-0" />
                        )}

                        {/* Kind icon */}
                        <Icon size={14} className={`${kindColor} shrink-0`} />

                        {/* Name */}
                        <div className="relative flex-1 min-w-0">
                            <span
                                className={`block truncate font-bold text-xs select-none ${isRenaming ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'}`}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    onStartRename?.(layer.id);
                                }}
                            >
                                {layer.name}
                            </span>
                            {isRenaming && (
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
                        <button
                            className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-1"
                            onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                            aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                        >
                            {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>

                        {/* 3-dots menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="text-muted-foreground hover:text-foreground shrink-0 z-10 relative p-1"
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Layer actions"
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
                    </div>
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
        </div>
    );
});

// ─── Main LayerTree Component ───────────────────────────────────────────
export const LayerTree = () => {
    const layers = useEditorStore(s => s.layers);
    const layerOrder = useEditorStore(s => s.layerOrder);
    const activeLayerId = useEditorStore(s => s.activeLayerId);
    const asciiImportFontId = useEditorStore(s => s.asciiImportFontId);
    const moveLayerToPosition = useEditorStore(s => s.moveLayerToPosition);
    const addImageLayer = useEditorStore(s => s.addImageLayer);
    const addSolidLayer = useEditorStore(s => s.addSolidLayer);
    const addAdjustmentLayer = useEditorStore(s => s.addAdjustmentLayer);
    const addGroup = useEditorStore(s => s.addGroup);
    const addMaskLayer = useEditorStore(s => s.addMaskLayer);
    const renameLayer = useEditorStore(s => s.renameLayer);

    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { image, name, asciiTextSource } = await importLayerImageFromFile(file, { asciiFontId: asciiImportFontId });
            addImageLayer(image, name, {
                asciiTextSource,
                asciiTextFontId: asciiTextSource ? asciiImportFontId : undefined,
            });
        } catch (error) {
            console.error('[Upload] Failed to import file:', error);
        } finally {
            e.target.value = '';
        }
    };

    const renderList = useMemo(() => {
        const list: { layer: Layer; depth: number; maskedBy: string | null }[] = [];
        const walk = (ids: string[], depth: number) => {
            const maskMap = new Map<string, string>();
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
    }, [layers, layerOrder]);

    const sortableLayerIds = useMemo(() => renderList.map(({ layer }) => layer.id), [renderList]);

    // Folder drop highlight via direct DOM manipulation (no React re-renders)
    const groupHighlightRef = useRef<string | null>(null);

    const clearGroupHighlight = useCallback(() => {
        if (groupHighlightRef.current) {
            const el = document.querySelector(`[data-layer-id="${groupHighlightRef.current}"]`);
            if (el) {
                el.classList.remove('ring-2', 'ring-emerald-500', 'ring-inset');
                (el as HTMLElement).style.backgroundColor = '';
            }
            groupHighlightRef.current = null;
        }
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        let nextGroupId: string | null = null;
        if (over && active.id !== over.id) {
            const overLayer = layers[over.id as string];
            if (overLayer?.kind === 'group') {
                nextGroupId = over.id as string;
            }
        }
        if (groupHighlightRef.current === nextGroupId) return;
        clearGroupHighlight();
        if (nextGroupId) {
            const el = document.querySelector(`[data-layer-id="${nextGroupId}"]`);
            if (el) {
                el.classList.add('ring-2', 'ring-emerald-500', 'ring-inset');
                (el as HTMLElement).style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            }
            groupHighlightRef.current = nextGroupId;
        }
    }, [layers, clearGroupHighlight]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        clearGroupHighlight();
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeId = String(active.id);
        const overId = String(over.id);
        const overLayer = layers[overId];
        if (!overLayer) return;

        if (overLayer.kind === 'group') {
            moveLayerToPosition(activeId, overId, 'into');
        } else {
            const fromIndex = sortableLayerIds.indexOf(activeId);
            const toIndex = sortableLayerIds.indexOf(overId);
            if (fromIndex === -1 || toIndex === -1) return;
            const intent: DropIntent = fromIndex < toIndex ? 'after' : 'before';
            moveLayerToPosition(activeId, overId, intent);
        }
    }, [layers, sortableLayerIds, moveLayerToPosition, clearGroupHighlight]);

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
                    accept={LAYER_UPLOAD_ACCEPT}
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
                            collisionDetection={closestCenter}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onDragCancel={clearGroupHighlight}
                        >
                            <SortableContext
                                items={sortableLayerIds}
                                strategy={verticalListSortingStrategy}
                            >
                                {renderList.map(({ layer, depth, maskedBy }) => (
                                    <LayerRow
                                        key={layer.id}
                                        layer={layer}
                                        isActive={layer.id === activeLayerId}
                                        depth={depth}
                                        maskedBy={maskedBy}
                                        onStartRename={startRename}
                                        isRenaming={renamingId === layer.id}
                                        renameValue={renamingId === layer.id ? renameValue : undefined}
                                        onRenameChange={setRenameValue}
                                        onRenameCommit={commitRename}
                                        onRenameCancel={cancelRename}
                                    />
                                ))}
                            </SortableContext>
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
                <div className="p-3 border-t border-border bg-secondary/30 grid grid-cols-5 gap-2 w-full relative z-20">
                    <Button
                        variant="outline"
                        className="h-8 w-full px-0"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Add image layer"
                        title="Add image layer"
                    >
                        <ImageIcon size={14} className="text-blue-400" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-full px-0"
                        onClick={() => addAdjustmentLayer()}
                        aria-label="Add adjustment layer"
                        title="Add adjustment layer"
                    >
                        <Sliders size={14} className="text-amber-400" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-full px-0"
                        onClick={() => addGroup()}
                        aria-label="Add group"
                        title="Add group"
                    >
                        <Folder size={14} className="text-emerald-400" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-full px-0"
                        onClick={() => addMaskLayer()}
                        aria-label="Add mask layer"
                        title="Add mask layer"
                    >
                        <CircleDashed size={14} className="text-purple-400" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-full px-0"
                        onClick={() => addSolidLayer(undefined, '#000000')}
                        aria-label="Add solid color layer"
                        title="Add solid color layer"
                    >
                        <Palette size={14} className="text-rose-400" />
                    </Button>
                </div>
            )}
        </div>
    );
};
