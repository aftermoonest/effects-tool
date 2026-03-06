const THUMB_MAX_W = 400;
const THUMB_MAX_H = 300;

export function generateThumbnail(): Promise<Blob | null> {
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
    if (!canvas || canvas.width <= 1 || canvas.height <= 1) return Promise.resolve(null);

    const scale = Math.min(THUMB_MAX_W / canvas.width, THUMB_MAX_H / canvas.height, 1);
    const thumbW = Math.round(canvas.width * scale);
    const thumbH = Math.round(canvas.height * scale);

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const ctx = thumbCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, thumbW, thumbH);

    return new Promise((resolve) => {
        thumbCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    });
}
