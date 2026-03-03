const TEXT_FILE_EXTENSIONS = new Set([
    'txt',
    'asc',
    'ascii',
    'ans',
    'nfo',
    'log',
]);

const MAX_TEXT_RENDER_DIMENSION = 4096;

export const LAYER_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,text/plain,.txt,.asc,.ascii,.ans,.nfo,.log';
export const ASCII_IMPORT_FONTS = [
    {
        id: 'sf-mono',
        label: 'SF Mono',
        family: '"SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    },
    {
        id: 'jetbrains',
        label: 'JetBrains Mono',
        family: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, "Courier New", monospace'
    },
    {
        id: 'menlo',
        label: 'Menlo',
        family: 'Menlo, Monaco, Consolas, "Courier New", monospace'
    },
    {
        id: 'consolas',
        label: 'Consolas',
        family: 'Consolas, "Liberation Mono", "Courier New", monospace'
    },
    {
        id: 'roboto-mono',
        label: 'Roboto Mono',
        family: '"Roboto Mono", "Source Code Pro", "Courier New", monospace'
    },
    {
        id: 'courier-new',
        label: 'Courier New',
        family: '"Courier New", Courier, monospace'
    },
    {
        id: 'lucida-console',
        label: 'Lucida Console',
        family: '"Lucida Console", Monaco, monospace'
    },
] as const;
export const DEFAULT_ASCII_IMPORT_FONT_ID = ASCII_IMPORT_FONTS[0].id;

const ASCII_IMPORT_FONT_BY_ID: Map<string, string> = new Map(
    ASCII_IMPORT_FONTS.map((font) => [font.id, font.family] as [string, string])
);

const getBaseName = (filename: string): string => filename.replace(/\.[^/.]+$/, '');

const getExtension = (filename: string): string => {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
};

const isTextLikeFile = (file: File): boolean => {
    return file.type.startsWith('text/') || TEXT_FILE_EXTENSIONS.has(getExtension(file.name));
};

const isImageLikeFile = (file: File): boolean => file.type.startsWith('image/');

const loadImageFromUrl = (url: string, revokeObjectUrl = false): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            if (revokeObjectUrl) URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            if (revokeObjectUrl) URL.revokeObjectURL(url);
            reject(new Error('Failed to decode uploaded file as an image.'));
        };
        image.src = url;
    });
};

const getAsciiImportFontFamily = (fontId?: string): string => {
    if (!fontId) return ASCII_IMPORT_FONTS[0].family;
    return ASCII_IMPORT_FONT_BY_ID.get(fontId) ?? ASCII_IMPORT_FONTS[0].family;
};

const renderTextToImageDataUrl = (rawText: string, fontFamily: string): string => {
    const normalized = rawText.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    const lines = normalized.split('\n').map((line) => line.length === 0 ? ' ' : line);
    const safeLines = lines.length > 0 ? lines : [' '];

    let fontSize = 16;
    let padding = 20;
    let lineHeight = Math.ceil(fontSize * 1.35);
    let width = 1;
    let height = 1;
    let font = `${fontSize}px ${fontFamily}`;

    // Keep rendered text within a GPU-friendly texture size.
    for (let attempt = 0; attempt < 6; attempt++) {
        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');
        if (!measureCtx) throw new Error('Canvas 2D context is unavailable.');

        lineHeight = Math.ceil(fontSize * 1.35);
        font = `${fontSize}px ${fontFamily}`;
        measureCtx.font = font;

        const widestLine = safeLines.reduce((max, line) => {
            return Math.max(max, measureCtx.measureText(line).width);
        }, measureCtx.measureText(' ').width);

        width = Math.max(1, Math.ceil(widestLine + padding * 2));
        height = Math.max(1, Math.ceil(safeLines.length * lineHeight + padding * 2));

        if (Math.max(width, height) <= MAX_TEXT_RENDER_DIMENSION || fontSize <= 10) {
            break;
        }

        const scale = MAX_TEXT_RENDER_DIMENSION / Math.max(width, height);
        fontSize = Math.max(10, Math.floor(fontSize * scale));
        padding = Math.max(8, Math.floor(padding * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable.');

    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e6e6e6';

    for (let i = 0; i < safeLines.length; i++) {
        ctx.fillText(safeLines[i], padding, padding + i * lineHeight);
    }

    return canvas.toDataURL('image/png');
};

export interface ImportedLayerAsset {
    image: HTMLImageElement;
    name: string;
    asciiTextSource?: string;
}

export const renderAsciiTextToImage = async (
    rawText: string,
    options?: { asciiFontId?: string; fontFamily?: string }
): Promise<HTMLImageElement> => {
    const fontFamily = options?.fontFamily ?? getAsciiImportFontFamily(options?.asciiFontId);
    const dataUrl = renderTextToImageDataUrl(rawText, fontFamily);
    return loadImageFromUrl(dataUrl);
};

export const importLayerImageFromFile = async (
    file: File,
    options?: { asciiFontId?: string }
): Promise<ImportedLayerAsset> => {
    const name = getBaseName(file.name);

    if (isTextLikeFile(file)) {
        const text = await file.text();
        if (!text.trim()) {
            throw new Error('The uploaded ASCII/text file is empty.');
        }

        const image = await renderAsciiTextToImage(text, { asciiFontId: options?.asciiFontId });
        return { image, name, asciiTextSource: text };
    }

    if (isImageLikeFile(file)) {
        const objectUrl = URL.createObjectURL(file);
        const image = await loadImageFromUrl(objectUrl, true);
        return { image, name };
    }

    throw new Error('Unsupported file type. Upload an image or plain text ASCII file.');
};
