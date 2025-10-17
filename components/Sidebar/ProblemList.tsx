'use client';

import Image from 'next/image';
import React from 'react';

import type { Piece } from '@/lib/tangramUtils';

import { useTangramStore } from '@/stores/tangramStore';

interface ProblemItem {
    id: string;
    title: string;
}

export default function ProblemList(props: {
    problems: ProblemItem[];
    selectedProblem: string;
    creating: boolean;
    pieces: Piece[];
    drafts: Record<string, Piece[]> | undefined;
    thumbnails: Record<string, string>;
    setDraftForProblem: (id: string, pieces: Piece[]) => void;
    clearDraftForProblem: (id: string) => void;
    setSelectedProblem: (id: string) => void;
    setPieces: (pieces: Piece[]) => void;
    setCoverage: (n: number) => void;
    computeCoverage: (
        p: Piece[],
        t: { id: number; points: number[] }[],
        w: number,
        h: number,
    ) => number;
    defaultTangram: () => Piece[];
    getTransformedPoints: (p: Piece) => number[];
    computeStageTransformForPiecesRightArea: (size: any, pieces: Piece[], scale: number) => any;
    computeStageTransformForTargets: (size: any, targets: any[]) => any;
    placePiecesInRightArea: (pieces: Piece[], size: any, stageTransform?: any) => Piece[];
    targetPieces: { id: number; points: number[] }[];
}) {
    const {
        problems,
        selectedProblem,
        creating,
        pieces,
        drafts,
        thumbnails,
        setDraftForProblem,
        clearDraftForProblem,
        setSelectedProblem,
        setPieces,
        setCoverage,
        computeCoverage,
        defaultTangram,
        getTransformedPoints,
        computeStageTransformForPiecesRightArea,
        computeStageTransformForTargets,
        placePiecesInRightArea,
        targetPieces,
    } = props;

    return (
        <div className="flex h-full flex-col">
            <h3 className="my-3 text-[1.125rem] font-medium">题目列表</h3>
            <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto">
                {problems.map((pb: ProblemItem) => (
                    <div
                        key={pb.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                            if (creating) return;
                            if (pb.id === selectedProblem) return;
                            try {
                                if (selectedProblem && selectedProblem !== '') {
                                    try {
                                        if (pieces && pieces.length > 0) {
                                            setDraftForProblem(selectedProblem, pieces);
                                        } else {
                                            clearDraftForProblem(selectedProblem);
                                        }
                                    } catch (e) {
                                        console.warn('保存草稿失败', e);
                                    }
                                }

                                setSelectedProblem(pb.id);

                                const hasDraft =
                                    Array.isArray(drafts?.[pb.id]) && drafts[pb.id].length > 0;
                                let finalPieces: Piece[] = [];
                                if (hasDraft) {
                                    finalPieces = drafts[pb.id];
                                    setPieces(finalPieces);
                                } else {
                                    try {
                                        const originPieces = defaultTangram();
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
                                        const st = useTangramStore.getState();
                                        const selTargets =
                                            st.problemTargets[st.selectedProblem] || [];
                                        const stageTransform =
                                            selTargets.length === 0
                                                ? computeStageTransformForPiecesRightArea(
                                                      st.size || { width: 0, height: 0 },
                                                      originPieces,
                                                      0.6,
                                                  )
                                                : computeStageTransformForTargets(
                                                      st.size || { width: 0, height: 0 },
                                                      selTargets,
                                                  );
                                        const piecesForRight = placePiecesInRightArea(
                                            originPieces,
                                            st.size || { width: 0, height: 0 },
                                            stageTransform,
                                        );
                                        finalPieces = piecesForRight;
                                        setPieces(piecesForRight);
                                    } catch {
                                        finalPieces = defaultTangram();
                                        try {
                                            finalPieces = placePiecesInRightArea(
                                                finalPieces,
                                                useTangramStore.getState().size,
                                            );
                                        } catch {
                                            // ignore
                                        }
                                        setPieces(finalPieces);
                                    }
                                }

                                const targets =
                                    targetPieces && targetPieces.length > 0 ? targetPieces : [];
                                if (!finalPieces || finalPieces.length === 0) {
                                    finalPieces = useTangramStore.getState().pieces || [];
                                }
                                const pct = computeCoverage(finalPieces, targets, 200, 160);
                                setCoverage(pct);
                            } catch (err) {
                                console.error('切换题目失败', err);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                (e.target as HTMLElement).click();
                            }
                        }}
                        className={`flex h-[4.8rem] w-[calc(var(--sidebar-width)-2.6rem)] max-w-full cursor-pointer items-center rounded-lg border-2 p-2 text-left transition-colors ${
                            pb.id === selectedProblem
                                ? 'border-sky-500 bg-sky-50'
                                : 'border-gray-300 bg-white hover:bg-gray-100'
                        } ${creating ? 'cursor-not-allowed! opacity-50' : ''}`}
                    >
                        <div className="flex w-full items-center gap-2">
                            <div className="h-14 w-18 flex-none overflow-hidden rounded-lg border border-gray-300 bg-white">
                                {thumbnails[pb.id] ? (
                                    <Image
                                        width={200}
                                        height={200}
                                        src={thumbnails[pb.id]}
                                        alt={pb.title}
                                        unoptimized
                                        className="block h-full w-full object-contain"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                        预览
                                    </div>
                                )}
                            </div>
                            <div className="w-full min-w-0 flex-1">
                                <div className="truncate font-semibold">{pb.title}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
