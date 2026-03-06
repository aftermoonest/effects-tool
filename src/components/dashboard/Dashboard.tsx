import { useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { DashboardHeader } from './DashboardHeader';
import { BreadcrumbBar } from './BreadcrumbBar';
import { FolderCard } from './FolderCard';
import { ProjectCard } from './ProjectCard';
import { EmptyState } from './EmptyState';
import type { ProjectFile, ProjectFolder, SortField, SortDirection } from '@/store/projectTypes';

function sortItems<T extends { name: string; updatedAt: number; createdAt: number }>(
    items: T[],
    field: SortField,
    direction: SortDirection,
): T[] {
    return [...items].sort((a, b) => {
        let cmp = 0;
        if (field === 'name') {
            cmp = a.name.localeCompare(b.name);
        } else {
            cmp = a[field] - b[field];
        }
        return direction === 'asc' ? cmp : -cmp;
    });
}

export function Dashboard() {
    const projects = useDashboardStore((s) => s.projects);
    const folders = useDashboardStore((s) => s.folders);
    const currentFolderId = useDashboardStore((s) => s.currentFolderId);
    const searchQuery = useDashboardStore((s) => s.searchQuery);
    const sortField = useDashboardStore((s) => s.sortField);
    const sortDirection = useDashboardStore((s) => s.sortDirection);
    const viewMode = useDashboardStore((s) => s.viewMode);
    const isLoading = useDashboardStore((s) => s.isLoading);
    const openNewProject = useDashboardStore((s) => s.openNewProject);
    const createFolder = useDashboardStore((s) => s.createFolder);

    const handleNewFolder = () => {
        createFolder('New Folder');
    };

    // Filter and sort
    const { visibleFolders, visibleProjects, recentProjects } = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        let filteredFolders: ProjectFolder[];
        let filteredProjects: ProjectFile[];

        if (query) {
            // Search across all folders/projects
            filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(query));
            filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(query));
        } else {
            // Show items in current folder
            filteredFolders = folders.filter((f) => f.parentId === currentFolderId);
            filteredProjects = projects.filter((p) => p.folderId === currentFolderId);
        }

        const sortedFolders = sortItems(filteredFolders, sortField, sortDirection);
        const sortedProjects = sortItems(filteredProjects, sortField, sortDirection);

        // Recent projects (only at root, no search)
        const recent = !query && !currentFolderId
            ? [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)
            : [];

        return {
            visibleFolders: sortedFolders,
            visibleProjects: sortedProjects,
            recentProjects: recent,
        };
    }, [projects, folders, currentFolderId, searchQuery, sortField, sortDirection]);

    const folderItemCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const f of folders) {
            counts[f.id] = projects.filter((p) => p.folderId === f.id).length;
        }
        return counts;
    }, [folders, projects]);

    const hasContent = visibleFolders.length > 0 || visibleProjects.length > 0;

    return (
        <div className="w-screen h-screen flex flex-col overflow-hidden bg-background text-foreground">
            <DashboardHeader onNewProject={openNewProject} onNewFolder={handleNewFolder} />
            <BreadcrumbBar />

            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider animate-pulse">Loading...</span>
                    </div>
                ) : !hasContent ? (
                    <EmptyState
                        hasSearch={!!searchQuery}
                        onNewProject={openNewProject}
                        onNewFolder={handleNewFolder}
                    />
                ) : (
                    <div className="p-6 flex flex-col gap-6">
                        {/* Recent section */}
                        {recentProjects.length > 0 && (
                            <section>
                                <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Recent</h2>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {recentProjects.map((project) => (
                                        <div key={project.id} className="w-56 shrink-0">
                                            <ProjectCard project={project} folders={folders} viewMode="grid" />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Folders */}
                        {visibleFolders.length > 0 && (
                            <section>
                                <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Folders</h2>
                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                                        {visibleFolders.map((folder) => (
                                            <FolderCard key={folder.id} folder={folder} itemCount={folderItemCounts[folder.id] ?? 0} viewMode={viewMode} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col border border-border divide-y divide-border">
                                        {visibleFolders.map((folder) => (
                                            <FolderCard key={folder.id} folder={folder} itemCount={folderItemCounts[folder.id] ?? 0} viewMode={viewMode} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Projects */}
                        {visibleProjects.length > 0 && (
                            <section>
                                <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Projects</h2>
                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                                        {visibleProjects.map((project) => (
                                            <ProjectCard key={project.id} project={project} folders={folders} viewMode={viewMode} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col border border-border divide-y divide-border">
                                        {visibleProjects.map((project) => (
                                            <ProjectCard key={project.id} project={project} folders={folders} viewMode={viewMode} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
