import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
    ProjectFile,
    ProjectFolder,
    SortField,
    SortDirection,
    ViewMode,
    AppView,
} from './projectTypes';
import * as db from '@/lib/projectDb';
import { serializeEditorState, deserializeEditorState } from '@/lib/projectSerializer';
import { generateThumbnail } from '@/lib/thumbnailGenerator';
import { useEditorStore } from './editorStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const generateId = () => crypto.randomUUID?.() ?? Math.random().toString(36).substr(2, 12);

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

export interface DashboardState {
    currentView: AppView;
    currentFolderId: string | null;
    projects: ProjectFile[];
    folders: ProjectFolder[];
    activeProjectId: string | null;
    hasUnsavedChanges: boolean;
    isSaving: boolean;
    isLoading: boolean;
    searchQuery: string;
    sortField: SortField;
    sortDirection: SortDirection;
    viewMode: ViewMode;
}

export interface DashboardActions {
    // Data loading
    loadDashboardData: () => Promise<void>;

    // View switching
    openDashboard: () => Promise<void>;
    openProject: (id: string) => Promise<void>;
    openNewProject: () => void;

    // Folder navigation
    navigateToFolder: (folderId: string | null) => void;

    // Project CRUD
    createProject: (name: string) => Promise<string>;
    renameProject: (id: string, name: string) => Promise<void>;
    duplicateProject: (id: string) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    moveProjectToFolder: (projectId: string, folderId: string | null) => Promise<void>;

    // Folder CRUD
    createFolder: (name: string) => Promise<string>;
    renameFolder: (id: string, name: string) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;

    // Save integration
    saveCurrentProject: () => Promise<void>;
    setHasUnsavedChanges: (val: boolean) => void;

    // UI
    setSearchQuery: (q: string) => void;
    setSortField: (field: SortField) => void;
    setSortDirection: (dir: SortDirection) => void;
    setViewMode: (mode: ViewMode) => void;
}

export type DashboardStore = DashboardState & DashboardActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDashboardStore = create<DashboardStore>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        currentView: 'dashboard',
        currentFolderId: null,
        projects: [],
        folders: [],
        activeProjectId: null,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: true,
        searchQuery: '',
        sortField: 'updatedAt',
        sortDirection: 'desc',
        viewMode: 'grid',

        // ── Data loading ──

        loadDashboardData: async () => {
            set({ isLoading: true });
            try {
                const [projects, folders] = await Promise.all([
                    db.getAllProjects(),
                    db.getAllFolders(),
                ]);
                set({ projects, folders, isLoading: false });
            } catch (e) {
                console.error('[Dashboard] Failed to load data:', e);
                set({ isLoading: false });
            }
        },

        // ── View switching ──

        openDashboard: async () => {
            const { saveCurrentProject, activeProjectId } = get();
            // Always save before switching to dashboard (ensures fresh thumbnail)
            if (activeProjectId) {
                await saveCurrentProject();
            }
            // Reload dashboard data to get fresh thumbnails
            const [projects, folders] = await Promise.all([
                db.getAllProjects(),
                db.getAllFolders(),
            ]);
            set({
                currentView: 'dashboard',
                activeProjectId: null,
                hasUnsavedChanges: false,
                projects,
                folders,
            });
        },

        openProject: async (id) => {
            set({ isLoading: true });
            try {
                const data = await db.getProjectData(id);
                if (!data) {
                    console.error('[Dashboard] No project data found for', id);
                    set({ isLoading: false });
                    return;
                }
                const editorState = await deserializeEditorState(data);
                useEditorStore.getState().loadProject(editorState);
                set({
                    currentView: 'editor',
                    activeProjectId: id,
                    hasUnsavedChanges: false,
                    isLoading: false,
                });
            } catch (e) {
                console.error('[Dashboard] Failed to open project:', e);
                set({ isLoading: false });
            }
        },

        openNewProject: () => {
            // Reset editor to defaults
            useEditorStore.getState().resetEditor();
            const id = generateId();
            const now = Date.now();
            const { canvasWidth, canvasHeight } = useEditorStore.getState();

            const project: ProjectFile = {
                id,
                name: 'Untitled Project',
                folderId: get().currentFolderId,
                createdAt: now,
                updatedAt: now,
                thumbnail: null,
                canvasWidth,
                canvasHeight,
            };

            // Save immediately with empty state
            db.putProject(project).then(() => {
                const editorState = useEditorStore.getState();
                return db.putProjectData(id, serializeEditorState(editorState));
            });

            set({
                currentView: 'editor',
                activeProjectId: id,
                hasUnsavedChanges: false,
                projects: [...get().projects, project],
            });
        },

        // ── Folder navigation ──

        navigateToFolder: (folderId) => {
            set({ currentFolderId: folderId, searchQuery: '' });
        },

        // ── Project CRUD ──

        createProject: async (name) => {
            const id = generateId();
            const now = Date.now();
            const { canvasWidth, canvasHeight } = useEditorStore.getState();
            const project: ProjectFile = {
                id,
                name,
                folderId: get().currentFolderId,
                createdAt: now,
                updatedAt: now,
                thumbnail: null,
                canvasWidth,
                canvasHeight,
            };
            await db.putProject(project);
            set({ projects: [...get().projects, project] });
            return id;
        },

        renameProject: async (id, name) => {
            const projects = get().projects.map((p) =>
                p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
            );
            set({ projects });
            const project = projects.find((p) => p.id === id);
            if (project) await db.putProject(project);
        },

        duplicateProject: async (id) => {
            const original = get().projects.find((p) => p.id === id);
            if (!original) return;

            const newId = generateId();
            const now = Date.now();
            const newProject: ProjectFile = {
                ...original,
                id: newId,
                name: `${original.name} (Copy)`,
                createdAt: now,
                updatedAt: now,
            };

            await db.putProject(newProject);

            // Copy project data too
            const data = await db.getProjectData(id);
            if (data) await db.putProjectData(newId, data);

            set({ projects: [...get().projects, newProject] });
        },

        deleteProject: async (id) => {
            await db.deleteProject(id);
            set({ projects: get().projects.filter((p) => p.id !== id) });
        },

        moveProjectToFolder: async (projectId, folderId) => {
            const projects = get().projects.map((p) =>
                p.id === projectId ? { ...p, folderId, updatedAt: Date.now() } : p,
            );
            set({ projects });
            const project = projects.find((p) => p.id === projectId);
            if (project) await db.putProject(project);
        },

        // ── Folder CRUD ──

        createFolder: async (name) => {
            const id = generateId();
            const now = Date.now();
            const folder: ProjectFolder = {
                id,
                name,
                parentId: get().currentFolderId,
                createdAt: now,
                updatedAt: now,
            };
            await db.putFolder(folder);
            set({ folders: [...get().folders, folder] });
            return id;
        },

        renameFolder: async (id, name) => {
            const folders = get().folders.map((f) =>
                f.id === id ? { ...f, name, updatedAt: Date.now() } : f,
            );
            set({ folders });
            const folder = folders.find((f) => f.id === id);
            if (folder) await db.putFolder(folder);
        },

        deleteFolder: async (id) => {
            await db.deleteFolder(id);
            // Refresh both to reflect cascade
            const [projects, folders] = await Promise.all([
                db.getAllProjects(),
                db.getAllFolders(),
            ]);
            set({ projects, folders });
        },

        // ── Save ──

        saveCurrentProject: async () => {
            const { activeProjectId, isSaving } = get();
            if (!activeProjectId || isSaving) return;

            set({ isSaving: true });
            try {
                const editorState = useEditorStore.getState();
                const serialized = serializeEditorState(editorState);
                const thumbnail = await generateThumbnail();

                await db.putProjectData(activeProjectId, serialized);

                // Update project metadata
                const project = get().projects.find((p) => p.id === activeProjectId);
                if (project) {
                    const updated: ProjectFile = {
                        ...project,
                        updatedAt: Date.now(),
                        thumbnail,
                        canvasWidth: editorState.canvasWidth,
                        canvasHeight: editorState.canvasHeight,
                    };
                    await db.putProject(updated);
                    set({
                        projects: get().projects.map((p) => (p.id === activeProjectId ? updated : p)),
                    });
                }

                set({ hasUnsavedChanges: false, isSaving: false });
            } catch (e) {
                console.error('[Dashboard] Save failed:', e);
                set({ isSaving: false });
            }
        },

        setHasUnsavedChanges: (val) => set({ hasUnsavedChanges: val }),

        // ── UI ──

        setSearchQuery: (q) => set({ searchQuery: q }),
        setSortField: (field) => set({ sortField: field }),
        setSortDirection: (dir) => set({ sortDirection: dir }),
        setViewMode: (mode) => set({ viewMode: mode }),
    })),
);
