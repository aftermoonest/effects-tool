import { FileImage, FolderPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
    hasSearch: boolean;
    onNewProject: () => void;
    onNewFolder: () => void;
}

export function EmptyState({ hasSearch, onNewProject, onNewFolder }: EmptyStateProps) {
    if (hasSearch) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                <FileImage size={32} className="opacity-30" />
                <span className="text-xs font-mono uppercase tracking-wider">No results found</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
            <FileImage size={40} className="text-muted-foreground/20" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">No projects yet</span>
            <div className="flex gap-2">
                <Button size="sm" onClick={onNewProject}>
                    <Plus size={14} className="mr-1.5" />
                    New Project
                </Button>
                <Button size="sm" variant="outline" onClick={onNewFolder}>
                    <FolderPlus size={14} className="mr-1.5" />
                    New Folder
                </Button>
            </div>
        </div>
    );
}
