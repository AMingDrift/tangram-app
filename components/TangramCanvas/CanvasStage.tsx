'use client';

import React, { useRef } from 'react';
import { Group, Layer, Line, Stage, Text } from 'react-konva';
import { useShallow } from 'zustand/shallow';

import type { Piece } from '@/lib/tangramUtils';

import { computeCoverage, findSnapForPiece, GRID_CELL } from '@/lib/tangramUtils';
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

    const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

    return (
        <>
            {size.width > 0 && (
                <Stage width={size.width} height={size.height}>
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
                                onDragMove={(e) => {
                                    const newX = e.target.x();
                                    const newY = e.target.y();
                                    updatePiece(p.id, { x: newX, y: newY });
                                }}
                                onDragStart={() => {
                                    bringPieceToTop(p.id);
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
