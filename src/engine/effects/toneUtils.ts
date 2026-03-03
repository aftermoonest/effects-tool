export interface CurvePoint {
    x: number;
    y: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function parseCurvePoints(raw: number[] | undefined): CurvePoint[] {
    if (!Array.isArray(raw) || raw.length < 4 || raw.length % 2 !== 0) {
        return [
            { x: 0, y: 0 },
            { x: 255, y: 255 },
        ];
    }

    const points: CurvePoint[] = [];
    for (let i = 0; i < raw.length; i += 2) {
        points.push({
            x: clamp(Number(raw[i]), 0, 255),
            y: clamp(Number(raw[i + 1]), 0, 255),
        });
    }

    points.sort((a, b) => a.x - b.x);

    if (points[0].x !== 0) points.unshift({ x: 0, y: 0 });
    if (points[points.length - 1].x !== 255) points.push({ x: 255, y: 255 });

    return points;
}

export function flattenCurvePoints(points: CurvePoint[]): number[] {
    const out: number[] = [];
    for (const point of points) {
        out.push(Math.round(clamp(point.x, 0, 255)), Math.round(clamp(point.y, 0, 255)));
    }
    return out;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

export function buildCurveLut(rawPoints: number[] | undefined, size = 256): number[] {
    const points = parseCurvePoints(rawPoints);
    const lut = new Array(size).fill(0);

    for (let i = 0; i < size; i++) {
        const x = (i / (size - 1)) * 255;

        let idx = 0;
        while (idx < points.length - 1 && x > points[idx + 1].x) idx += 1;

        const p1 = points[Math.max(0, idx)];
        const p2 = points[Math.min(points.length - 1, idx + 1)];
        const p0 = points[Math.max(0, idx - 1)];
        const p3 = points[Math.min(points.length - 1, idx + 2)];

        const span = Math.max(p2.x - p1.x, 1e-4);
        const t = clamp((x - p1.x) / span, 0, 1);

        const y = catmullRom(p0.y, p1.y, p2.y, p3.y, t);
        lut[i] = clamp(y / 255, 0, 1);
    }

    lut[0] = clamp(points[0].y / 255, 0, 1);
    lut[size - 1] = clamp(points[points.length - 1].y / 255, 0, 1);

    return lut;
}

export interface HistogramResult {
    rgb: [number[], number[], number[]];
    luminance: number[];
}

export function buildHistogramFromRgba(rgba: Uint8Array, bins = 256): HistogramResult {
    const r = new Array(bins).fill(0);
    const g = new Array(bins).fill(0);
    const b = new Array(bins).fill(0);
    const luma = new Array(bins).fill(0);

    for (let i = 0; i < rgba.length; i += 4) {
        const rv = rgba[i];
        const gv = rgba[i + 1];
        const bv = rgba[i + 2];
        const av = rgba[i + 3] / 255;

        if (av <= 0) continue;

        const rb = Math.floor((rv / 255) * (bins - 1));
        const gb = Math.floor((gv / 255) * (bins - 1));
        const bb = Math.floor((bv / 255) * (bins - 1));
        const lv = 0.299 * rv + 0.587 * gv + 0.114 * bv;
        const lb = Math.floor((lv / 255) * (bins - 1));

        r[rb] += av;
        g[gb] += av;
        b[bb] += av;
        luma[lb] += av;
    }

    return { rgb: [r, g, b], luminance: luma };
}
