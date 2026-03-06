import { useState, useRef, useEffect, useMemo } from 'react';
import { FileImage, MoreHorizontal, Copy, Trash2, FolderInput } from 'lucide-react';
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
import type { ProjectFile, ProjectFolder } from '@/store/projectTypes';

interface ProjectCardProps {
    project: ProjectFile;
    folders: ProjectFolder[];
    viewMode: 'grid' | 'list';
}

function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

export function ProjectCard({ project, folders, viewMode }: ProjectCardProps) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(project.name);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const openProject = useDashboardStore((s) => s.openProject);
    const renameProject = useDashboardStore((s) => s.renameProject);
    const duplicateProject = useDashboardStore((s) => s.duplicateProject);
    const deleteProject = useDashboardStore((s) => s.deleteProject);
    const moveProjectToFolder = useDashboardStore((s) => s.moveProjectToFolder);

    const thumbnailUrl = useMemo(() => {
        if (!project.thumbnail) return null;
        return URL.createObjectURL(project.thumbnail);
    }, [project.thumbnail]);

    useEffect(() => {
        return () => { if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl); };
    }, [thumbnailUrl]);

    useEffect(() => {
        if (isRenaming) renameInputRef.current?.select();
    }, [isRenaming]);

    const handleRename = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== project.name) {
            renameProject(project.id, trimmed);
        }
        setIsRenaming(false);
    };

    const handleDoubleClick = () => {
        openProject(project.id);
    };

    const moveTargets = folders.filter((f) => f.id !== project.folderId);

    const menuItems = (
        <>
            <ContextMenuItem onClick={() => openProject(project.id)}>Open</ContextMenuItem>
            <ContextMenuItem onClick={() => { setRenameValue(project.name); setIsRenaming(true); }}>
                Rename
            </ContextMenuItem>
            <ContextMenuItem onClick={() => duplicateProject(project.id)}>
                <Copy size={12} className="mr-2" /> Duplicate
            </ContextMenuItem>
            {moveTargets.length > 0 && (
                <>
                    <ContextMenuSeparator />
                    {moveTargets.map((f) => (
                        <ContextMenuItem key={f.id} onClick={() => moveProjectToFolder(project.id, f.id)}>
                            <FolderInput size={12} className="mr-2" /> Move to {f.name}
                        </ContextMenuItem>
                    ))}
                    {project.folderId && (
                        <ContextMenuItem onClick={() => moveProjectToFolder(project.id, null)}>
                            <FolderInput size={12} className="mr-2" /> Move to Root
                        </ContextMenuItem>
                    )}
                </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteProject(project.id)}
            >
                <Trash2 size={12} className="mr-2" /> Delete
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
                        {thumbnailUrl ? (
                            <img src={thumbnailUrl} alt="" className="w-10 h-7 object-cover border border-border shrink-0" />
                        ) : (
                            <div className="w-10 h-7 bg-secondary/30 border border-border flex items-center justify-center shrink-0">
                                <FileImage size={12} className="text-muted-foreground" />
                            </div>
                        )}
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
                            <span className="text-xs font-mono uppercase tracking-wider flex-1 truncate">{project.name}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{project.canvasWidth}x{project.canvasHeight}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{formatRelativeTime(project.updatedAt)}</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-foreground text-muted-foreground">
                                    <MoreHorizontal size={14} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs font-mono uppercase tracking-wider">
                                <DropdownMenuItem onClick={() => openProject(project.id)}>Open</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRenameValue(project.name); setIsRenaming(true); }}>Rename</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicateProject(project.id)}>Duplicate</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteProject(project.id)}>Delete</DropdownMenuItem>
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
                    className="border border-border hover:border-primary/50 bg-card cursor-pointer transition-colors group flex flex-col"
                    onDoubleClick={handleDoubleClick}
                >
                    {/* Thumbnail */}
                    <div className="aspect-[4/3] bg-secondary/20 flex items-center justify-center overflow-hidden relative">
                        {thumbnailUrl ? (
                            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <FileImage size={24} className="text-muted-foreground/30" />
                        )}
                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="p-1 bg-card/80 backdrop-blur-sm border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground">
                                        <MoreHorizontal size={12} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs font-mono uppercase tracking-wider">
                                    <DropdownMenuItem onClick={() => openProject(project.id)}>Open</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setRenameValue(project.name); setIsRenaming(true); }}>Rename</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => duplicateProject(project.id)}>Duplicate</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteProject(project.id)}>Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    {/* Info */}
                    <div className="p-3 flex flex-col gap-1">
                        {isRenaming ? (
                            <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                                className="bg-transparent border border-primary/50 px-1.5 py-0.5 text-xs font-mono outline-none"
                                autoFocus
                            />
                        ) : (
                            <span className="text-xs font-mono uppercase tracking-wider truncate">{project.name}</span>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                            <span>{project.canvasWidth}x{project.canvasHeight}</span>
                            <span>&middot;</span>
                            <span>{formatRelativeTime(project.updatedAt)}</span>
                        </div>
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="text-xs font-mono uppercase tracking-wider">
                {menuItems}
            </ContextMenuContent>
        </ContextMenu>
    );
}
