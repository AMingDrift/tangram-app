'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Group, Text } from 'react-konva';
import Fireworks from './Fireworks';

type Piece = {
    id: number;
    points: number[]; // local points
    color: string;
    x: number;
    y: number;
    rotation: number;
    targetX: number;
    targetY: number;
    targetRotation: number;
    placed?: boolean;
    centerX?: number;
    centerY?: number;
};

const GRID_CELL = 100;
const SIZE = 300;
const defaultPieces = (stageW: number, stageH: number): Piece[] => {
    // base square size and center for the target composition
    const size = SIZE;
    // global adjustment to nudge the whole composition slightly left and down
    const offsetX = -3 * GRID_CELL; // negative -> move left
    const offsetY = 4 * GRID_CELL; // positive -> move down
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
            targetX: left + size / 2,
            targetY: top + 0,
            targetRotation: 0,
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
            targetX: left + 0,
            targetY: top + size / 2,
            targetRotation: 0,
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
            targetX: left + size,
            targetY: top + size * 0.16,
            targetRotation: 270,
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
            targetX: left + size * 0.66,
            targetY: top + size * 0.4,
            targetRotation: 45,
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
            targetX: left + size * 0.45,
            targetY: top + size * 0.35,
            targetRotation: 180,
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
            targetX: left + size * 0.25,
            targetY: top + size * 0.6,
            targetRotation: 0,
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
            targetX: left + size * 0.75,
            targetY: top + size * 0.7,
            targetRotation: 0,
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

const rotationDiff = (a: number, b: number) => {
    let diff = Math.abs((a - b) % 360);
    if (diff > 180) diff = 360 - diff;
    return diff;
};

export default function TangramCanvas() {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [showFireworks, setShowFireworks] = useState(false);
    const groupRefs = useRef<Record<number, any>>({});

    useEffect(() => {
        const handleResize = () =>
            setSize({ width: window.innerWidth, height: window.innerHeight });
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

        // Then: 检查是否靠近目标（基于原始 target）
        const d = distance(snappedX, snappedY, piece.targetX, piece.targetY);
        const rd = rotationDiff(rot, piece.targetRotation);
        const snapDistance = 40;
        const snapRotation = 20; // degrees tolerance

        if (d < snapDistance && rd < snapRotation) {
            updatePiece(piece.id, {
                x: piece.targetX,
                y: piece.targetY,
                rotation: piece.targetRotation,
                placed: true,
            });
        } else {
            updatePiece(piece.id, { x: snappedX, y: snappedY });
        }
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

    return (
        <div style={{ width: '100%', height: '100%' }}>
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
                        {/* 中央的黑色目标形状 */}
                        {pieces.map(p => {
                            const cx = p.centerX ?? 0;
                            const cy = p.centerY ?? 0;
                            return (
                                <Group
                                    key={p.id}
                                    x={p.targetX}
                                    y={p.targetY}
                                    rotation={p.targetRotation}
                                    offsetX={cx}
                                    offsetY={cy}
                                >
                                    <Line points={p.points} fill="black" closed opacity={0.25} />
                                    {/* target outline only (no label here) */}
                                </Group>
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
        </div>
    );
}
