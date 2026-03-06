// ---------------------------------------------------------------------------
// Project & Folder types for the dashboard/persistence system
// ---------------------------------------------------------------------------

export interface ProjectFile {
    id: string;
    name: string;
    folderId: string | null;       // null = root level
    createdAt: number;             // Date.now()
    updatedAt: number;
    thumbnail: Blob | null;        // JPEG blob from canvas
    canvasWidth: number;
    canvasHeight: number;
}

export interface ProjectFolder {
    id: string;
    name: string;
    parentId: string | null;       // null = root level (supports nesting)
    createdAt: number;
    updatedAt: number;
}

export type SortField = 'name' | 'updatedAt' | 'createdAt';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list';
export type AppView = 'dashboard' | 'editor';
