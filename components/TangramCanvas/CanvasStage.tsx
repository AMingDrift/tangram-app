import type Konva from 'konva';

import React, { useRef } from 'react';
import { Group, Layer, Line, Stage, Text } from 'react-konva';
import { useShallow } from 'zustand/shallow';

import type { Piece } from '@/lib/tangramUtils';

import {
    calculateOverlapArea,
    checkCollisionsForPiece,
    computeCoverage,
    findSnapForPiece,
    getEdgesFromPoints,
    getTransformedPoints,
    GRID_CELL,
} from '@/lib/tangramUtils';
import { useTangramStore } from '@/stores/tangramStore';

export default function CanvasStage() {
    const {
        pieces,
        size,
        updatePiece,
        bringPieceToTop,
        setCoverage,
        offsetTarget,
        selectedProblemTargets,
    } = useTangramStore(
        useShallow((state) => ({
            pieces: state.pieces,
            size: state.size,
            updatePiece: state.updatePiece,
            bringPieceToTop: state.bringPieceToTop,
            setCoverage: state.setCoverage,
            offsetTarget: state.offsetTarget,
            selectedProblemTargets: state.problemTargets[state.selectedProblem] ?? null,
        })),
    );

    const groupRefs = useRef<Record<number, any>>({});
    // 保存每个 piece 的上一次安全位置（用于实时拖拽时回退）
    const lastSafePos = useRef<Record<number, { x: number; y: number }>>({});

    const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

    const otherPtsRef = useRef<number[][]>([]);
    const otherBBoxesRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number }[]>([]);
    const otherGridRef = useRef<Map<string, number[]>>(new Map());
    const stageRef = useRef<Konva.Stage | null>(null);
    const touchDataRef = useRef({
        lastDist: 0,
        lastCenter: { x: 0, y: 0 },
    });
    // 鼠标与触摸平移相关 refs
    const isPanningRef = useRef(false);
    const lastPanPosition = useRef<{ x: number; y: number } | null>(null);
    const touchPanningRef = useRef(false);
    const lastTouchPosRef = useRef<{ x: number; y: number } | null>(null);

    // 检查事件目标或其父节点链中是否存在 draggable 属性（用于判定是否点中了 piece）
    const isEventOnDraggable = (target: any) => {
        let node = target;
        try {
            while (node) {
                if (node.getAttr && node.getAttr('draggable')) return true;
                // konva 上父节点为 parent
                node = node.getParent ? node.getParent() : node.parent;
            }
        } catch {
            // ignore
        }
        return false;
    };

    // helper: compute axis-aligned bbox from flattened pts
    const bboxFromPts = (pts: number[]) => {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < pts.length; i += 2) {
            const x = pts[i];
            const y = pts[i + 1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
        return { minX, minY, maxX, maxY };
    };

    // helper: grid key
    const gridKey = (gx: number, gy: number) => `${gx},${gy}`;

    const handleWheel = (e: any) => {
        const stage = stageRef.current;
        if (!stage) return;
        e.evt.preventDefault();
        const scaleBy = 1.05;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
    };

    // 获取两指中心点
    const getTouchesCenter = (touches: React.TouchEvent['touches']) => {
        const x = (touches[0].clientX + touches[1].clientX) / 2;
        const y = (touches[0].clientY + touches[1].clientY) / 2;
        return { x, y };
    };

    // 获取两指距离
    const getTouchesDistance = (touches: React.TouchEvent['touches']) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: any) => {
        e.evt.preventDefault();
        const touches = e.evt.touches;
        if (touches.length === 1) {
            // 单指触摸：如果不是点在 draggable piece 上，开始平移
            const target = e.target || e.evt?.target;
            const onDraggable = isEventOnDraggable(target);
            if (!onDraggable) {
                touchPanningRef.current = true;
                lastTouchPosRef.current = {
                    x: touches[0].clientX,
                    y: touches[0].clientY,
                };
            }
        }

        if (touches.length === 2) {
            const center = getTouchesCenter(touches);
            const dist = getTouchesDistance(touches);

            touchDataRef.current = {
                lastDist: dist,
                lastCenter: center,
            };
        }
    };

    const handleTouchMove = (e: any) => {
        console.log(e);
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;

        const touches = e.evt.touches;
        if (touches.length === 1 && touchPanningRef.current) {
            // 单指平移逻辑
            const cur = { x: touches[0].clientX, y: touches[0].clientY };
            const last = lastTouchPosRef.current;
            if (last) {
                const dx = cur.x - last.x;
                const dy = cur.y - last.y;
                stage.position({ x: stage.x() + dx, y: stage.y() + dy });
                stage.batchDraw();
            }
            lastTouchPosRef.current = cur;
            return;
        }

        if (touches.length === 2) {
            const currentCenter = getTouchesCenter(touches);
            const currentDist = getTouchesDistance(touches);

            const { lastDist, lastCenter } = touchDataRef.current;

            // 计算缩放比例变化
            const scaleDelta = currentDist / lastDist;

            // 获取当前缩放
            const scale = stage.scaleX();
            const newScale = scale * scaleDelta;

            // 限制缩放范围（可选）
            const minScale = 0.2;
            const maxScale = 10;
            if (newScale < minScale || newScale > maxScale) return;

            // === 关键：计算新的舞台位置，使缩放中心点保持在视觉原位 ===
            const stagePos = {
                x: stage.x(),
                y: stage.y(),
            };

            // 将屏幕坐标转换为舞台坐标（考虑当前缩放）
            const lastCenterStage = {
                x: (lastCenter.x - stagePos.x) / scale,
                y: (lastCenter.y - stagePos.y) / scale,
            };

            // 缩放后，为了让 lastCenter 在屏幕上的位置不变：
            // 新的舞台位置 = 当前位置 - (lastCenterStage * newScale - lastCenter)
            const dx = lastCenter.x - lastCenterStage.x * newScale;
            const dy = lastCenter.y - lastCenterStage.y * newScale;

            // 应用新缩放和位置
            stage.scale({ x: newScale, y: newScale });
            stage.position({ x: dx, y: dy });

            // 更新缓存数据
            touchDataRef.current = {
                lastDist: currentDist,
                lastCenter: currentCenter,
            };

            stage.batchDraw();
        }
    };

    const handleTouchEnd = () => {
        // 结束触摸，清理单指/多指状态
        touchPanningRef.current = false;
        lastTouchPosRef.current = null;
        touchDataRef.current = { lastDist: 0, lastCenter: { x: 0, y: 0 } };
    };

    // 鼠标平移实现：按下空白区域开始平移（如果在 piece 上按下，由 piece 的 draggable 处理）
    const handleMouseDown = (e: any) => {
        const stage = stageRef.current;
        if (!stage) return;
        // 如果未点击 draggable shape，则开始平移
        const target = e.target || e.evt?.target;
        if (!isEventOnDraggable(target)) {
            isPanningRef.current = true;
            lastPanPosition.current = { x: e.evt.clientX, y: e.evt.clientY };
        }
    };

    const handleMouseMove = (e: any) => {
        if (!isPanningRef.current) return;
        const stage = stageRef.current;
        if (!stage || !lastPanPosition.current) return;
        const cur = { x: e.evt.clientX, y: e.evt.clientY };
        const last = lastPanPosition.current;
        const dx = cur.x - last.x;
        const dy = cur.y - last.y;
        stage.position({ x: stage.x() + dx, y: stage.y() + dy });
        lastPanPosition.current = cur;
        stage.batchDraw();
    };

    const handleMouseUp = () => {
        isPanningRef.current = false;
        lastPanPosition.current = null;
    };

    return (
        <>
            {size.width > 0 && (
                <Stage
                    ref={stageRef}
                    width={size.width}
                    height={size.height}
                    draggable={false}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <Layer>
                        {/* grid and rendering logic should be migrated here */}
                        {/* Grid background */}
                        {(() => {
                            const lines = [] as any[];
                            const GRID = GRID_CELL / 2;
                            const cols = Math.ceil(size.width / GRID);
                            const rows = Math.ceil(size.height / GRID);
                            for (let i = 0; i <= cols; i++) {
                                const x = i * GRID;
                                lines.push(
                                    <Line
                                        key={`v-${i}`}
                                        points={[x, 0, x, size.height]}
                                        stroke="#ddd"
                                        strokeWidth={1}
                                        opacity={0.6}
                                    />,
                                );
                            }
                            for (let j = 0; j <= rows; j++) {
                                const y = j * GRID;
                                lines.push(
                                    <Line
                                        key={`h-${j}`}
                                        points={[0, y, size.width, y]}
                                        stroke="#ddd"
                                        strokeWidth={1}
                                        opacity={0.6}
                                    />,
                                );
                            }
                            return lines;
                        })()}

                        {/* Central target shapes (pixel-space) */}
                        {offsetTarget.map((p: any) => (
                            <Line key={p.id} points={p.points} fill="black" closed opacity={0.25} />
                        ))}

                        {pieces.map((p: Piece) => (
                            <Group
                                ref={(n) => {
                                    groupRefs.current[p.id] = n;
                                }}
                                key={`piece-${p.id}`}
                                x={p.x}
                                y={p.y}
                                rotation={p.rotation}
                                offsetX={p.centerX ?? 0}
                                offsetY={p.centerY ?? 0}
                                draggable
                                onDragStart={() => {
                                    bringPieceToTop(p.id);
                                    // 记录起始的安全位置
                                    lastSafePos.current[p.id] = { x: p.x, y: p.y };
                                    // 收集其他 pieces 的 world points
                                    const others = pieces
                                        .filter((op) => op.id !== p.id)
                                        .map((op) => getTransformedPoints(op));
                                    otherPtsRef.current = others;
                                    // 预计算其他 pieces 的包围盒，用于快速过滤
                                    const bboxes = others.map((pts) => bboxFromPts(pts));
                                    otherBBoxesRef.current = bboxes;
                                    // 构建简单的网格索引（按 GRID_CELL 大小）
                                    const grid = new Map<string, number[]>();
                                    for (let i = 0; i < bboxes.length; i++) {
                                        const bb = bboxes[i];
                                        const gx0 = Math.floor(bb.minX / GRID_CELL);
                                        const gy0 = Math.floor(bb.minY / GRID_CELL);
                                        const gx1 = Math.floor(bb.maxX / GRID_CELL);
                                        const gy1 = Math.floor(bb.maxY / GRID_CELL);
                                        for (let gx = gx0; gx <= gx1; gx++) {
                                            for (let gy = gy0; gy <= gy1; gy++) {
                                                const k = gridKey(gx, gy);
                                                const arr = grid.get(k) || [];
                                                arr.push(i);
                                                grid.set(k, arr);
                                            }
                                        }
                                    }
                                    otherGridRef.current = grid;
                                }}
                                onDragMove={(e) => {
                                    const newX = e.target.x();
                                    const newY = e.target.y();

                                    // 计算当前拖动后的 world points（不修改原 piece）
                                    const tempPiece = { ...p, x: newX, y: newY };
                                    const movedPts = getTransformedPoints(tempPiece);

                                    // 使用 SAT.js 检查是否存在阻止性碰撞
                                    const blocked = checkCollisionsForPiece(
                                        movedPts,
                                        otherPtsRef.current,
                                        pieces.find((pc) => pc.id === p.id)?.area || 0,
                                        0.15,
                                    );
                                    if (blocked) {
                                        // console.log('drag move - piece', p.id, 'blocked');
                                        // 阻止：把 konva node 回退到上次安全位置
                                        console.log('blocked', p.id);
                                        const safe = lastSafePos.current[p.id];
                                        if (safe && groupRefs.current[p.id]) {
                                            // 尝试寻找从 safe -> 当前移动点之间的最近不重叠点
                                            const targetPos = { x: newX, y: newY };
                                            const startPos = { x: safe.x, y: safe.y };

                                            // helper: compute overlap sum against all other pieces
                                            const overlapAt = (x: number, y: number) => {
                                                const candidate = { ...p, x, y };
                                                const candPts = getTransformedPoints(candidate);
                                                const candBox = bboxFromPts(candPts);
                                                let sum = 0;
                                                // use grid to collect candidate indices
                                                const gx0 = Math.floor(candBox.minX / GRID_CELL);
                                                const gy0 = Math.floor(candBox.minY / GRID_CELL);
                                                const gx1 = Math.floor(candBox.maxX / GRID_CELL);
                                                const gy1 = Math.floor(candBox.maxY / GRID_CELL);
                                                const seen = new Set<number>();
                                                for (let gx = gx0; gx <= gx1; gx++) {
                                                    for (let gy = gy0; gy <= gy1; gy++) {
                                                        const k = gridKey(gx, gy);
                                                        const arr =
                                                            otherGridRef.current.get(k) || [];
                                                        for (const idx of arr) seen.add(idx);
                                                    }
                                                }
                                                // only compute overlap for candidates
                                                for (const i of seen) {
                                                    const op = otherPtsRef.current[i];
                                                    const obb = otherBBoxesRef.current[i];
                                                    // bbox reject (again) as safety
                                                    if (
                                                        obb.maxX < candBox.minX ||
                                                        obb.minX > candBox.maxX ||
                                                        obb.maxY < candBox.minY ||
                                                        obb.minY > candBox.maxY
                                                    ) {
                                                        continue;
                                                    }
                                                    sum += calculateOverlapArea(candPts, op);
                                                }
                                                return sum;
                                            };

                                            // If safe already has zero overlap, just snap to safe
                                            const safeOverlap = overlapAt(startPos.x, startPos.y);

                                            // If target has overlap, we search along the segment for the closest point to target with overlap === 0
                                            const targetOverlap = overlapAt(
                                                targetPos.x,
                                                targetPos.y,
                                            );

                                            let foundPos = startPos;

                                            if (safeOverlap <= 0 && targetOverlap > 0) {
                                                // coarse sampling + refined binary search
                                                const COARSE_STEPS = 8; // coarse samples
                                                const dxSeg = targetPos.x - startPos.x;
                                                const dySeg = targetPos.y - startPos.y;

                                                // find the largest coarse t (in [0,1]) that has no overlap
                                                let lastNonOverlapT = -1;
                                                for (let s = 0; s <= COARSE_STEPS; s++) {
                                                    const t = s / COARSE_STEPS;
                                                    const mx = startPos.x + dxSeg * t;
                                                    const my = startPos.y + dySeg * t;
                                                    const ov = overlapAt(mx, my);
                                                    if (ov <= 0) lastNonOverlapT = t;
                                                }

                                                if (lastNonOverlapT < 0) {
                                                    // no non-overlap found even at start (shouldn't happen if safeOverlap<=0), fallback
                                                    foundPos = startPos;
                                                } else if (lastNonOverlapT >= 1 - 1e-9) {
                                                    // target is non-overlapping
                                                    foundPos = targetPos;
                                                } else {
                                                    // refine between lastNonOverlapT and next coarse sample
                                                    let lo = lastNonOverlapT;
                                                    let hi = Math.min(
                                                        1,
                                                        lastNonOverlapT + 1 / COARSE_STEPS,
                                                    );
                                                    // refined binary search (fewer iterations)
                                                    for (let iter = 0; iter < 20; iter++) {
                                                        const mid = (lo + hi) / 2;
                                                        const mx = startPos.x + dxSeg * mid;
                                                        const my = startPos.y + dySeg * mid;
                                                        const ov = overlapAt(mx, my);
                                                        if (ov > 0) {
                                                            hi = mid;
                                                        } else {
                                                            lo = mid;
                                                        }
                                                    }
                                                    const t = lo;
                                                    foundPos = {
                                                        x: startPos.x + dxSeg * t,
                                                        y: startPos.y + dySeg * t,
                                                    };
                                                }

                                                // --- 接触边检测与沿边滑动逻辑 ---
                                                try {
                                                    // transformed points at foundPos
                                                    const cand = {
                                                        ...p,
                                                        x: foundPos.x,
                                                        y: foundPos.y,
                                                    };
                                                    const candPts = getTransformedPoints(cand);
                                                    const candEdges = getEdgesFromPoints(candPts);

                                                    // find the closest edge pair between candidate and other pieces
                                                    let best = {
                                                        dist: Infinity,
                                                        which: 'none' as 'aEdge' | 'bEdge' | 'none',
                                                        aEdge: null as any,
                                                        bEdge: null as any,
                                                    };

                                                    // (distPointToSeg removed; using pointSegDist below)

                                                    // simple point->segment distance helper (robust)
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
                                                        if (c2 > 1e-12)
                                                            t = Math.max(0, Math.min(1, c1 / c2));
                                                        const cx = ax + vx * t;
                                                        const cy = ay + vy * t;
                                                        const dx = px - cx;
                                                        const dy = py - cy;
                                                        return Math.hypot(dx, dy);
                                                    };

                                                    for (const opPts of otherPtsRef.current) {
                                                        const otherEdges =
                                                            getEdgesFromPoints(opPts);
                                                        for (const ae of candEdges) {
                                                            for (const be of otherEdges) {
                                                                // compute minimal of endpoint-to-segment distances
                                                                const dA1 = pointSegDist(
                                                                    ae.ax,
                                                                    ae.ay,
                                                                    be.ax,
                                                                    be.ay,
                                                                    be.bx,
                                                                    be.by,
                                                                );
                                                                const dA2 = pointSegDist(
                                                                    ae.bx,
                                                                    ae.by,
                                                                    be.ax,
                                                                    be.ay,
                                                                    be.bx,
                                                                    be.by,
                                                                );
                                                                const dB1 = pointSegDist(
                                                                    be.ax,
                                                                    be.ay,
                                                                    ae.ax,
                                                                    ae.ay,
                                                                    ae.bx,
                                                                    ae.by,
                                                                );
                                                                const dB2 = pointSegDist(
                                                                    be.bx,
                                                                    be.by,
                                                                    ae.ax,
                                                                    ae.ay,
                                                                    ae.bx,
                                                                    ae.by,
                                                                );
                                                                const localMin = Math.min(
                                                                    dA1,
                                                                    dA2,
                                                                    dB1,
                                                                    dB2,
                                                                );
                                                                if (localMin < best.dist) {
                                                                    let which:
                                                                        | 'aEdge'
                                                                        | 'bEdge'
                                                                        | 'none' = 'none';
                                                                    // determine whether contact is on A's edge or B's edge by which distance was minimal
                                                                    if (
                                                                        localMin === dB1 ||
                                                                        localMin === dB2
                                                                    )
                                                                        which = 'aEdge';
                                                                    else if (
                                                                        localMin === dA1 ||
                                                                        localMin === dA2
                                                                    )
                                                                        which = 'bEdge';
                                                                    best = {
                                                                        dist: localMin,
                                                                        which,
                                                                        aEdge: ae,
                                                                        bEdge: be,
                                                                    };
                                                                }
                                                            }
                                                        }
                                                    }

                                                    const CONTACT_EPS = 0.5; // px tolerance
                                                    if (
                                                        best.which !== 'none' &&
                                                        best.dist <= CONTACT_EPS
                                                    ) {
                                                        // choose edge to slide along
                                                        const edge =
                                                            best.which === 'aEdge'
                                                                ? best.aEdge
                                                                : best.bEdge;
                                                        const ex = edge.bx - edge.ax;
                                                        const ey = edge.by - edge.ay;
                                                        const len = Math.hypot(ex, ey) || 1;
                                                        const dir = { x: ex / len, y: ey / len };

                                                        // desired delta from foundPos to target
                                                        const dx = targetPos.x - foundPos.x;
                                                        const dy = targetPos.y - foundPos.y;
                                                        // projection onto edge direction
                                                        const proj = dx * dir.x + dy * dir.y;
                                                        // if projection negative, allow sliding opposite direction as well
                                                        // attempt to move along dir by proj, but clamp to non-overlap via binary search
                                                        const maxMove = Math.abs(proj);
                                                        if (maxMove > 1e-3) {
                                                            let loS = 0;
                                                            let hiS = maxMove;
                                                            // binary search on scalar magnitude
                                                            for (let it = 0; it < 18; it++) {
                                                                const midS = (loS + hiS) / 2;
                                                                const sign = proj >= 0 ? 1 : -1;
                                                                const nx =
                                                                    foundPos.x +
                                                                    dir.x * midS * sign;
                                                                const ny =
                                                                    foundPos.y +
                                                                    dir.y * midS * sign;
                                                                const ov = overlapAt(nx, ny);
                                                                if (ov > 0) {
                                                                    // overlapping, reduce move
                                                                    hiS = midS;
                                                                } else {
                                                                    loS = midS;
                                                                }
                                                            }
                                                            const finalS =
                                                                loS * (proj >= 0 ? 1 : -1);
                                                            foundPos = {
                                                                x: foundPos.x + dir.x * finalS,
                                                                y: foundPos.y + dir.y * finalS,
                                                            };
                                                        }
                                                    }
                                                } catch {
                                                    // ignore sliding failure and fallback to foundPos
                                                }
                                            } else if (safeOverlap <= 0 && targetOverlap <= 0) {
                                                // both safe and target have no overlap -> accept target
                                                foundPos = targetPos;
                                            } else {
                                                // fallback: just use safe
                                                foundPos = startPos;
                                            }

                                            groupRefs.current[p.id].position({
                                                x: foundPos.x,
                                                y: foundPos.y,
                                            });
                                            // 同步 store（确保状态一致）
                                            updatePiece(p.id, {
                                                x: foundPos.x,
                                                y: foundPos.y,
                                            });
                                            lastSafePos.current[p.id] = foundPos;
                                        }
                                    } else {
                                        console.log('allowed', p.id);
                                        // 允许：更新位置并记录为新的安全点
                                        updatePiece(p.id, { x: newX, y: newY });
                                        lastSafePos.current[p.id] = { x: newX, y: newY };
                                    }
                                }}
                                onDragEnd={(e) => {
                                    const pieceAfter = { ...p, x: e.target.x(), y: e.target.y() };
                                    const targets = (selectedProblemTargets as any) ?? [];
                                    const snap = findSnapForPiece(pieceAfter, targets);
                                    if (snap) {
                                        updatePiece(p.id, {
                                            x: snap.x,
                                            y: snap.y,
                                            rotation: snap.rotation,
                                            placed: true,
                                        });
                                        const pct = computeCoverage(pieces, offsetTarget, 200, 160);
                                        setCoverage(pct);
                                    } else {
                                        updatePiece(p.id, {
                                            placed: false,
                                            x: e.target.x(),
                                            y: e.target.y(),
                                        });
                                        const pct = computeCoverage(pieces, offsetTarget, 200, 160);
                                        setCoverage(pct);
                                    }
                                }}
                            >
                                <Line points={p.points} fill={p.color} closed shadowBlur={6} />
                                <Text
                                    key={`label-${p.id}`}
                                    text={circled[p.id - 1]}
                                    fontSize={26}
                                    fill={'#000'}
                                    x={p.centerX ?? 0}
                                    y={p.centerY ?? 0}
                                    offsetX={13}
                                    offsetY={13}
                                    rotation={-p.rotation}
                                    onClick={() => {
                                        const newRot = ((p.rotation || 0) + 45) % 360;
                                        updatePiece(p.id, { rotation: newRot });
                                        const targets = (selectedProblemTargets as any) ?? [];
                                        const pct = computeCoverage(pieces, targets, 200, 160);
                                        setCoverage(pct);
                                    }}
                                    onTap={() => {
                                        const newRot = ((p.rotation || 0) + 45) % 360;
                                        updatePiece(p.id, { rotation: newRot });
                                        const targets = (selectedProblemTargets as any) ?? [];
                                        const pct = computeCoverage(pieces, targets, 200, 160);
                                        setCoverage(pct);
                                    }}
                                />
                            </Group>
                        ))}
                    </Layer>
                </Stage>
            )}
        </>
    );
}
