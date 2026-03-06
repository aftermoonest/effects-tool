import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { ProjectFile, ProjectFolder } from '@/store/projectTypes';
import type { SerializedEditorState } from '@/lib/projectSerializer';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface ProjectDbSchema extends DBSchema {
    projects: {
        key: string;
        value: ProjectFile;
        indexes: {
            'by-folder': string;
            'by-updatedAt': number;
            'by-name': string;
        };
    };
    folders: {
        key: string;
        value: ProjectFolder;
        indexes: {
            'by-parent': string;
            'by-name': string;
        };
    };
    projectData: {
        key: string;
        value: { id: string; state: SerializedEditorState };
    };
}

const DB_NAME = 'effects-tool-projects';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ProjectDbSchema>> | null = null;

export const getDb = () => {
    if (!dbPromise) {
        dbPromise = openDB<ProjectDbSchema>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
                projectStore.createIndex('by-folder', 'folderId');
                projectStore.createIndex('by-updatedAt', 'updatedAt');
                projectStore.createIndex('by-name', 'name');

                const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
                folderStore.createIndex('by-parent', 'parentId');
                folderStore.createIndex('by-name', 'name');

                db.createObjectStore('projectData', { keyPath: 'id' });
            },
        });
    }
    return dbPromise;
};

// ---------------------------------------------------------------------------
// Projects CRUD
// ---------------------------------------------------------------------------

export const getAllProjects = async (): Promise<ProjectFile[]> => {
    const db = await getDb();
    return db.getAll('projects');
};

export const getProject = async (id: string): Promise<ProjectFile | undefined> => {
    const db = await getDb();
    return db.get('projects', id);
};

export const putProject = async (project: ProjectFile): Promise<void> => {
    const db = await getDb();
    await db.put('projects', project);
};

export const deleteProject = async (id: string): Promise<void> => {
    const db = await getDb();
    const tx = db.transaction(['projects', 'projectData'], 'readwrite');
    await tx.objectStore('projects').delete(id);
    await tx.objectStore('projectData').delete(id);
    await tx.done;
};

// ---------------------------------------------------------------------------
// Project Data (heavy payload)
// ---------------------------------------------------------------------------

export const getProjectData = async (id: string): Promise<SerializedEditorState | undefined> => {
    const db = await getDb();
    const row = await db.get('projectData', id);
    return row?.state;
};

export const putProjectData = async (id: string, state: SerializedEditorState): Promise<void> => {
    const db = await getDb();
    await db.put('projectData', { id, state });
};

// ---------------------------------------------------------------------------
// Folders CRUD
// ---------------------------------------------------------------------------

export const getAllFolders = async (): Promise<ProjectFolder[]> => {
    const db = await getDb();
    return db.getAll('folders');
};

export const putFolder = async (folder: ProjectFolder): Promise<void> => {
    const db = await getDb();
    await db.put('folders', folder);
};

export const deleteFolder = async (id: string): Promise<void> => {
    const db = await getDb();
    const tx = db.transaction(['folders', 'projects'], 'readwrite');
    const projectStore = tx.objectStore('projects');
    const folderStore = tx.objectStore('folders');

    // Move contained projects to root
    const projects = await projectStore.index('by-folder').getAll(id);
    for (const p of projects) {
        p.folderId = null;
        await projectStore.put(p);
    }

    // Recursively delete sub-folders (move their projects to root too)
    const subFolders = await folderStore.index('by-parent').getAll(id);
    for (const sf of subFolders) {
        const sfProjects = await projectStore.index('by-folder').getAll(sf.id);
        for (const sp of sfProjects) {
            sp.folderId = null;
            await projectStore.put(sp);
        }
        await folderStore.delete(sf.id);
    }

    await folderStore.delete(id);
    await tx.done;
};
