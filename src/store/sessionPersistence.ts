import type { PersistStorage, StorageValue } from 'zustand/middleware';
import type { Layer } from './editorStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SerializedLayer = Omit<Layer, 'sourceImage'> & {
    _sourceImageBase64?: string;
};

export interface PersistedEditorState {
    layers: Record<string, Layer>;
    layerOrder: string[];
    activeLayerId: string | null;
    activeEffectId: string | null;
    canvasWidth: number;
    canvasHeight: number;
    canvasBgColor: string;
    canvasTransparent: boolean;
    asciiImportFontId: string;
    zoom: number;
    panX: number;
    panY: number;
}

// ---------------------------------------------------------------------------
// Image <-> Base64 helpers
// ---------------------------------------------------------------------------

function imageToBase64(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    try {
        return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
        // CORS-tainted canvas — skip this image
        return '';
    }
}

function base64ToImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// ---------------------------------------------------------------------------
// Layer serialization
// ---------------------------------------------------------------------------

function serializeLayers(
    layers: Record<string, Layer>,
): Record<string, SerializedLayer> {
    const out: Record<string, SerializedLayer> = {};
    for (const [id, layer] of Object.entries(layers)) {
        const { sourceImage, ...rest } = layer;
        const serialized: SerializedLayer = { ...rest };
        if (sourceImage) {
            const b64 = imageToBase64(sourceImage);
            if (b64) serialized._sourceImageBase64 = b64;
        }
        out[id] = serialized;
    }
    return out;
}

async function deserializeLayers(
    layers: Record<string, SerializedLayer>,
): Promise<Record<string, Layer>> {
    const entries = Object.entries(layers);
    const results = await Promise.all(
        entries.map(async ([id, serialized]) => {
            const { _sourceImageBase64, ...rest } = serialized;
            const layer = rest as Layer;
            if (_sourceImageBase64) {
                try {
                    layer.sourceImage = await base64ToImage(_sourceImageBase64);
                } catch {
                    console.warn(`[Persist] Failed to restore image for layer "${layer.name}"`);
                }
            }
            return [id, layer] as const;
        }),
    );
    return Object.fromEntries(results);
}

// ---------------------------------------------------------------------------
// Custom sessionStorage adapter
// ---------------------------------------------------------------------------

export const editorSessionStorage: PersistStorage<PersistedEditorState> = {
    getItem: async (name) => {
        const raw = sessionStorage.getItem(name);
        if (!raw) return null;
        try {
            const parsed: StorageValue<PersistedEditorState> = JSON.parse(raw);
            if (parsed.state?.layers) {
                parsed.state.layers = await deserializeLayers(
                    parsed.state.layers as unknown as Record<string, SerializedLayer>,
                );
            }
            return parsed;
        } catch (e) {
            console.warn('[Persist] Rehydration failed:', e);
            return null;
        }
    },

    setItem: (name, value) => {
        const serialized: StorageValue<PersistedEditorState> = {
            ...value,
            state: {
                ...value.state,
                layers: serializeLayers(value.state.layers) as unknown as Record<string, Layer>,
            },
        };
        try {
            sessionStorage.setItem(name, JSON.stringify(serialized));
        } catch (e) {
            console.warn('[Persist] sessionStorage write failed:', e);
        }
    },

    removeItem: (name) => {
        sessionStorage.removeItem(name);
    },
};
