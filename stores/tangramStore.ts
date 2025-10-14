import { del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Piece } from '@/lib/tangramUtils';

import {
    computeCoverage,
    defaultTangram,
    generateThumbnail,
    getTransformedPoints,
    GRID_CELL,
} from '@/lib/tangramUtils';

import { tangramIDBStore } from './tangramIDBStore';

// NOTE: This store file is a minimal skeleton to be used as starting point.
// It requires zustand to be installed. We'll keep implementation small and explicit.

export interface Problem {
    id: number;
    title: string;
}

export interface ProblemTarget {
    id: number;
    points: number[];
}

export interface ProblemData {
    id: number;
    title: string;
    targets: ProblemTarget[];
    thumbnail: string;
}

interface TangramState {
    size: { width: number; height: number };
    pieces: Piece[];
    offsetTarget: { id: number; points: number[] }[];
    problems: Problem[];
    problemTargets: Record<number, ProblemTarget[]>;
    thumbnails: Record<number, string>;
    selectedProblem: number;
    creating: boolean;
    coverage: number;
    previousSelectedProblem?: number;

    // actions
    setSize: (s: { width: number; height: number }) => void;
    setPieces: (p: Piece[]) => void;
    setOffsetTarget: (t: { id: number; points: number[] }[]) => void;
    updatePiece: (id: number, patch: Partial<Piece>) => void;
    setProblems: (p: Problem[]) => void;
    setProblemTargets: (map: Record<number, ProblemTarget[]>) => void;
    setThumbnails: (map: Record<number, string>) => void;
    setSelectedProblem: (id: number) => void;
    setCreating: (b: boolean) => void;
    setCoverage: (n: number) => void;
    // creation flow
    startCreation: () => void;
    cancelCreation: () => void;
    saveCreation: (title?: string) => number;
    bringPieceToTop: (id: number) => void;
    // problem management
    importProblemsData: (data: ProblemData[]) => void;
    exportProblemsData: () => string;
    addProblemWithTargets: (title: string | undefined, targetsGrid: ProblemTarget[]) => number;
    deleteProblemById: (id: number) => void;
    editProblemTitle: (id: number, title: string) => void;
    generateMissingThumbnails: (width?: number, height?: number) => void;
}

export type { TangramState };

export const useTangramStore = create<TangramState>()(
    persist(
        (set: any, get: any) =>
            ({
                size: { width: 0, height: 0 },
                pieces: [] as Piece[],
                // offsetTarget stores pixel-space target polygons computed from problemTargets
                offsetTarget: [] as { id: number; points: number[] }[],
                problems: [] as Problem[],
                problemTargets: {} as Record<number, ProblemTarget[]>,
                thumbnails: {} as Record<number, string>,
                selectedProblem: -1,
                creating: false,
                coverage: 0,

                setSize: (s: { width: number; height: number }) => set({ size: s }),
                setPieces: (p: Piece[]) => set({ pieces: p }),
                setOffsetTarget: (t: { id: number; points: number[] }[]) =>
                    set({ offsetTarget: t }),
                updatePiece: (id: number, patch: Partial<Piece>) =>
                    set((state: any) => ({
                        pieces: (state.pieces as Piece[]).map((x) =>
                            x.id === id ? ({ ...x, ...patch } as Piece) : x,
                        ),
                    })),
                setProblems: (p: Problem[]) => set({ problems: p }),
                setProblemTargets: (map: Record<number, ProblemTarget[]>) =>
                    set({ problemTargets: map }),
                setThumbnails: (map: Record<number, string>) => set({ thumbnails: map }),
                setSelectedProblem: (id: number) => set({ selectedProblem: id }),
                setCreating: (b: boolean) => set({ creating: b }),
                setCoverage: (n: number) => set({ coverage: n }),
                // creation flow helpers
                previousSelectedProblem: -1,
                startCreation: () =>
                    set((state: any) => {
                        const prev = state.selectedProblem ?? -1;
                        const pieces = defaultTangram(state.size);
                        return {
                            previousSelectedProblem: prev,
                            creating: true,
                            pieces,
                            selectedProblem: -1,
                        };
                    }),
                cancelCreation: () =>
                    set((state: any) => {
                        const prev = state.previousSelectedProblem ?? -1;
                        const pieces = defaultTangram(state.size);
                        return {
                            creating: false,
                            pieces,
                            selectedProblem: prev,
                            previousSelectedProblem: -1,
                        };
                    }),
                saveCreation: (title?: string) => {
                    const st = (get as any)() as TangramState;
                    const pieces = st.pieces || [];
                    if (!pieces || pieces.length === 0) return -1;

                    // compute pixel-space transformed points for each piece
                    const newTargetsPixels = pieces.map((p: Piece, idx: number) => ({
                        id: idx + 1,
                        points: getTransformedPoints(p),
                    }));

                    // normalize to grid coords for storage
                    const newTargetsGrid = newTargetsPixels.map((t) => ({
                        id: t.id,
                        points: t.points.map((v) => Math.round((v / GRID_CELL) * 100) / 100),
                    }));

                    const newId = (get as any)().addProblemWithTargets(
                        title || undefined,
                        newTargetsGrid,
                    );

                    // reset pieces to default and mark creation finished
                    set((state: any) => ({
                        creating: false,
                        pieces: defaultTangram(state.size),
                        selectedProblem: newId,
                        previousSelectedProblem: -1,
                    }));

                    // compute coverage using pixel targets
                    const pixelTargets = newTargetsGrid.map((t) => ({
                        id: t.id,
                        points: t.points.map((v) => v * GRID_CELL),
                    }));
                    const pct = computeCoverage(pieces, pixelTargets as any, 200, 160);
                    set({ coverage: pct });

                    return newId;
                },
                bringPieceToTop: (id: number) =>
                    set((state: any) => {
                        const found = (state.pieces as Piece[]).find((p: Piece) => p.id === id);
                        if (!found) return {};
                        const others = (state.pieces as Piece[]).filter((p: Piece) => p.id !== id);
                        return { pieces: [...others, found] };
                    }),
                // import problems data from structured array
                importProblemsData: (data: ProblemData[]) =>
                    set((state: any) => {
                        const newProblems = data.map((d) => ({ id: d.id, title: d.title }));
                        const newProblemTargets: Record<number, ProblemTarget[]> = {};
                        const newThumbnails: Record<number, string> = {};
                        data.forEach((d) => {
                            newProblemTargets[d.id] = d.targets;
                            newThumbnails[d.id] = d.thumbnail || '';
                        });
                        const pieces = defaultTangram(state.size);
                        return {
                            problems: newProblems,
                            problemTargets: newProblemTargets,
                            thumbnails: newThumbnails,
                            pieces,
                            selectedProblem: newProblems.length > 0 ? newProblems[0].id : -1,
                        };
                    }),
                exportProblemsData: () => {
                    const st = (get as any)() as TangramState;
                    const problemsData: ProblemData[] = st.problems.map((p) => ({
                        id: p.id,
                        title: p.title,
                        targets: st.problemTargets[p.id] || [],
                        thumbnail: st.thumbnails[p.id] || '',
                    }));
                    return JSON.stringify(problemsData, null, 2);
                },
                addProblemWithTargets: (
                    title: string | undefined,
                    targetsGrid: ProblemTarget[],
                ) => {
                    const st = (get as any)() as TangramState;
                    const newId =
                        st.problems.length > 0 ? Math.max(...st.problems.map((x) => x.id)) + 1 : 1;
                    const newTitle = title || `用户题目 ${newId}`;
                    set((state: any) => ({
                        problems: [
                            ...(state.problems as Problem[]),
                            { id: newId, title: newTitle },
                        ],
                        problemTargets: {
                            ...(state.problemTargets as Record<number, ProblemTarget[]>),
                            [newId]: targetsGrid,
                        },
                    }));
                    // generate thumbnail (convert grid coords to pixels)
                    const pixelForThumb = targetsGrid.map((t) => ({
                        id: t.id,
                        points: t.points.map((v) => v * GRID_CELL),
                    }));
                    const url = generateThumbnail(pixelForThumb, 160, 120);
                    set((state: any) => ({
                        thumbnails: {
                            ...(state.thumbnails as Record<number, string>),
                            [newId]: url,
                        },
                    }));
                    return newId;
                },
                deleteProblemById: (id: number) =>
                    set((state: any) => {
                        const problems: Problem[] = state.problems;
                        const idx = problems.findIndex((p: Problem) => p.id === id);
                        const newProblems = problems.filter((p: Problem) => p.id !== id);
                        let newSelected = -1;
                        if (newProblems.length > 0 && idx !== -1) {
                            // 优先选中前一个，否则下一个，否则-1
                            if (idx - 1 >= 0) {
                                newSelected = newProblems[idx - 1].id;
                            } else if (idx < newProblems.length) {
                                newSelected = newProblems[idx].id;
                            }
                        }
                        const newProblemTargets = {
                            ...(state.problemTargets as Record<number, ProblemTarget[]>),
                        };
                        delete newProblemTargets[id];
                        const newThumbnails = { ...(state.thumbnails as Record<number, string>) };
                        delete newThumbnails[id];
                        return {
                            problems: newProblems,
                            problemTargets: newProblemTargets,
                            thumbnails: newThumbnails,
                            selectedProblem: newSelected,
                        };
                    }),
                editProblemTitle: (id: number, title: string) =>
                    set((state: any) => ({
                        problems: (state.problems as Problem[]).map((p) =>
                            p.id === id ? { ...p, title } : p,
                        ),
                    })),
                generateMissingThumbnails: (width = 160, height = 120) => {
                    const st = (get as any)() as TangramState;
                    const map: Record<number, string> = { ...(st.thumbnails || {}) };
                    for (const pb of st.problems) {
                        if (!map[pb.id]) {
                            const t = st.problemTargets[pb.id] || [];
                            const pixel = t.map((p) => ({
                                id: p.id,
                                points: p.points.map((v) => v * GRID_CELL),
                            }));
                            map[pb.id] = generateThumbnail(pixel, width, height);
                        }
                    }
                    set({ thumbnails: map });
                },
            }) as TangramState,
        {
            name: 'tangram-storage',
            // persist only problems-related data
            partialize: (state: any) => ({
                problems: state.problems,
                problemTargets: state.problemTargets,
                thumbnails: state.thumbnails,
            }),
            storage: {
                getItem: async (name: string) => {
                    const value = await get(name, tangramIDBStore);
                    return value === undefined ? null : value;
                },
                setItem: async (name: string, value: any) => {
                    await set(name, value, tangramIDBStore);
                },
                removeItem: async (name: string) => {
                    await del(name, tangramIDBStore);
                },
            },
        },
    ),
);
