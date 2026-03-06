import { Search, Plus, FolderPlus, LayoutGrid, List, ArrowDownAZ, ArrowDownWideNarrow, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDashboardStore } from '@/store/dashboardStore';
import type { SortField } from '@/store/projectTypes';

interface DashboardHeaderProps {
    onNewProject: () => void;
    onNewFolder: () => void;
}

const SORT_OPTIONS: { field: SortField; label: string; icon: React.ReactNode }[] = [
    { field: 'name', label: 'Name', icon: <ArrowDownAZ size={12} /> },
    { field: 'updatedAt', label: 'Modified', icon: <Clock size={12} /> },
    { field: 'createdAt', label: 'Created', icon: <ArrowDownWideNarrow size={12} /> },
];

export function DashboardHeader({ onNewProject, onNewFolder }: DashboardHeaderProps) {
    const searchQuery = useDashboardStore((s) => s.searchQuery);
    const setSearchQuery = useDashboardStore((s) => s.setSearchQuery);
    const sortField = useDashboardStore((s) => s.sortField);
    const sortDirection = useDashboardStore((s) => s.sortDirection);
    const setSortField = useDashboardStore((s) => s.setSortField);
    const setSortDirection = useDashboardStore((s) => s.setSortDirection);
    const viewMode = useDashboardStore((s) => s.viewMode);
    const setViewMode = useDashboardStore((s) => s.setViewMode);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection(field === 'name' ? 'asc' : 'desc');
        }
    };

    return (
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0 uppercase tracking-widest text-xs font-bold">
            <div className="flex items-center gap-4">
                <span className="text-primary font-mono text-lg leading-none">AF / Effects</span>
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 flex-1 max-w-64 mx-4">
                <div className="flex items-center gap-2 flex-1 border border-border bg-background px-2.5 h-7 focus-within:border-primary/50 transition-colors">
                    <Search size={12} className="text-muted-foreground shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search projects..."
                        className="bg-transparent text-xs font-mono outline-none flex-1 placeholder:text-muted-foreground/50 normal-case tracking-normal"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {/* View mode toggle */}
                <div className="flex border border-border">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <LayoutGrid size={14} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <List size={14} />
                    </button>
                </div>

                {/* Sort dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                            {SORT_OPTIONS.find((o) => o.field === sortField)?.icon}
                            {SORT_OPTIONS.find((o) => o.field === sortField)?.label}
                            <span className="text-[10px] opacity-60">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs font-mono uppercase tracking-wider">
                        {SORT_OPTIONS.map((opt) => (
                            <DropdownMenuItem key={opt.field} onClick={() => toggleSort(opt.field)} className="gap-2">
                                {opt.icon} {opt.label}
                                {sortField === opt.field && <span className="ml-auto opacity-60">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-4 bg-border" />

                {/* Actions */}
                <Button size="sm" variant="outline" onClick={onNewFolder} title="New Folder">
                    <FolderPlus size={14} />
                </Button>
                <Button size="sm" onClick={onNewProject}>
                    <Plus size={14} className="mr-1" />
                    New
                </Button>
            </div>
        </header>
    );
}
