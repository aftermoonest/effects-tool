import { useState, useRef, useEffect } from 'react';
import { Folder, MoreHorizontal } from 'lucide-react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDashboardStore } from '@/store/dashboardStore';
import type { ProjectFolder } from '@/store/projectTypes';

interface FolderCardProps {
    folder: ProjectFolder;
    itemCount: number;
    viewMode: 'grid' | 'list';
}

export function FolderCard({ folder, itemCount, viewMode }: FolderCardProps) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(folder.name);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const navigateToFolder = useDashboardStore((s) => s.navigateToFolder);
    const renameFolder = useDashboardStore((s) => s.renameFolder);
    const deleteFolder = useDashboardStore((s) => s.deleteFolder);

    useEffect(() => {
        if (isRenaming) renameInputRef.current?.select();
    }, [isRenaming]);

    const handleRename = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== folder.name) {
            renameFolder(folder.id, trimmed);
        }
        setIsRenaming(false);
    };

    const handleDoubleClick = () => {
        navigateToFolder(folder.id);
    };

    const menuItems = (
        <>
            <ContextMenuItem onClick={() => { setRenameValue(folder.name); setIsRenaming(true); }}>
                Rename
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteFolder(folder.id)}
            >
                Delete
            </ContextMenuItem>
        </>
    );

    if (viewMode === 'list') {
        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors cursor-pointer group"
                        onDoubleClick={handleDoubleClick}
                    >
                        <Folder size={16} className="text-primary shrink-0" />
                        {isRenaming ? (
                            <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                                className="bg-transparent border border-primary/50 px-1.5 py-0.5 text-xs font-mono outline-none flex-1"
                                autoFocus
                            />
                        ) : (
                            <span className="text-xs font-mono uppercase tracking-wider flex-1 truncate">{folder.name}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono">{itemCount} items</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-foreground text-muted-foreground">
                                    <MoreHorizontal size={14} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs font-mono uppercase tracking-wider">
                                <DropdownMenuItem onClick={() => { setRenameValue(folder.name); setIsRenaming(true); }}>Rename</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteFolder(folder.id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="text-xs font-mono uppercase tracking-wider">
                    {menuItems}
                </ContextMenuContent>
            </ContextMenu>
        );
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className="border border-border hover:border-primary/50 bg-card p-4 flex flex-col gap-2 cursor-pointer transition-colors group"
                    onDoubleClick={handleDoubleClick}
                >
                    <div className="flex items-center gap-2">
                        <Folder size={18} className="text-primary shrink-0" />
                        {isRenaming ? (
                            <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                                className="bg-transparent border border-primary/50 px-1.5 py-0.5 text-xs font-mono outline-none flex-1 min-w-0"
                                autoFocus
                            />
                        ) : (
                            <span className="text-xs font-mono uppercase tracking-wider truncate flex-1">{folder.name}</span>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-foreground text-muted-foreground">
                                    <MoreHorizontal size={14} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs font-mono uppercase tracking-wider">
                                <DropdownMenuItem onClick={() => { setRenameValue(folder.name); setIsRenaming(true); }}>Rename</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteFolder(folder.id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{itemCount} items</span>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="text-xs font-mono uppercase tracking-wider">
                {menuItems}
            </ContextMenuContent>
        </ContextMenu>
    );
}
