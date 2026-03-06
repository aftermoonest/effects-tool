import type { Layer, EditorState } from '@/store/editorStore';

// ---------------------------------------------------------------------------
// Serialized types (storable in IndexedDB)
// ---------------------------------------------------------------------------

type SerializedLayer = Omit<Layer, 'sourceImage'> & {
    _sourceImageBase64?: string;
};

export interface SerializedEditorState {
    layers: Record<string, SerializedLayer>;
    layerOrder: string[];
    activeLayerId: string | null;
    activeEffectId: string | null;
    canvasWidth: number;
    canvasHeight: number;
    canvasBgColor: string;
    canvasTransparent: boolean;
    asciiImportFontId: string;
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
// Serialize: EditorState -> SerializedEditorState
// ---------------------------------------------------------------------------

export function serializeEditorState(state: EditorState): SerializedEditorState {
    const serializedLayers: Record<string, SerializedLayer> = {};

    for (const [id, layer] of Object.entries(state.layers)) {
        const { sourceImage, ...rest } = layer;
        const serialized: SerializedLayer = { ...rest };
        if (sourceImage) {
            const b64 = imageToBase64(sourceImage);
            if (b64) serialized._sourceImageBase64 = b64;
        }
        serializedLayers[id] = serialized;
    }

    return {
        layers: serializedLayers,
        layerOrder: state.layerOrder,
        activeLayerId: state.activeLayerId,
        activeEffectId: state.activeEffectId,
        canvasWidth: state.canvasWidth,
        canvasHeight: state.canvasHeight,
        canvasBgColor: state.canvasBgColor,
        canvasTransparent: state.canvasTransparent,
        asciiImportFontId: state.asciiImportFontId,
    };
}

// ---------------------------------------------------------------------------
// Deserialize: SerializedEditorState -> partial EditorState
// ---------------------------------------------------------------------------

export type DeserializedEditorState = Pick<
    EditorState,
    | 'layers' | 'layerOrder' | 'activeLayerId' | 'activeEffectId'
    | 'canvasWidth' | 'canvasHeight' | 'canvasBgColor' | 'canvasTransparent'
    | 'asciiImportFontId'
>;

export async function deserializeEditorState(
    data: SerializedEditorState,
): Promise<DeserializedEditorState> {
    const layers: Record<string, Layer> = {};

    await Promise.all(
        Object.entries(data.layers).map(async ([id, serialized]) => {
            const { _sourceImageBase64, ...rest } = serialized;
            const layer = rest as Layer;
            if (_sourceImageBase64) {
                try {
                    layer.sourceImage = await base64ToImage(_sourceImageBase64);
                } catch {
                    console.warn(`[ProjectSerializer] Failed to restore image for layer "${layer.name}"`);
                }
            }
            layers[id] = layer;
        }),
    );

    return {
        layers,
        layerOrder: data.layerOrder,
        activeLayerId: data.activeLayerId,
        activeEffectId: data.activeEffectId,
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
        canvasBgColor: data.canvasBgColor,
        canvasTransparent: data.canvasTransparent,
        asciiImportFontId: data.asciiImportFontId,
    };
}
