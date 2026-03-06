import { ChevronRight } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import type { ProjectFolder } from '@/store/projectTypes';
import { useMemo } from 'react';

export function BreadcrumbBar() {
    const currentFolderId = useDashboardStore((s) => s.currentFolderId);
    const folders = useDashboardStore((s) => s.folders);
    const navigateToFolder = useDashboardStore((s) => s.navigateToFolder);

    const breadcrumbs = useMemo(() => {
        if (!currentFolderId) return [];
        const path: ProjectFolder[] = [];
        let folderId: string | null = currentFolderId;
        while (folderId) {
            const folder = folders.find((f) => f.id === folderId);
            if (!folder) break;
            path.unshift(folder);
            folderId = folder.parentId;
        }
        return path;
    }, [currentFolderId, folders]);

    return (
        <div className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider px-6 py-2 border-b border-border bg-card/50">
            <button
                onClick={() => navigateToFolder(null)}
                className={`hover:text-primary transition-colors ${!currentFolderId ? 'text-foreground' : 'text-muted-foreground'}`}
            >
                All Projects
            </button>
            {breadcrumbs.map((folder) => (
                <span key={folder.id} className="flex items-center gap-1">
                    <ChevronRight size={12} className="text-muted-foreground/50" />
                    <button
                        onClick={() => navigateToFolder(folder.id)}
                        className={`hover:text-primary transition-colors ${folder.id === currentFolderId ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                        {folder.name}
                    </button>
                </span>
            ))}
        </div>
    );
}
