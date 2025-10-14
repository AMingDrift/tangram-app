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
        (set, get) => ({
            size: { width: 0, height: 0 },
            pieces: [],
            // offsetTarget stores pixel-space target polygons computed from problemTargets
            offsetTarget: [],
            problems: [],
            problemTargets: {},
            thumbnails: {},
            selectedProblem: -1,
            creating: false,
            coverage: 0,

            setSize: (s) => set({ size: s }),
            setPieces: (p) => set({ pieces: p }),
            setOffsetTarget: (t) => set({ offsetTarget: t }),
            updatePiece: (id, patch) =>
                set((state) => ({
                    pieces: state.pieces.map((x) => (x.id === id ? { ...x, ...patch } : x)),
                })),
            setProblems: (p) => set({ problems: p }),
            setProblemTargets: (map) => set({ problemTargets: map }),
            setThumbnails: (map) => set({ thumbnails: map }),
            setSelectedProblem: (id) => set({ selectedProblem: id }),
            setCreating: (b) => set({ creating: b }),
            setCoverage: (n) => set({ coverage: n }),
            // creation flow helpers
            previousSelectedProblem: -1,
            startCreation: () =>
                set((state) => {
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
                set((state) => {
                    const prev = state.previousSelectedProblem ?? -1;
                    const pieces = defaultTangram(state.size);
                    return {
                        creating: false,
                        pieces,
                        selectedProblem: prev,
                        previousSelectedProblem: -1,
                    };
                }),
            saveCreation: (title?) => {
                const st = get();
                const pieces = st.pieces || [];
                if (!pieces || pieces.length === 0) return -1;

                // compute pixel-space transformed points for each piece
                const newTargetsPixels = pieces.map((p, idx) => ({
                    id: idx + 1,
                    points: getTransformedPoints(p),
                }));

                // normalize to grid coords for storage
                const newTargetsGrid = newTargetsPixels.map((t) => ({
                    id: t.id,
                    points: t.points.map((v) => Math.round((v / GRID_CELL) * 100) / 100),
                }));

                const newId = get().addProblemWithTargets(title || undefined, newTargetsGrid);

                // reset pieces to default and mark creation finished
                set((state) => ({
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
                const pct = computeCoverage(pieces, pixelTargets, 200, 160);
                set({ coverage: pct });

                return newId;
            },
            bringPieceToTop: (id) =>
                set((state) => {
                    const found = state.pieces.find((p) => p.id === id);
                    if (!found) return {};
                    const others = state.pieces.filter((p) => p.id !== id);
                    return { pieces: [...others, found] };
                }),
            // import problems data from structured array
            importProblemsData: (data) =>
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
                const st = get();
                const problemsData: ProblemData[] = st.problems.map((p) => ({
                    id: p.id,
                    title: p.title,
                    targets: st.problemTargets[p.id] || [],
                    thumbnail: st.thumbnails[p.id] || '',
                }));
                return JSON.stringify(problemsData, null, 2);
            },
            addProblemWithTargets: (title, targetsGrid) => {
                const st = get();
                const newId =
                    st.problems.length > 0 ? Math.max(...st.problems.map((x) => x.id)) + 1 : 1;
                const newTitle = title || `用户题目 ${newId}`;
                set((state) => ({
                    problems: [...state.problems, { id: newId, title: newTitle }],
                    problemTargets: {
                        ...state.problemTargets,
                        [newId]: targetsGrid,
                    },
                }));
                // generate thumbnail (convert grid coords to pixels)
                const pixelForThumb = targetsGrid.map((t) => ({
                    id: t.id,
                    points: t.points.map((v) => v * GRID_CELL),
                }));
                const url = generateThumbnail(pixelForThumb, 160, 120);
                set((state) => ({
                    thumbnails: {
                        ...state.thumbnails,
                        [newId]: url,
                    },
                }));
                return newId;
            },
            deleteProblemById: (id) =>
                set((state) => {
                    const problems = state.problems;
                    const idx = problems.findIndex((p) => p.id === id);
                    const newProblems = problems.filter((p) => p.id !== id);
                    let newSelected = -1;
                    if (newProblems.length > 0 && idx !== -1) {
                        // 优先选中当前idx（删除后该位置的新项），如果idx超界则选中最后一项
                        if (idx < newProblems.length) {
                            newSelected = newProblems[idx].id;
                        } else {
                            newSelected = newProblems[newProblems.length - 1].id;
                        }
                    }
                    const newProblemTargets = {
                        ...state.problemTargets,
                    };
                    delete newProblemTargets[id];
                    const newThumbnails = { ...state.thumbnails };
                    delete newThumbnails[id];
                    return {
                        problems: newProblems,
                        problemTargets: newProblemTargets,
                        thumbnails: newThumbnails,
                        selectedProblem: newSelected,
                    };
                }),
            editProblemTitle: (id, title) =>
                set((state) => ({
                    problems: state.problems.map((p) => (p.id === id ? { ...p, title } : p)),
                })),
            generateMissingThumbnails: (width = 160, height = 120) => {
                const st = get();
                const map = { ...(st.thumbnails || {}) };
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
        }),
        {
            name: 'tangram-storage',
            // persist only problems-related data
            partialize: (state) => ({
                problems: state.problems,
                problemTargets: state.problemTargets,
                thumbnails: state.thumbnails,
            }),
            storage: {
                getItem: async (name) => {
                    const value = await get(name, tangramIDBStore);
                    return value === undefined ? null : value;
                },
                setItem: async (name, value) => {
                    await set(name, value, tangramIDBStore);
                },
                removeItem: async (name) => {
                    await del(name, tangramIDBStore);
                },
            },
        },
    ),
);
