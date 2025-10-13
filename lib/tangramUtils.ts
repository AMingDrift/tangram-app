// 工具函数抽取自原始 TangramCanvas.tsx

export interface Piece {
    id: number;
    points: number[]; // local points
    color: string;
    x: number;
    y: number;
    rotation: number;
    placed?: boolean;
    centerX?: number;
    centerY?: number;
}

export const GRID_CELL = 100;

export const alignCenter = (allPoints: number[], size: { width: number; height: number }) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < allPoints.length; i += 2) {
        const x = allPoints[i];
        const y = allPoints[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const canvasCenterX = size.width / 2;
    const canvasCenterY = size.height / 2;

    const offsetX = canvasCenterX - centerX;
    const offsetY = canvasCenterY - centerY;
    return [offsetX, offsetY];
};

export const distance = (x1: number, y1: number, x2: number, y2: number) =>
    Math.hypot(x1 - x2, y1 - y2);

export const getTransformedPoints = (p: Piece) => {
    const angle = ((p.rotation || 0) * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cx = p.centerX ?? 0;
    const cy = p.centerY ?? 0;
    const out: number[] = [];
    for (let i = 0; i < p.points.length; i += 2) {
        const lx = p.points[i];
        const ly = p.points[i + 1];
        const rx = (lx - cx) * cosA - (ly - cy) * sinA + p.x;
        const ry = (lx - cx) * sinA + (ly - cy) * cosA + p.y;
        out.push(rx, ry);
    }
    return out;
};

export interface Edge {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    length: number;
    angle: number; // degrees
    midx: number;
    midy: number;
}

export const getEdgesFromPoints = (pts: number[]) => {
    const edges: Edge[] = [];
    for (let i = 0; i < pts.length; i += 2) {
        const ax = pts[i];
        const ay = pts[i + 1];
        const bx = pts[(i + 2) % pts.length];
        const by = pts[(i + 3) % pts.length];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        edges.push({
            ax,
            ay,
            bx,
            by,
            length: len,
            angle,
            midx: (ax + bx) / 2,
            midy: (ay + by) / 2,
        });
    }
    return edges;
};

export const angleDiff = (a: number, b: number) => {
    let d = Math.abs(((a - b) % 360) + 360) % 360;
    if (d > 180) d = 360 - d;
    return d;
};

export const findSnapForPiece = (piece: Piece, targetPolys: { id: number; points: number[] }[]) => {
    const MAX_LENGTH_DIFF = 12; // px
    const MAX_ANGLE_DIFF = 10; // degrees
    const MAX_MIDPOINT_DIST = 18; // px

    const pieceWorldPts = getTransformedPoints(piece);
    const pieceEdges = getEdgesFromPoints(pieceWorldPts);

    const targetEdges: Edge[] = [];
    for (const t of targetPolys) {
        const edges = getEdgesFromPoints(t.points);
        for (const e of edges) targetEdges.push(e);
    }

    for (const pe of pieceEdges) {
        for (const te of targetEdges) {
            const lenDiff = Math.abs(pe.length - te.length);
            if (lenDiff > MAX_LENGTH_DIFF) continue;
            const d1 = angleDiff(pe.angle, te.angle);
            const d2 = angleDiff((pe.angle + 180) % 360, te.angle);
            if (d1 > MAX_ANGLE_DIFF && d2 > MAX_ANGLE_DIFF) continue;
            const chosenPeAngle = d1 <= d2 ? pe.angle : (pe.angle + 180) % 360;
            const deltaAngle = te.angle - chosenPeAngle;

            const newRotation = ((piece.rotation || 0) + deltaAngle + 360) % 360;
            const rotated: Piece = { ...piece, rotation: newRotation };
            const rotatedPts = getTransformedPoints(rotated);
            const rotatedEdges = getEdgesFromPoints(rotatedPts);

            let matchedEdge: Edge | null = null;
            for (const re of rotatedEdges) {
                const md = distance(re.midx, re.midy, te.midx, te.midy);
                if (md < MAX_MIDPOINT_DIST && Math.abs(re.length - te.length) < MAX_LENGTH_DIFF) {
                    matchedEdge = re;
                    break;
                }
            }
            if (!matchedEdge) continue;

            const dx = te.midx - matchedEdge.midx;
            const dy = te.midy - matchedEdge.midy;
            const newX = piece.x + dx;
            const newY = piece.y + dy;

            const ax = matchedEdge.ax + dx;
            const ay = matchedEdge.ay + dy;
            const bx = matchedEdge.bx + dx;
            const by = matchedEdge.by + dy;
            const da = distance(ax, ay, te.ax, te.ay);
            const db = distance(bx, by, te.bx, te.by);
            const daRev = distance(ax, ay, te.bx, te.by);
            const dbRev = distance(bx, by, te.ax, te.ay);
            const best = Math.min(Math.max(da, db), Math.max(daRev, dbRev));
            if (best > 20) continue;

            return { x: newX, y: newY, rotation: newRotation };
        }
    }

    return null;
};

// generate thumbnail data URL from target polygons (pixel coords)
export const generateThumbnail = (
    targetPolys: { id: number; points: number[] }[],
    width = 160,
    height = 120,
) => {
    if (!targetPolys || targetPolys.length === 0) return '';
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // compute bounds
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of targetPolys) {
        for (let i = 0; i < p.points.length; i += 2) {
            const vx = p.points[i];
            const vy = p.points[i + 1];
            if (vx < minX) minX = vx;
            if (vy < minY) minY = vy;
            if (vx > maxX) maxX = vx;
            if (vy > maxY) maxY = vy;
        }
    }
    if (!Number.isFinite(minX)) return '';

    const pad = 8;
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const scale = Math.min((width - pad * 2) / contentW, (height - pad * 2) / contentH);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;

    for (const p of targetPolys) {
        ctx.beginPath();
        for (let i = 0; i < p.points.length; i += 2) {
            const ax = (p.points[i] - minX) * scale + pad;
            const ay = (p.points[i + 1] - minY) * scale + pad;
            if (i === 0) ctx.moveTo(ax, ay);
            else ctx.lineTo(ax, ay);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    return canvas.toDataURL('image/png');
};

// compute coverage of target area by current placed pieces (pixel mask comparison)
export const computeCoverage = (
    piecesForCalc: Piece[],
    targetPolys: { id: number; points: number[] }[],
    w = 200,
    h = 200,
) => {
    if (!piecesForCalc || piecesForCalc.length === 0) return 0;

    const canvasA = document.createElement('canvas');
    const canvasB = document.createElement('canvas');
    canvasA.width = w;
    canvasA.height = h;
    canvasB.width = w;
    canvasB.height = h;
    const a = canvasA.getContext('2d');
    const b = canvasB.getContext('2d');
    if (!a || !b) return 0;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of targetPolys) {
        for (let i = 0; i < p.points.length; i += 2) {
            const vx = p.points[i];
            const vy = p.points[i + 1];
            if (vx < minX) minX = vx;
            if (vy < minY) minY = vy;
            if (vx > maxX) maxX = vx;
            if (vy > maxY) maxY = vy;
        }
    }
    if (!Number.isFinite(minX)) return 0;

    const pad = 4;
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const scale = Math.min((w - pad * 2) / contentW, (h - pad * 2) / contentH);

    a.clearRect(0, 0, w, h);
    a.fillStyle = '#000';
    for (const p of targetPolys) {
        a.beginPath();
        for (let i = 0; i < p.points.length; i += 2) {
            const ax = (p.points[i] - minX) * scale + pad;
            const ay = (p.points[i + 1] - minY) * scale + pad;
            if (i === 0) a.moveTo(ax, ay);
            else a.lineTo(ax, ay);
        }
        a.closePath();
        a.fill();
    }

    b.clearRect(0, 0, w, h);
    b.fillStyle = '#000';
    for (const p of piecesForCalc) {
        if (!p) continue;
        const angle = ((p.rotation || 0) * Math.PI) / 180;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const cx = p.centerX ?? 0;
        const cy = p.centerY ?? 0;
        b.beginPath();
        for (let i = 0; i < p.points.length; i += 2) {
            const lx = p.points[i];
            const ly = p.points[i + 1];
            const rx = (lx - cx) * cosA - (ly - cy) * sinA + p.x;
            const ry = (lx - cx) * sinA + (ly - cy) * cosA + p.y;
            const ax = (rx - minX) * scale + pad;
            const ay = (ry - minY) * scale + pad;
            if (i === 0) b.moveTo(ax, ay);
            else b.lineTo(ax, ay);
        }
        b.closePath();
        b.fill();
    }

    const da = a.getImageData(0, 0, w, h).data;
    const db = b.getImageData(0, 0, w, h).data;
    let targetPixels = 0;
    let coveredPixels = 0;
    for (let i = 0; i < da.length; i += 4) {
        const aOn = da[i + 3] > 0;
        const bOn = db[i + 3] > 0;
        if (aOn) targetPixels++;
        if (aOn && bOn) coveredPixels++;
    }
    if (targetPixels === 0) return 0;
    return Math.round((coveredPixels / targetPixels) * 100);
};

// default tangram layout generator, returns Piece[] scaled by GRID_CELL
export const defaultTangram = (size: { width: number; height: number }): Piece[] => {
    const allPoints = [
        {
            id: 1,
            points: [0, 0, 4, 0, 2, 2],
            color: '#c62828',
            x: 0,
            y: -1,
            rotation: 0,
            placed: false,
            centerX: 2,
            centerY: 1,
        },
        {
            id: 2,
            points: [0, 0, 2, 2, 0, 4],
            color: '#ff8f00',
            x: -1,
            y: 0,
            rotation: 0,
            placed: false,
            centerX: 1,
            centerY: 2,
        },
        {
            id: 3,
            points: [4, 0, 4, 2, 3, 1],
            color: '#00acc1',
            x: 1.5,
            y: -1,
            rotation: 0,
            placed: false,
            centerX: 3.5,
            centerY: 1,
        },
        {
            id: 4,
            points: [2, 2, 3, 1, 4, 2, 3, 3],
            color: '#7cb342',
            x: 1,
            y: 0,
            rotation: 0,
            placed: false,
            centerX: 3,
            centerY: 2,
        },
        {
            id: 5,
            points: [2, 2, 3, 3, 1, 3],
            color: '#d81b60',
            x: 0,
            y: 0.5,
            rotation: 0,
            placed: false,
            centerX: 2,
            centerY: 2.5,
        },
        {
            id: 6,
            points: [1, 3, 3, 3, 2, 4, 0, 4],
            color: '#7e57c2',
            x: -0.5,
            y: 1.5,
            rotation: 0,
            placed: false,
            centerX: 1.5,
            centerY: 3.5,
        },
        {
            id: 7,
            points: [4, 2, 4, 4, 2, 4],
            color: '#fdd835',
            x: 1.5,
            y: 1.5,
            rotation: 0,
            placed: false,
            centerX: 3.5,
            centerY: 3.5,
        },
    ].map((p) => ({
        ...p,
        x: p.x * GRID_CELL,
        y: p.y * GRID_CELL,
        points: p.points.map((pi) => pi * GRID_CELL),
        centerX: (p as any).centerX * GRID_CELL,
        centerY: (p as any).centerY * GRID_CELL,
    }));

    const [offsetX, offsetY] = alignCenter(
        allPoints.flatMap((p) => getTransformedPoints(p)),
        { ...size, width: size.width * 0.5 },
    );

    return allPoints.map((p) => ({
        ...p,
        x: p.x + offsetX + size.width * 0.5,
        y: p.y + offsetY,
    }));
};
