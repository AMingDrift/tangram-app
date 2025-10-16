import type Konva from 'konva';

import React, { useEffect, useRef } from 'react';
import { Group, Layer, Line, Stage, Text } from 'react-konva';
import { useShallow } from 'zustand/shallow';

import type { Piece } from '@/lib/tangramUtils';

import {
    calculateOverlapArea,
    checkCollisionsForPiece,
    computeCoverage,
    defaultTangram,
    DESIRED_RADIO,
    findSnapForPiece,
    getEdgesFromPoints,
    getTransformedPoints,
    placePiecesInRightArea,
} from '@/lib/tangramUtils';
import { useTangramStore } from '@/stores/tangramStore';

export default function CanvasStage() {
    const {
        pieces,
        setPieces,
        size,
        updatePiece,
        bringPieceToTop,
        setCoverage,
        targetPieces,
        selectedProblemTargets,
        drafts,
        selectedProblem,
    } = useTangramStore(
        useShallow((state) => ({
            pieces: state.pieces,
            setPieces: state.setPieces,
            size: state.size,
            updatePiece: state.updatePiece,
            bringPieceToTop: state.bringPieceToTop,
            setCoverage: state.setCoverage,
            targetPieces: state.targetPieces,
            selectedProblemTargets: state.problemTargets[state.selectedProblem] ?? null,
            drafts: state.drafts,
            selectedProblem: state.selectedProblem,
        })),
    );

    const groupRefs = useRef<Record<number, any>>({});
    // 保存每个 piece 的上一次安全位置（用于实时拖拽时回退）
    const lastSafePos = useRef<Record<number, { x: number; y: number }>>({});

    const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

    const otherPtsRef = useRef<number[][]>([]);
    // record if a piece is currently in an "allowed overlap" state (overlap fraction >= allowThreshold)
    const overlappedRef = useRef<Record<number, boolean>>({});
    const stageRef = useRef<Konva.Stage | null>(null);
    // scale certain pixel constants by root font-size so rem changes affect behaviour
    const rootFs =
        typeof window !== 'undefined'
            ? Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
            : 16;
    const REM_BASE = 16;
    const scale = rootFs / REM_BASE;
    // Adjust text scale separately to avoid excessive enlargement on very large screens
    // Allow modest growth for large displays but clamp to reasonable bounds.
    const textScale = (() => {
        const base = scale;
        const w = size.width || 0;
        // extra growth for very large screens (>= 1920px), up to +0.5
        const screenExtra = Math.min(Math.max((w - 1920) / 1920, 0), 0.5);
        const maxScale = 1.2 + screenExtra; // allow slightly larger than 1.2 on big screens
        const minScale = 0.75;
        return Math.max(minScale, Math.min(base, maxScale));
    })();

    // offsetTarget contains real pixel coordinates for the target shapes (do not transform them here)

    // 吸边常量（以 px 为基准，但随 root font-size 缩放）
    const SNAP_DIST = 20; // 可调整
    // 吸边时允许的最大覆盖比（当 candidate 的总覆盖 / piece.area <= SNAP_ALLOW_THRESHOLD 时，仍允许吸附）
    const SNAP_ALLOW_THRESHOLD = 0.01; // 1% of piece area
    // 接触容差（随缩放）
    const CONTACT_EPS = 0.5 * scale;

    // project point P onto segment AB, return closest point and t (0..1)
    const projectPointOntoSegment = (
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
        return { x: cx, y: cy, t };
    };

    // 尝试对单个 piece 执行吸边（点->边、边->边），成功返回 true 并已应用位置
    const attemptSnap = (p: Piece, newX: number, newY: number, movedPts: number[]) => {
        const aEdges = getEdgesFromPoints(movedPts);
        let snapped = false;

        // Early exit: if already overlapping beyond threshold, skip snap logic
        let overlapSum = 0;
        for (const op of otherPtsRef.current) {
            overlapSum += calculateOverlapArea(movedPts, op);
        }
        const movingArea = p.area || 1;
        const overlapFrac = overlapSum / movingArea;
        if (overlapFrac > SNAP_ALLOW_THRESHOLD) {
            return false;
        }

        // vertex -> edge
        for (let vi = 0; vi < movedPts.length && !snapped; vi += 2) {
            const vx = movedPts[vi];
            const vy = movedPts[vi + 1];
            for (const opPts of otherPtsRef.current) {
                const otherEdges = getEdgesFromPoints(opPts);
                for (const be of otherEdges) {
                    const proj = projectPointOntoSegment(vx, vy, be.ax, be.ay, be.bx, be.by);
                    const dist = Math.hypot(vx - proj.x, vy - proj.y);
                    if (dist <= SNAP_DIST) {
                        const dx = proj.x - vx;
                        const dy = proj.y - vy;
                        const candX = newX + dx;
                        const candY = newY + dy;
                        const candPiece = { ...p, x: candX, y: candY };
                        const candPts = getTransformedPoints(candPiece);
                        // compute overlap fraction for candidate and allow snap if small
                        let candOverlapSum = 0;
                        for (const op of otherPtsRef.current) {
                            candOverlapSum += calculateOverlapArea(candPts, op);
                        }
                        const candArea = p.area || 1;
                        const candOverlapFrac = candOverlapSum / candArea;
                        if (candOverlapFrac <= SNAP_ALLOW_THRESHOLD) {
                            groupRefs.current[p.id].position({ x: candX, y: candY });
                            updatePiece(p.id, { x: candX, y: candY });
                            lastSafePos.current[p.id] = { x: candX, y: candY };
                            snapped = true;
                            break;
                        }
                    }
                }
                if (snapped) break;
            }
        }

        // edge -> edge
        if (!snapped) {
            for (const ae of aEdges) {
                if (snapped) break;
                const amidx = (ae.ax + ae.bx) / 2;
                const amidy = (ae.ay + ae.by) / 2;
                for (const opPts of otherPtsRef.current) {
                    const otherEdges = getEdgesFromPoints(opPts);
                    for (const be of otherEdges) {
                        const proj = projectPointOntoSegment(
                            amidx,
                            amidy,
                            be.ax,
                            be.ay,
                            be.bx,
                            be.by,
                        );
                        const dist = Math.hypot(amidx - proj.x, amidy - proj.y);
                        if (dist <= SNAP_DIST) {
                            const dx = proj.x - amidx;
                            const dy = proj.y - amidy;
                            const candX = newX + dx;
                            const candY = newY + dy;
                            const candPiece = { ...p, x: candX, y: candY };
                            const candPts = getTransformedPoints(candPiece);
                            let candOverlapSum = 0;
                            for (const op of otherPtsRef.current) {
                                candOverlapSum += calculateOverlapArea(candPts, op);
                            }
                            const candArea = p.area || 1;
                            const candOverlapFrac = candOverlapSum / candArea;
                            if (candOverlapFrac <= SNAP_ALLOW_THRESHOLD) {
                                groupRefs.current[p.id].position({ x: candX, y: candY });
                                updatePiece(p.id, { x: candX, y: candY });
                                lastSafePos.current[p.id] = { x: candX, y: candY };
                                snapped = true;
                                break;
                            }
                        }
                    }
                    if (snapped) break;
                }
            }
        }

        return snapped;
    };

    // helpers for snapping
    const touchDataRef = useRef({
        lastDist: 0,
        lastCenter: { x: 0, y: 0 },
    });
    // 鼠标与触摸平移相关 refs
    const isPanningRef = useRef(false);
    const lastPanPosition = useRef<{ x: number; y: number } | null>(null);
    const touchPanningRef = useRef(false);
    const lastTouchPosRef = useRef<{ x: number; y: number } | null>(null);

    const OVERLAP_THRESHOLD = 0.5;

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

    // Fit targetPieces into left 60% area by adjusting stage scale and position.
    // Display size is chosen as the larger of:
    //  - 66% of canvas height, and
    //  - 66% of left-area width (left area = 60% of canvas width)
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const tp = targetPieces || [];
        // allow empty targetPieces: we'll still initialize the stage and place default tangram
        const hasTargets = Array.isArray(tp) && tp.length > 0;
        // compute bbox in pixel coordinates. If no targets, fall back to a neutral bbox around origin.
        const allPts = tp.flatMap((t: any) => (t && Array.isArray(t.points) ? t.points : []));
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        if (hasTargets && allPts.length >= 2) {
            for (let i = 0; i < allPts.length; i += 2) {
                const x = allPts[i];
                const y = allPts[i + 1];
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        } else {
            // no targets: use a small default bbox to allow scale/position calc to continue
            minX = 0;
            minY = 0;
            maxX = 1;
            maxY = 1;
        }

        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);

        const leftAreaW = (size.width || 0) * 0.6;
        const leftAreaH = size.height || bboxH;

        // desired display sizes
        const desiredByHeight = (size.height || 0) * DESIRED_RADIO; // 66% of page height
        const desiredByLeftWidth = leftAreaW * DESIRED_RADIO; // 66% of left-area width

        // choose the larger target display dimension and compute uniform scale
        const targetDisplay = Math.max(desiredByHeight, desiredByLeftWidth);

        // scale needed so that larger bbox dimension maps to targetDisplay
        const scaleForW = targetDisplay / bboxW;
        const scaleForH = targetDisplay / bboxH;
        // choose the smaller scale so that both dimensions fit into targetDisplay box
        const chosenScale = Math.min(scaleForW, scaleForH);
        // If there are no target pieces, fall back to a neutral scale of 1 so pieces are not blown up
        const finalScale = hasTargets ? Math.max(0.0001, chosenScale * 0.95) : 1;

        // compute centers (when no targets, bbox center defaults to 0 so stage centers sensibly)
        const bboxCenterX = hasTargets ? (minX + maxX) / 2 : 0;
        const bboxCenterY = hasTargets ? (minY + maxY) / 2 : 0;
        const leftCenterX = leftAreaW / 2;
        const centerY = (leftAreaH || 0) / 2;

        // default stage transform (for targets -> left area)
        let stageX = leftCenterX - bboxCenterX * finalScale;
        let stageY = centerY - bboxCenterY * finalScale;
        let stageScale = finalScale;

        // compute initial pieces layout for the right 40% area and center them there
        const originPieces = defaultTangram();

        // If there is no targets (creation mode or empty problem), compute a stage transform
        // that fits the originPieces into the right 40% area such that their bbox occupies
        // ~60% of the right area's width/height. This prevents pieces from appearing too small.
        if (!hasTargets) {
            // compute bbox / center of origin pieces in world coordinates
            let pminX = Infinity;
            let pminY = Infinity;
            let pmaxX = -Infinity;
            let pmaxY = -Infinity;
            for (const op of originPieces) {
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

            // right area screen center (screen coordinates)
            const rightAreaLeft = leftAreaW;
            const rightAreaW = (size.width || 0) - rightAreaLeft;
            const rightCenterScreenX = rightAreaLeft + rightAreaW / 2;
            const rightCenterScreenY = centerY;

            // desired display size inside right area = 60% of that area's width/height
            const desiredByHeight = (size.height || 0) * 0.6;
            const desiredByWidth = rightAreaW * 0.6;
            const targetDisplay = Math.max(desiredByHeight, desiredByWidth);

            const bboxW = Math.max(1, pmaxX - pminX);
            const bboxH = Math.max(1, pmaxY - pminY);

            const scaleForW = targetDisplay / bboxW;
            const scaleForH = targetDisplay / bboxH;
            const chosenScalePieces = Math.min(scaleForW, scaleForH);
            const finalScalePieces = Math.max(0.0001, chosenScalePieces * 0.95);

            // set stage transform so that pieces bbox center maps to right-area center
            stageScale = finalScalePieces;
            stageX = rightCenterScreenX - piecesCenterX * stageScale;
            stageY = rightCenterScreenY - piecesCenterY * stageScale;

            // Use helper to position pieces using the computed stage transform
            try {
                if (drafts[selectedProblem]) {
                    setPieces(drafts[selectedProblem]);
                } else {
                    const placed = placePiecesInRightArea(
                        originPieces,
                        {
                            width: size.width || 0,
                            height: size.height || 0,
                        },
                        { x: stageX, y: stageY, scale: stageScale },
                    );
                    setPieces(placed);
                }
            } catch {
                // fallback: manual offset
                const desiredWorldCenterX = (rightCenterScreenX - stageX) / stageScale;
                const desiredWorldCenterY = (rightCenterScreenY - stageY) / stageScale;
                const offsetX = desiredWorldCenterX - piecesCenterX;
                const offsetY = desiredWorldCenterY - piecesCenterY;
                const piecesForRight = originPieces.map((p) => ({
                    ...p,
                    x: (p.x || 0) + offsetX,
                    y: (p.y || 0) + offsetY,
                }));
                setPieces(piecesForRight);
            }
        } else {
            // has targets: keep existing behavior (center originPieces into right area using
            // the stage transform computed for the left-area targets)
            try {
                if (drafts[selectedProblem]) {
                    setPieces(drafts[selectedProblem]);
                } else {
                    const placed = placePiecesInRightArea(
                        originPieces,
                        {
                            width: size.width || 0,
                            height: size.height || 0,
                        },
                        { x: stageX, y: stageY, scale: stageScale },
                    );
                    setPieces(placed);
                }
            } catch {
                // fallback manual offset based on previously computed stageX/stageScale
                // compute bbox / center of origin pieces in world coordinates
                let pminX = Infinity;
                let pminY = Infinity;
                let pmaxX = -Infinity;
                let pmaxY = -Infinity;
                for (const op of originPieces) {
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
                const rightAreaLeft = leftAreaW;
                const rightAreaW = (size.width || 0) - rightAreaLeft;
                const rightCenterScreenX = rightAreaLeft + rightAreaW / 2;
                const rightCenterScreenY = centerY;
                const desiredWorldCenterX = (rightCenterScreenX - stageX) / stageScale;
                const desiredWorldCenterY = (rightCenterScreenY - stageY) / stageScale;
                const offsetX = desiredWorldCenterX - piecesCenterX;
                const offsetY = desiredWorldCenterY - piecesCenterY;
                const piecesForRight = originPieces.map((p) => ({
                    ...p,
                    x: (p.x || 0) + offsetX,
                    y: (p.y || 0) + offsetY,
                }));
                setPieces(piecesForRight);
            }
        }

        // finally apply computed stage transform
        stage.scale({ x: stageScale, y: stageScale });
        stage.position({ x: stageX, y: stageY });
        stage.batchDraw();
    }, [targetPieces, size]);

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
                        {/* Render targetPieces directly (they store real pixel positions) */}
                        {targetPieces.map((p: any) => (
                            <Line key={p.id} points={p.points} fill="black" closed opacity={0.25} />
                        ))}

                        {/* Render pieces directly; pieces.x/y should already be real pixel positions */}
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
                                    otherPtsRef.current = pieces
                                        .filter((op) => op.id !== p.id)
                                        .map((op) => getTransformedPoints(op));
                                    // detect if piece is already overlapping others beyond allowThreshold
                                    try {
                                        const pts = getTransformedPoints(p);
                                        let sum = 0;
                                        for (const op of otherPtsRef.current) {
                                            sum += calculateOverlapArea(pts, op);
                                        }
                                        const area = p.area || 1;
                                        const frac = sum / area;
                                        // use same allow threshold as collision check (OVERLAP_THRESHOLD)
                                        overlappedRef.current[p.id] = frac >= OVERLAP_THRESHOLD;
                                    } catch {
                                        overlappedRef.current[p.id] = false;
                                    }
                                }}
                                onDragMove={(e) => {
                                    const newX = e.target.x();
                                    const newY = e.target.y();

                                    // 计算当前拖动后的 world points（不修改原 piece）
                                    const tempPiece = { ...p, x: newX, y: newY };
                                    const movedPts = getTransformedPoints(tempPiece);

                                    // compute overlap fraction for moved position
                                    let overlapSum = 0;
                                    for (const op of otherPtsRef.current) {
                                        overlapSum += calculateOverlapArea(movedPts, op);
                                    }
                                    const movingArea = p.area || 1;
                                    const overlapFrac = overlapSum / movingArea;

                                    // if currently in allowed-overlap state, skip collision/edge-sliding logic
                                    if (
                                        overlappedRef.current[p.id] ||
                                        overlapFrac >= OVERLAP_THRESHOLD
                                    ) {
                                        // mark overlapped mode
                                        overlappedRef.current[p.id] =
                                            overlapFrac >= OVERLAP_THRESHOLD;
                                        // allow free movement while overlapped and record as last safe
                                        updatePiece(p.id, { x: newX, y: newY });
                                        lastSafePos.current[p.id] = { x: newX, y: newY };
                                        return;
                                    }

                                    // --- 吸边 (snap) 逻辑: 在正式 collision check 前尝试吸附 ---
                                    try {
                                        if (attemptSnap(p, newX, newY, movedPts)) return;
                                    } catch {
                                        // ignore snap errors and proceed to normal collision handling
                                        // snap error ignored
                                    }

                                    // 使用 SAT.js 检查是否存在阻止性碰撞
                                    const blocked = checkCollisionsForPiece(
                                        movedPts,
                                        otherPtsRef.current,
                                        pieces.find((pc) => pc.id === p.id)?.area || 0,
                                        OVERLAP_THRESHOLD,
                                    );
                                    if (blocked) {
                                        // 阻止：把 konva node 回退到上次安全位置
                                        const safe = lastSafePos.current[p.id];
                                        if (safe && groupRefs.current[p.id]) {
                                            // 尝试寻找从 safe -> 当前移动点之间的最近不重叠点
                                            const targetPos = { x: newX, y: newY };
                                            const startPos = { x: safe.x, y: safe.y };

                                            // helper: compute overlap sum against all other pieces
                                            const overlapAt = (x: number, y: number) => {
                                                const candidate = { ...p, x, y };
                                                const candPts = getTransformedPoints(candidate);
                                                let sum = 0;
                                                for (const op of otherPtsRef.current) {
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
                                                // binary search on t in [0,1], where pos = start + t*(target-start)
                                                let lo = 0;
                                                let hi = 1;
                                                // Do a limited number of iterations for performance
                                                for (let iter = 0; iter < 24; iter++) {
                                                    const mid = (lo + hi) / 2;
                                                    const mx =
                                                        startPos.x +
                                                        (targetPos.x - startPos.x) * mid;
                                                    const my =
                                                        startPos.y +
                                                        (targetPos.y - startPos.y) * mid;
                                                    const ov = overlapAt(mx, my);
                                                    if (ov > 0) {
                                                        // mid is still overlapping, move hi to mid (we want closest non-overlap to target)
                                                        hi = mid;
                                                    } else {
                                                        // no overlap here, move lo to mid to get closer to target
                                                        lo = mid;
                                                    }
                                                }
                                                const t = lo;
                                                foundPos = {
                                                    x: startPos.x + (targetPos.x - startPos.x) * t,
                                                    y: startPos.y + (targetPos.y - startPos.y) * t,
                                                };

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
                                                        const dir = {
                                                            x: ex / len,
                                                            y: ey / len,
                                                        };

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
                                        // 允许：更新位置并记录为新的安全点
                                        updatePiece(p.id, { x: newX, y: newY });
                                        lastSafePos.current[p.id] = { x: newX, y: newY };
                                    }
                                }}
                                onDragEnd={(e) => {
                                    const pieceAfter = {
                                        ...p,
                                        x: e.target.x(),
                                        y: e.target.y(),
                                    };
                                    const targets = (selectedProblemTargets as any) ?? [];
                                    const snap = findSnapForPiece(pieceAfter, targets);
                                    if (snap) {
                                        updatePiece(p.id, {
                                            x: snap.x,
                                            y: snap.y,
                                            rotation: snap.rotation,
                                            placed: true,
                                        });
                                        const pct = computeCoverage(pieces, targetPieces, 200, 160);
                                        setCoverage(pct);
                                    } else {
                                        updatePiece(p.id, {
                                            placed: false,
                                            x: e.target.x(),
                                            y: e.target.y(),
                                        });
                                        const pct = computeCoverage(pieces, targetPieces, 200, 160);
                                        setCoverage(pct);
                                    }
                                }}
                            >
                                <Line points={p.points} fill={p.color} closed shadowBlur={6} />
                                <Text
                                    key={`label-${p.id}`}
                                    text={circled[p.id - 1]}
                                    fontSize={26 * textScale}
                                    fill={'#000'}
                                    x={p.centerX ?? 0}
                                    y={p.centerY ?? 0}
                                    offsetX={13 * textScale}
                                    offsetY={13 * textScale}
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
