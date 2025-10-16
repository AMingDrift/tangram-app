import PolyBool from 'polybooljs';
import SAT from 'sat';

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
    area?: number; // 新增 area 属性用于存储预计算的面积
}

export const GRID_CELL = 100;
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

// Place a set of pieces into the right area (right 40% of canvas) and center them there.
// Parameters:
// - pieces: array of Piece (local points & local centers defined)
// - canvasSize: { width, height } in pixels
// - stageTransform: optional { x, y, scale } representing current stage.position and stage.scaleX
// If stageTransform is provided, we map the screen center into world coordinates; otherwise we perform a best-effort placement in pixel space.
export const computeRightRadio = (canvasSize: { width: number; height: number }) => {
    // Two sample points (aspect ratio -> rightRadio):
    // ar1 = 3840/2160 -> radio1 = 0.55
    // ar2 = 1366/1024 -> radio2 = 0.35
    const w = canvasSize.width || 0;
    const h = canvasSize.height || 0;
    if (w <= 0 || h <= 0) return 0.35;
    const ar = w / h;
    const ar1 = 3840 / 2160; // ~1.7777778
    const ar2 = 1366 / 1024; // ~1.3330078
    const r1 = 0.55;
    const r2 = 0.35;
    // linear interpolation: radio = m * ar + b, solve using two points
    const m = (r1 - r2) / (ar1 - ar2);
    const b = r1 - m * ar1;
    let radio = m * ar + b;
    // clamp to reasonable bounds
    radio = Math.max(0.2, Math.min(0.8, radio));
    return radio;
};

export const placePiecesInRightArea = (
    pieces: Piece[],
    canvasSize: { width: number; height: number },
    stageTransform?: { x: number; y: number; scale: number },
) => {
    if (!pieces || pieces.length === 0) return pieces.map((p) => ({ ...p }));

    // compute world-space bbox of pieces (using getTransformedPoints)
    let pminX = Infinity;
    let pminY = Infinity;
    let pmaxX = -Infinity;
    let pmaxY = -Infinity;
    for (const op of pieces) {
        const pts = getTransformedPoints(op);
        for (let i = 0; i < pts.length; i += 2) {
            const x = pts[i];
            const y = pts[i + 1];
            if (x < pminX) pminX = x;
            if (y < pminY) pminY = y;
            if (x > pmaxX) pmaxX = x;
            if (y > pmaxY) pmaxY = y;
        }
    }
    const piecesCenterX = (pminX + pmaxX) / 2;
    const piecesCenterY = (pminY + pmaxY) / 2;

    // compute right area ratio dynamically based on canvas aspect ratio
    const rightRadio = computeRightRadio(canvasSize);
    const leftAreaW = (canvasSize.width || 0) * (1 - rightRadio);
    const rightAreaLeft = leftAreaW;
    const rightAreaW = Math.max(0, (canvasSize.width || 0) - rightAreaLeft);
    const rightCenterScreenX = rightAreaLeft + rightAreaW / 2;
    const rightCenterScreenY = (canvasSize.height || 0) / 2;

    // map screen center back to world coordinates if stageTransform available
    let desiredWorldCenterX = rightCenterScreenX;
    let desiredWorldCenterY = rightCenterScreenY;
    if (stageTransform && typeof stageTransform.scale === 'number' && stageTransform.scale !== 0) {
        desiredWorldCenterX = (rightCenterScreenX - (stageTransform.x || 0)) / stageTransform.scale;
        desiredWorldCenterY = (rightCenterScreenY - (stageTransform.y || 0)) / stageTransform.scale;
    }

    const offsetX = desiredWorldCenterX - piecesCenterX;
    const offsetY = desiredWorldCenterY - piecesCenterY;

    return pieces.map((p) => ({ ...p, x: (p.x || 0) + offsetX, y: (p.y || 0) + offsetY }));
};

export const DESIRED_RADIO = 0.75;
// Compute a stage transform (position + uniform scale) that fits the given target polygons
// into the left 60% area of the canvas, using the same algorithm as CanvasStage's fit logic.
export const computeStageTransformForTargets = (
    canvasSize: { width: number; height: number },
    targetPolys: { id: number; points: number[] }[] | undefined,
) => {
    const tp = targetPolys || [];
    const allPts = tp.flatMap((t) => (t && Array.isArray(t.points) ? t.points : []));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const hasTargets = Array.isArray(tp) && allPts.length >= 2;
    if (hasTargets) {
        for (let i = 0; i < allPts.length; i += 2) {
            const x = allPts[i];
            const y = allPts[i + 1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    } else {
        minX = 0;
        minY = 0;
        maxX = 1;
        maxY = 1;
    }

    const bboxW = Math.max(1, maxX - minX);
    const bboxH = Math.max(1, maxY - minY);

    const leftAreaW = (canvasSize.width || 0) * 0.6;
    const leftAreaH = canvasSize.height || bboxH;

    const desiredByHeight = (canvasSize.height || 0) * DESIRED_RADIO;
    const desiredByLeftWidth = leftAreaW * DESIRED_RADIO;
    const targetDisplay = Math.max(desiredByHeight, desiredByLeftWidth);

    const scaleForW = targetDisplay / bboxW;
    const scaleForH = targetDisplay / bboxH;
    const chosenScale = Math.min(scaleForW, scaleForH);
    const finalScale = hasTargets ? Math.max(0.0001, chosenScale * 0.95) : 1;

    const bboxCenterX = hasTargets ? (minX + maxX) / 2 : 0;
    const bboxCenterY = hasTargets ? (minY + maxY) / 2 : 0;
    const leftCenterX = leftAreaW / 2;
    const centerY = (leftAreaH || 0) / 2;

    const stageX = leftCenterX - bboxCenterX * finalScale;
    const stageY = centerY - bboxCenterY * finalScale;

    return { x: stageX, y: stageY, scale: finalScale };
};

// Compute a stage transform (position + uniform scale) that fits the given pieces
// into the right area (right 40% of canvas) so that the pieces' bbox occupies
// approximately `occupyFraction` (default 0.6) of that area's width/height.
export const computeStageTransformForPiecesRightArea = (
    canvasSize: { width: number; height: number },
    pieces: Piece[] | undefined,
    occupyFraction = 0.6,
) => {
    const ps = pieces || [];
    if (ps.length === 0) return { x: 0, y: 0, scale: 1 };

    // compute bbox of pieces in world coords
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of ps) {
        const pts = getTransformedPoints(p);
        for (let i = 0; i < pts.length; i += 2) {
            const x = pts[i];
            const y = pts[i + 1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, scale: 1 };

    const bboxW = Math.max(1, maxX - minX);
    const bboxH = Math.max(1, maxY - minY);
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    // define right area
    const leftAreaW = (canvasSize.width || 0) * 0.6;
    const rightAreaLeft = leftAreaW;
    const rightAreaW = Math.max(0, (canvasSize.width || 0) - rightAreaLeft);
    const rightCenterX = rightAreaLeft + rightAreaW / 2;
    const rightCenterY = (canvasSize.height || 0) / 2;

    // desired display inside right area
    const desiredByWidth = rightAreaW * occupyFraction;
    const desiredByHeight = (canvasSize.height || 0) * occupyFraction;
    const targetDisplay = Math.max(desiredByWidth, desiredByHeight);

    const scaleForW = targetDisplay / bboxW;
    const scaleForH = targetDisplay / bboxH;
    const chosenScale = Math.min(scaleForW, scaleForH);
    const finalScale = Math.max(0.0001, chosenScale * 0.95);

    const stageX = rightCenterX - bboxCenterX * finalScale;
    const stageY = rightCenterY - bboxCenterY * finalScale;

    return { x: stageX, y: stageY, scale: finalScale };
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
    // For each target polygon, add its edges plus any extended-in-polygon segments
    // so that long convex edges (with no neighbouring short edges) can still match
    const pointInPolygon = (x: number, y: number, polyPts: number[]) => {
        let inside = false;
        for (let i = 0, j = polyPts.length - 2; i < polyPts.length; i += 2) {
            const xi = polyPts[i];
            const yi = polyPts[i + 1];
            const xj = polyPts[j];
            const yj = polyPts[j + 1];
            const intersect =
                yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
            if (intersect) inside = !inside;
            j = i;
        }
        return inside;
    };

    const lineSegIntersection = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        cx: number,
        cy: number,
        dx: number,
        dy: number,
    ) => {
        const vx = bx - ax;
        const vy = by - ay;
        const wx = dx - cx;
        const wy = dy - cy;
        const denom = vx * wy - vy * wx;
        if (Math.abs(denom) < 1e-9) return null; // parallel
        const t = ((cx - ax) * wy - (cy - ay) * wx) / denom; // param along AB
        const u = ((cx - ax) * vy - (cy - ay) * vx) / denom; // param along CD
        if (u < -1e-9 || u > 1 + 1e-9) return null; // intersection not on segment CD
        return { x: ax + t * vx, y: ay + t * vy, t };
    };

    for (const t of targetPolys) {
        // push native polygon edges
        const edges = getEdgesFromPoints(t.points);
        for (const e of edges) targetEdges.push(e);

        // For each edge, compute intersections of the infinite line with polygon edges
        // and build intervals that lie inside the polygon.
        for (const e of edges) {
            const ax = e.ax;
            const ay = e.ay;
            const bx = e.bx;
            const by = e.by;
            const vx = bx - ax;
            const vy = by - ay;
            const len = Math.hypot(vx, vy);
            if (len < 1e-9) continue;

            // collect t parameters along AB (where A + t*(B-A)) for intersections
            const ts: number[] = [0, 1];
            for (let i = 0; i < t.points.length; i += 2) {
                const cx = t.points[i];
                const cy = t.points[i + 1];
                const dx = t.points[(i + 2) % t.points.length];
                const dy = t.points[(i + 3) % t.points.length];
                const inter = lineSegIntersection(ax, ay, bx, by, cx, cy, dx, dy);
                if (inter) ts.push(inter.t);
            }

            // sort unique
            const uniq = Array.from(new Set(ts.map((v) => Math.round(v * 1e6) / 1e6))).sort(
                (a, b) => a - b,
            );
            for (let i = 0; i < uniq.length - 1; i++) {
                const t0 = uniq[i];
                const t1 = uniq[i + 1];
                const midT = (t0 + t1) / 2;
                const mx = ax + midT * vx;
                const my = ay + midT * vy;
                if (pointInPolygon(mx, my, t.points)) {
                    // interval [t0,t1] lies (partially) inside polygon -> create candidate segment
                    const sx = ax + t0 * vx;
                    const sy = ay + t0 * vy;
                    const ex = ax + t1 * vx;
                    const ey = ay + t1 * vy;
                    const segLen = Math.hypot(ex - sx, ey - sy);
                    if (segLen < 1e-6) continue;
                    const segAngle = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
                    targetEdges.push({
                        ax: sx,
                        ay: sy,
                        bx: ex,
                        by: ey,
                        length: segLen,
                        angle: segAngle,
                        midx: (sx + ex) / 2,
                        midy: (sy + ey) / 2,
                    });
                }
            }
        }
    }

    // helper: compute overlap length (in px) between segment AB and segment CD when
    // projected onto AB's direction. Returns 0 if no overlap.
    const segmentOverlapLength = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        cx: number,
        cy: number,
        dx: number,
        dy: number,
    ) => {
        const vx = bx - ax;
        const vy = by - ay;
        const len = Math.hypot(vx, vy);
        if (len < 1e-9) return 0;
        const ux = vx / len;
        const uy = vy / len;
        const proj = (px: number, py: number) => (px - ax) * ux + (py - ay) * uy;
        const a1 = 0;
        const a2 = len;
        const c1 = proj(cx, cy);
        const c2 = proj(dx, dy);
        const lo = Math.max(Math.min(a1, a2), Math.min(c1, c2));
        const hi = Math.min(Math.max(a1, a2), Math.max(c1, c2));
        return Math.max(0, hi - lo);
    };

    console.log(targetEdges);

    for (const pe of pieceEdges) {
        for (const te of targetEdges) {
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
                // first try the strict length match
                // console.log(
                //     `md=${md}\nMath.abs(re.length - te.length)=${Math.abs(re.length - te.length)}\n`,
                // );
                if (md < MAX_MIDPOINT_DIST && Math.abs(re.length - te.length) < MAX_LENGTH_DIFF) {
                    matchedEdge = re;
                    break;
                }
                // if lengths differ but midpoints are close, allow partial overlap if overlap length is sufficient
                if (md < MAX_MIDPOINT_DIST) {
                    const overlap = segmentOverlapLength(
                        re.ax,
                        re.ay,
                        re.bx,
                        re.by,
                        te.ax,
                        te.ay,
                        te.bx,
                        te.by,
                    );
                    const minLen = Math.min(re.length, te.length);
                    const minAccept = Math.min(12, minLen * 0.2); // accept if >=12px or 20% of shorter edge
                    if (overlap >= minAccept) {
                        console.log('partial overlap', overlap, minLen, minAccept);
                        matchedEdge = re;
                        break;
                    }
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
    targetPolys: { id: number; points: number[]; color?: string }[],
    // treat width/height as maximum allowed size; function will auto-size to content bbox
    maxWidth = 160,
    maxHeight = 120,
    pad = 8,
) => {
    if (!targetPolys || targetPolys.length === 0) return '';

    // compute bounds of all points
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

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);

    // compute scale to fit within maxWidth/maxHeight, but allow upscaling if content is very small
    const scale = Math.min(maxWidth / contentW, maxHeight / contentH, 1);

    // final canvas size based on scaled content plus padding
    const canvasW = Math.max(1, Math.ceil(contentW * scale + pad * 2));
    const canvasH = Math.max(1, Math.ceil(contentH * scale + pad * 2));

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // center offset so the content is centered within the canvas
    const extraX = (canvasW - (contentW * scale + pad * 2)) / 2;
    const extraY = (canvasH - (contentH * scale + pad * 2)) / 2;

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.lineWidth = 1;

    for (const p of targetPolys) {
        ctx.beginPath();
        for (let i = 0; i < p.points.length; i += 2) {
            const ax = (p.points[i] - minX) * scale + pad + extraX;
            const ay = (p.points[i + 1] - minY) * scale + pad + extraY;
            if (i === 0) ctx.moveTo(ax, ay);
            else ctx.lineTo(ax, ay);
        }
        ctx.closePath();
        // use provided color if any, otherwise fallback to black
        if (p.color) ctx.fillStyle = p.color;
        else ctx.fillStyle = 'rgba(0,0,0,0.9)';

        // stroke: slightly darker border for visibility
        try {
            ctx.strokeStyle = p.color || 'rgba(0,0,0,0.6)';
        } catch {
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        }

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

// --- 碰撞检测: 基于分离轴定理 (SAT) 的多边形相交检测 ---
// 返回两个多边形（以世界坐标点数组表示）是否相交
export const polygonIntersectionSAT = (ptsA: number[], ptsB: number[]) => {
    const toSATPolygon = (pts: number[]) => {
        const vertices = [];
        for (let i = 0; i < pts.length; i += 2) {
            vertices.push(new SAT.Vector(pts[i], pts[i + 1]));
        }
        return new SAT.Polygon(new SAT.Vector(0, 0), vertices);
    };

    const polyA = toSATPolygon(ptsA);
    const polyB = toSATPolygon(ptsB);
    const response = new SAT.Response();
    return SAT.testPolygonPolygon(polyA, polyB, response);
};

// 替换面积计算逻辑，手动计算多边形面积
const calculatePolygonArea = (pts: number[]) => {
    let area = 0;
    for (let i = 0; i < pts.length; i += 2) {
        const x1 = pts[i];
        const y1 = pts[i + 1];
        const x2 = pts[(i + 2) % pts.length];
        const y2 = pts[(i + 3) % pts.length];
        area += x1 * y2 - y1 * x2;
    }
    return Math.abs(area) / 2;
};

// 计算两个多边形的重叠面积
export const calculateOverlapArea = (ptsA: number[], ptsB: number[]) => {
    // Helper: 使用 Sutherland-Hodgman 算法裁剪多边形
    const clipPolygon = (subject: number[], clip: number[]) => {
        const output = [...subject];
        for (let i = 0; i < clip.length; i += 2) {
            const clipAx = clip[i];
            const clipAy = clip[i + 1];
            const clipBx = clip[(i + 2) % clip.length];
            const clipBy = clip[(i + 3) % clip.length];

            const input = [...output];
            output.length = 0;

            for (let j = 0; j < input.length; j += 2) {
                const subjAx = input[j];
                const subjAy = input[j + 1];
                const subjBx = input[(j + 2) % input.length];
                const subjBy = input[(j + 3) % input.length];

                const inside = (x: number, y: number) => {
                    return (clipBx - clipAx) * (y - clipAy) - (clipBy - clipAy) * (x - clipAx) >= 0;
                };

                const intersection = (
                    ax: number,
                    ay: number,
                    bx: number,
                    by: number,
                    cx: number,
                    cy: number,
                    dx: number,
                    dy: number,
                ) => {
                    const a1 = by - ay;
                    const b1 = ax - bx;
                    const c1 = a1 * ax + b1 * ay;
                    const a2 = dy - cy;
                    const b2 = cx - dx;
                    const c2 = a2 * cx + b2 * cy;
                    const det = a1 * b2 - a2 * b1;
                    if (Math.abs(det) < 1e-10) return null; // 平行
                    const x = (b2 * c1 - b1 * c2) / det;
                    const y = (a1 * c2 - a2 * c1) / det;
                    return { x, y };
                };

                const startInside = inside(subjAx, subjAy);
                const endInside = inside(subjBx, subjBy);

                if (endInside) {
                    if (!startInside) {
                        const inter = intersection(
                            subjAx,
                            subjAy,
                            subjBx,
                            subjBy,
                            clipAx,
                            clipAy,
                            clipBx,
                            clipBy,
                        );
                        if (inter) output.push(inter.x, inter.y);
                    }
                    output.push(subjBx, subjBy);
                } else if (startInside) {
                    const inter = intersection(
                        subjAx,
                        subjAy,
                        subjBx,
                        subjBy,
                        clipAx,
                        clipAy,
                        clipBx,
                        clipBy,
                    );
                    if (inter) output.push(inter.x, inter.y);
                }
            }
        }
        return output;
    };

    const intersectionPolygon = clipPolygon(ptsA, ptsB);

    // Helper: 使用鞋带公式计算多边形面积
    const calculatePolygonArea = (pts: number[]) => {
        let area = 0;
        for (let i = 0; i < pts.length; i += 2) {
            const x1 = pts[i];
            const y1 = pts[i + 1];
            const x2 = pts[(i + 2) % pts.length];
            const y2 = pts[(i + 3) % pts.length];
            area += x1 * y2 - y1 * x2;
        }
        return Math.abs(area) / 2;
    };

    return calculatePolygonArea(intersectionPolygon);
};

// 判断是否应该阻止碰撞（用于拖拽时检测）。
// 当碰撞重叠小于 allowThreshold 时，阻止移动；否则允许强行穿过。
export const shouldBlockCollision = (
    movingPts: number[],
    otherPts: number[],
    movingArea: number,
    allowThreshold = 0.25,
) => {
    const intersect = polygonIntersectionSAT(movingPts, otherPts);
    if (!intersect) return false;

    const overlapArea = calculateOverlapArea(movingPts, otherPts);

    return overlapArea / movingArea < allowThreshold;
};

// 给定一个 piece (world transform 已包含在 points 中)，检查是否与其他 pieces 产生阻止性的碰撞
export const checkCollisionsForPiece = (
    piecePts: number[],
    otherPiecesPts: number[][],
    movingArea: number,
    allowThreshold = 0.25,
) => {
    for (const op of otherPiecesPts) {
        if (shouldBlockCollision(piecePts, op, movingArea, allowThreshold)) {
            return true;
        }
    }
    return false;
};

// default tangram layout generator, returns Piece[] scaled by GRID_CELL
export const defaultTangram = (): Piece[] => {
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
        // precompute area at GRID_CELL scale (do not depend on later 'scale' var)
        area: calculatePolygonArea(p.points.map((pi) => pi * GRID_CELL) as number[]),
    }));

    return allPoints;
};

// Compute displayTargetPieces by clustering nearby/ touching polygons within a tolerance (px)
// and merging each cluster into a single representative polygon. For merging we compute
// the convex hull of all boundary points in the cluster. This is a pragmatic approach that
// treats closely-fitting pieces as a single displayed polygon while avoiding heavy
// polygon-union implementations. Returns array of { id: string, points: number[] }
export const computeDisplayTargetPieces = (
    targetPolys: { id: number; points: number[] }[] | undefined,
    tolerance = 5,
) => {
    const tp = targetPolys || [];
    if (tp.length === 0) return [] as { id: string; points: number[] }[];

    // helper: point-segment distance
    const pointSegDist = (
        px: number,
        py: number,
        ax: number,
        ay: number,
        bx: number,
        by: number,
    ) => {
        const vx = bx - ax;
        const vy = by - ay;
        const wx = px - ax;
        const wy = py - ay;
        const c1 = vx * wx + vy * wy;
        const c2 = vx * vx + vy * vy;
        let t = 0;
        if (c2 > 1e-12) t = Math.max(0, Math.min(1, c1 / c2));
        const cx = ax + vx * t;
        const cy = ay + vy * t;
        const dx = px - cx;
        const dy = py - cy;
        return Math.hypot(dx, dy);
    };

    // minimal distance between two polygons (vertex->edge and vertex->vertex approx)
    const polyMinDist = (a: number[], b: number[]) => {
        let best = Infinity;
        for (let i = 0; i < a.length; i += 2) {
            const px = a[i];
            const py = a[i + 1];
            for (let j = 0; j < b.length; j += 2) {
                // vertex to vertex
                const vx = b[j];
                const vy = b[j + 1];
                const dvv = Math.hypot(px - vx, py - vy);
                if (dvv < best) best = dvv;
            }
            // vertex to edges
            for (let j = 0; j < b.length; j += 2) {
                const ax = b[j];
                const ay = b[j + 1];
                const bx2 = b[(j + 2) % b.length];
                const by2 = b[(j + 3) % b.length];
                const d = pointSegDist(px, py, ax, ay, bx2, by2);
                if (d < best) best = d;
            }
        }
        // also check other direction vertex->edge
        for (let i = 0; i < b.length; i += 2) {
            const px = b[i];
            const py = b[i + 1];
            for (let j = 0; j < a.length; j += 2) {
                const ax = a[j];
                const ay = a[j + 1];
                const bx2 = a[(j + 2) % a.length];
                const by2 = a[(j + 3) % a.length];
                const d = pointSegDist(px, py, ax, ay, bx2, by2);
                if (d < best) best = d;
            }
        }
        return best;
    };

    // Build adjacency graph where two polys are connected if they overlap or are within tolerance
    const n = tp.length;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const a = tp[i].points;
            const b = tp[j].points;
            let connected = false;
            try {
                // overlap check (any intersection)
                if (polygonIntersectionSAT(a, b)) connected = true;
            } catch {
                // ignore SAT failures
            }
            if (!connected) {
                const d = polyMinDist(a, b);
                if (d <= tolerance) connected = true;
            }
            if (connected) {
                adj[i].push(j);
                adj[j].push(i);
            }
        }
    }

    // find connected components
    const visited = Array.from({ length: n }, () => false);
    const groups: number[][] = [];
    for (let i = 0; i < n; i++) {
        if (visited[i]) continue;
        const stack = [i];
        const comp: number[] = [];
        visited[i] = true;
        while (stack.length) {
            const u = stack.pop()!;
            comp.push(u);
            for (const v of adj[u]) {
                if (!visited[v]) {
                    visited[v] = true;
                    stack.push(v);
                }
            }
        }
        groups.push(comp);
    }

    // Merge polygons within each connected component using polybooljs to preserve concavities.
    // polybooljs uses format: { regions: Array<Array<[x,y]>>, inverted: boolean }
    const toPoly = (pts: number[]) => {
        const region: [number, number][] = [];
        for (let i = 0; i < pts.length; i += 2) region.push([pts[i], pts[i + 1]]);
        return { regions: [region], inverted: false } as any;
    };

    const fromPoly = (poly: any) => {
        const out: { id: string; points: number[] }[] = [];
        if (!poly || !Array.isArray(poly.regions)) return out;
        for (let r = 0; r < poly.regions.length; r++) {
            const region = poly.regions[r] as [number, number][];
            if (!region || region.length === 0) continue;
            const pts: number[] = [];
            for (const v of region) pts.push(v[0], v[1]);
            out.push({ id: String(r), points: pts });
        }
        return out;
    };

    const result: { id: string; points: number[] }[] = [];
    for (const comp of groups) {
        // union all member polygons using polybooljs
        let accum: any | null = null;
        const ids: number[] = [];
        for (const idx of comp) {
            ids.push(tp[idx].id);
            const poly = toPoly(tp[idx].points);
            if (!accum) accum = poly;
            else accum = PolyBool.union(accum, poly);
        }

        if (!accum) continue;

        // convert union result into flattened rings; poly.regions is an array of rings
        const merged = fromPoly(accum);
        // merged may contain multiple regions (holes handled as separate regions by polybooljs)
        for (let k = 0; k < merged.length; k++) {
            const item = merged[k];
            // construct id from component ids and index
            const outId = ids.join('-') + (merged.length > 1 ? `-${k}` : '');
            result.push({ id: outId, points: item.points });
        }
    }

    return result;
};
