'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Group, Text } from 'react-konva';
import Fireworks from './Fireworks';
import _ from 'lodash';

type Piece = {
    id: number;
    points: number[]; // local points
    color: string;
    x: number;
    y: number;
    rotation: number;
    placed?: boolean;
    centerX?: number;
    centerY?: number;
};

const GRID_CELL = 100;
const SIZE = 300;
const SIDEBAR_WIDTH = 260;

const mockTarget = [
    // 1 大三角 - top big triangle (red)
    {
        id: 1,
        points: [-1, -1, 3, -1, 1, 1],
    },
    // 2 大三角 - left big triangle (orange)
    {
        id: 2,
        points: [0, 0, 2, 2, 0, 4],
    },
    // 3 小三角 - top-right small triangle (cyan)
    {
        id: 3,
        points: [4, 0, 4, 2, 3, 1],
    },
    // 4 正方形(菱形) - diamond (green)
    {
        id: 4,
        points: [2, 2, 3, 1, 4, 2, 3, 3],
    },
    // 5 小三角 - center small triangle (pink)
    {
        id: 5,
        points: [2, 2, 3, 3, 1, 3],
    },
    // 6 平行四边形 - bottom-left parallelogram (purple)
    {
        id: 6,
        points: [1, 3, 3, 3, 2, 4, 0, 4],
    },
    // 7 中三角 - bottom-right triangle (yellow)
    {
        id: 7,
        points: [4, 2, 4, 4, 2, 4],
    },
].map(p => ({
    ...p,
    points: p.points.map(pi => pi * GRID_CELL),
}));

const alignCenter = (allPoints: number[], size: { width: number; height: number }) => {
    // 找出最小和最大的 x、y 值
    let minX = Infinity,
        minY = Infinity;
    let maxX = -Infinity,
        maxY = -Infinity;

    for (let i = 0; i < allPoints.length; i += 2) {
        const x = allPoints[i];
        const y = allPoints[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    // 计算包围盒的中心点
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 计算 canvas 的中心点
    const canvasCenterX = size.width / 2;
    const canvasCenterY = size.height / 2;

    // 计算需要的偏移量
    const offsetX = canvasCenterX - centerX;
    const offsetY = canvasCenterY - centerY;
    return [offsetX, offsetY];
};

const defaultPieces = (stageW: number, stageH: number): Piece[] => {
    // base square size and center for the target composition
    const size = SIZE;
    // global adjustment to nudge the whole composition slightly left and down
    const offsetX = -2 * GRID_CELL; // negative -> move left
    const offsetY = 4.5 * GRID_CELL; // positive -> move down
    const left = stageW / 2 - size / 2; // top-left x of composition
    const top = stageH / 2 - size / 2; // top-left y of composition

    // palette initial x on right side
    const px = stageW - 130;

    return [
        // 1 大三角 - top big triangle (red)
        {
            id: 1,
            points: [0, 0, 4, 0, 2, 2],
            color: '#c62828',
            // start in palette on the right
            x: 0,
            y: -1,
            rotation: 0,
            placed: false,
            centerX: 2,
            centerY: 1,
        },
        // 2 大三角 - left big triangle (orange)
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
        // 3 小三角 - top-right small triangle (cyan)
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
        // 4 正方形(菱形) - diamond (green)
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
        // 5 小三角 - center small triangle (pink)
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
        // 6 平行四边形 - bottom-left parallelogram (purple)
        {
            id: 6,
            // parallelogram shape: top-left, top-right, bottom-right, bottom-left
            points: [1, 3, 3, 3, 2, 4, 0, 4],
            color: '#7e57c2',
            x: -0.5,
            y: 1.5,
            rotation: 0,
            placed: false,
            centerX: 1.5,
            centerY: 3.5,
        },
        // 7 中三角 - bottom-right triangle (yellow)
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
    ].map(p => ({
        ...p,
        x: p.x * GRID_CELL + offsetX + px,
        y: p.y * GRID_CELL + offsetY,
        points: p.points.map(pi => pi * GRID_CELL),
        centerX: p.centerX * GRID_CELL,
        centerY: p.centerY * GRID_CELL,
    }));
};

const distance = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);

export default function TangramCanvas() {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [showFireworks, setShowFireworks] = useState(false);
    const groupRefs = useRef<Record<number, any>>({});

    const allPoints = mockTarget.flatMap(p => p.points);
    const [offsetX, offsetY] = alignCenter(allPoints, { ...size, width: size.width - 300 });
    const offsetTarget = mockTarget.map(p => ({
        ...p,
        points: p.points.map((pi, i) => pi + [offsetX, offsetY][i % 2]),
    }));

    useEffect(() => {
        const handleResize = () =>
            setSize({ width: window.innerWidth - SIDEBAR_WIDTH, height: window.innerHeight });
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (size.width && size.height) {
            setPieces(defaultPieces(size.width, size.height));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size.width, size.height]);

    useEffect(() => {
        if (pieces.length === 0) return;
        const allPlaced = pieces.every(p => p.placed === true);
        setShowFireworks(allPlaced);
    }, [pieces]);

    const updatePiece = (id: number, patch: Partial<Piece>) => {
        setPieces(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
    };

    const handleDragEnd = (e: any, piece: Piece) => {
        const newX = e.target.x();
        const newY = e.target.y();
        const rot = piece.rotation;

        // First: snap to grid if close
        const GRID = GRID_CELL / 2;
        const GRID_SNAP = GRID / 2; // pixels threshold to snap to grid line
        const nearestGridX = Math.round(newX / GRID) * GRID;
        const nearestGridY = Math.round(newY / GRID) * GRID;

        let snappedX = newX;
        let snappedY = newY;
        if (Math.abs(newX - nearestGridX) <= GRID_SNAP) snappedX = nearestGridX;
        if (Math.abs(newY - nearestGridY) <= GRID_SNAP) snappedY = nearestGridY;

        // // compute target positions for each mockTarget polygon (same alignment as TargetPieces)
        // const allPoints = mockTarget.flatMap(p => p.points);
        // const [tOffsetX, tOffsetY] = alignCenter(allPoints, { ...size, width: size.width - 400 });
        // // target positions: for each mockTarget, center of its bbox after offset
        // const targets: Record<number, { x: number; y: number; rotation: number }> = {};
        // for (const mt of mockTarget) {
        //     let minX = Infinity,
        //         minY = Infinity,
        //         maxX = -Infinity,
        //         maxY = -Infinity;
        //     for (let i = 0; i < mt.points.length; i += 2) {
        //         const vx = mt.points[i];
        //         const vy = mt.points[i + 1];
        //         if (vx < minX) minX = vx;
        //         if (vy < minY) minY = vy;
        //         if (vx > maxX) maxX = vx;
        //         if (vy > maxY) maxY = vy;
        //     }
        //     const cx = (minX + maxX) / 2 + tOffsetX;
        //     const cy = (minY + maxY) / 2 + tOffsetY;
        //     targets[mt.id] = { x: cx, y: cy, rotation: mt.rotation };
        // }

        // // Then: 检查是否靠近目标（基于 mockTarget centers）
        // const tgt = targets[piece.id];
        // if (tgt) {
        //     const d = distance(snappedX, snappedY, tgt.x, tgt.y);
        //     const rd = Math.abs(((rot - (tgt.rotation || 0) + 540) % 360) - 180); // minimal diff
        //     const snapDistance = 40;
        //     const snapRotation = 20; // degrees tolerance

        //     if (d < snapDistance && rd < snapRotation) {
        //         updatePiece(piece.id, {
        //             x: tgt.x,
        //             y: tgt.y,
        //             rotation: tgt.rotation,
        //             placed: true,
        //         });
        //     } else {
        //         updatePiece(piece.id, { x: snappedX, y: snappedY });
        //     }
        // } else {
        //     updatePiece(piece.id, { x: snappedX, y: snappedY });
        // }
    };

    const handleDragMove = (e: any, piece: Piece) => {
        const newX = e.target.x();
        const newY = e.target.y();
        // update position continuously so labels follow during drag
        updatePiece(piece.id, { x: newX, y: newY });
    };

    // 修改 handleDragStart 函数，添加 moveToTop 逻辑
    const handleDragStart = (e: any, piece: Piece) => {
        // bring this piece to the end of the array so it renders on top
        setPieces(prev => {
            const found = prev.find(p => p.id === piece.id);
            if (!found) return prev;
            const others = prev.filter(p => p.id !== piece.id);
            return [...others, found];
        });
    };

    const handleLabelClick = (e: any, piece: Piece) => {
        // 旋转45度
        const newRot = (piece.rotation + 45) % 360;
        updatePiece(piece.id, { rotation: newRot });
    };

    const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

    // sample problem list (placeholder titles). Later these can include thumbnails or shape data.
    const problems = [
        { id: 1, title: '正方形（默认）' },
        { id: 2, title: '房子' },
        { id: 3, title: '船' },
        { id: 4, title: '菱形' },
        { id: 5, title: '箭头' },
        { id: 11, title: '正方形（默认）' },
        { id: 21, title: '房子' },
        { id: 31, title: '船' },
        { id: 41, title: '菱形' },
        { id: 51, title: '箭头' },
        { id: 12, title: '正方形（默认）' },
        { id: 22, title: '房子' },
        { id: 32, title: '船' },
        { id: 42, title: '菱形' },
        { id: 52, title: '箭头' },
        { id: 13, title: '正方形（默认）' },
        { id: 23, title: '房子' },
        { id: 33, title: '船' },
    ];
    const [selectedProblem, setSelectedProblem] = useState<number>(1);
    const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
    const [coverage, setCoverage] = useState<number>(0); // percentage 0-100

    // generate thumbnail data URL from target polygons (mockTarget)
    const generateThumbnail = (
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

        // compute bounds of targetPolys
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
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
        if (!isFinite(minX)) return '';

        const pad = 8;
        const contentW = Math.max(1, maxX - minX);
        const contentH = Math.max(1, maxY - minY);
        const scale = Math.min((width - pad * 2) / contentW, (height - pad * 2) / contentH);

        // clear
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;

        // draw each polygon
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

    // regenerate thumbnails when pieces change
    useEffect(() => {
        if (pieces.length === 0) return;
        const url = generateThumbnail(offsetTarget, 160, 120);
        const map: Record<number, string> = {};
        for (const pb of problems) map[pb.id] = url;
        setThumbnails(map);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pieces.length]);

    // compute coverage of target area by current placed pieces (pixel mask comparison)
    const computeCoverage = (
        piecesForCalc: Piece[],
        targetPolys: typeof mockTarget,
        w = 200,
        h = 200,
    ) => {
        if (!piecesForCalc || piecesForCalc.length === 0) return 0;

        // use a small offscreen canvas for speed; scale factor to map world coords into canvas
        const canvasA = document.createElement('canvas');
        const canvasB = document.createElement('canvas');
        canvasA.width = w;
        canvasA.height = h;
        canvasB.width = w;
        canvasB.height = h;
        const a = canvasA.getContext('2d');
        const b = canvasB.getContext('2d');
        if (!a || !b) return 0;

        // determine bounds from targetPolys to fit into canvas
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
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
        if (!isFinite(minX)) return 0;

        const pad = 4; // pixels padding
        const contentW = Math.max(1, maxX - minX);
        const contentH = Math.max(1, maxY - minY);
        const scale = Math.min((w - pad * 2) / contentW, (h - pad * 2) / contentH);

        // draw target mask in canvasA (black filled target)
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

        // draw pieces mask in canvasB (black filled for placed pieces only)
        b.clearRect(0, 0, w, h);
        b.fillStyle = '#000';
        for (const p of piecesForCalc) {
            if (!p) continue;
            // draw using p.points positioned at p.x/p.y with rotation and offset
            const angle = ((p.rotation || 0) * Math.PI) / 180;
            const cosA = Math.cos(angle),
                sinA = Math.sin(angle);
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

        // compare pixel data
        const da = a.getImageData(0, 0, w, h).data;
        const db = b.getImageData(0, 0, w, h).data;
        let targetPixels = 0;
        let coveredPixels = 0;
        for (let i = 0; i < da.length; i += 4) {
            const aOn = da[i + 3] > 0; // alpha > 0 indicates target
            const bOn = db[i + 3] > 0; // alpha > 0 indicates piece present
            if (aOn) targetPixels++;
            if (aOn && bOn) coveredPixels++;
        }
        if (targetPixels === 0) return 0;
        return Math.round((coveredPixels / targetPixels) * 100);
    };

    const debouncedCompute = useRef(
        _.debounce((pieces: Piece[], targetPolys: typeof mockTarget) => {
            const pct = computeCoverage(pieces, targetPolys, 200, 160);
            setCoverage(pct);
        }, 150), // 防抖延迟 150ms
    ).current;

    // recalc coverage whenever pieces or size change
    useEffect(() => {
        if (pieces.length === 0 || size.width === 0) return;

        // 调用防抖函数
        debouncedCompute(pieces, offsetTarget);
    }, [pieces, size.width, size.height]);

    return (
        <div style={{ display: 'flex', width: '100%', height: '100vh', position: 'relative' }}>
            {/* Sidebar */}
            <aside
                style={{
                    width: SIDEBAR_WIDTH,
                    background: '#fafafa',
                    borderRight: '1px solid #e6e6e6',
                    padding: 12,
                    boxSizing: 'border-box',
                    overflow: 'auto',
                    flex: 'none',
                }}
            >
                <h3 style={{ margin: '6px 0 12px' }}>题目列表</h3>
                <div style={{ fontSize: 13, color: '#333', marginBottom: 8 }}>
                    目标覆盖: <strong>{coverage}%</strong>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                    {problems.map(pb => (
                        <button
                            key={pb.id}
                            onClick={() => setSelectedProblem(pb.id)}
                            style={{
                                textAlign: 'left',
                                padding: '8px 10px',
                                borderRadius: 6,
                                border:
                                    pb.id === selectedProblem
                                        ? '2px solid #1976d2'
                                        : '2px solid #e0e0e0',
                                background: pb.id === selectedProblem ? '#e3f2fd' : '#fff',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div
                                    style={{
                                        width: 72,
                                        height: 54,
                                        background: '#f5f5f5',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: 6,
                                        overflow: 'hidden',
                                        flex: '0 0 auto',
                                    }}
                                >
                                    {thumbnails[pb.id] ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={thumbnails[pb.id]}
                                            alt={pb.title}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                display: 'block',
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#aaa',
                                                fontSize: 12,
                                            }}
                                        >
                                            预览
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{pb.title}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main canvas area */}
            <main style={{ flex: 1, position: 'relative' }}>
                {showFireworks && <Fireworks />}
                {size.width > 0 && (
                    <Stage width={size.width} height={size.height}>
                        <Layer>
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
                            {/* 中央的黑色目标形状 - 居中显示 */}
                            {offsetTarget.map(p => {
                                return (
                                    <Line
                                        key={p.id}
                                        points={p.points}
                                        fill="black"
                                        closed
                                        opacity={0.25}
                                    />
                                );
                            })}
                            {/* 已放置/可拖拽的图形（包含右侧调色板位置） */}
                            {pieces.map(p => {
                                const cX = p.centerX ?? 0;
                                const cY = p.centerY ?? 0;

                                return (
                                    <Group
                                        ref={n => {
                                            groupRefs.current[p.id] = n;
                                        }}
                                        key={`piece-${p.id}`}
                                        x={p.x}
                                        y={p.y}
                                        rotation={p.rotation}
                                        offsetX={cX}
                                        offsetY={cY}
                                        draggable
                                        onDragMove={e => handleDragMove(e, p)}
                                        onDragStart={e => handleDragStart(e, p)}
                                        onDragEnd={e => handleDragEnd(e, p)}
                                    >
                                        <Line
                                            points={p.points}
                                            fill={p.color}
                                            closed
                                            shadowBlur={6}
                                            opacity={p.placed ? 1 : 0.9}
                                        />
                                        {/* label inside group: position at group's origin (0,0), cancel group's rotation so text stays upright */}
                                        <Text
                                            key={`label-${p.id}`}
                                            text={circled[p.id - 1]}
                                            fontSize={20}
                                            fill={'#000'}
                                            x={p.centerX ?? 0}
                                            y={p.centerY ?? 0}
                                            offsetX={10}
                                            offsetY={10}
                                            rotation={-p.rotation}
                                            onClick={e => handleLabelClick(e, p)}
                                            onTap={e => handleLabelClick(e, p)}
                                        />
                                    </Group>
                                );
                            })}
                        </Layer>
                    </Stage>
                )}
            </main>
            {/* <div className="absolute top-0 right-0 h-screen w-[500px] flex-none bg-gray-950/30 backdrop-blur-sm"></div> */}
        </div>
    );
}
