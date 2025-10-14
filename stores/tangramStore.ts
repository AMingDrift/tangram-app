import { del, get, set } from 'idb-keyval';
import { customAlphabet } from 'nanoid';
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

const nanoid = customAlphabet('1234567890abcdef', 5);

export interface Problem {
    id: string;
    title: string;
    answers?: { id?: string; pieces: Piece[]; thumbnail: string }[]; // answers now may have stable id
}

export interface ProblemTarget {
    id: number;
    points: number[];
}

export interface ProblemData {
    id: string;
    title: string;
    targets: ProblemTarget[];
    thumbnail: string;
    answers?: { id?: string; pieces: Piece[]; thumbnail: string }[];
}

interface TangramState {
    size: { width: number; height: number };
    pieces: Piece[];
    offsetTarget: { id: number; points: number[] }[];
    problems: Problem[];
    // transient drafts for each problem id (not persisted)
    drafts: Record<string, Piece[]>;
    problemTargets: Record<string, ProblemTarget[]>;
    thumbnails: Record<string, string>;
    selectedProblem: string;
    creating: boolean;
    coverage: number;
    previousSelectedProblem?: string;

    // actions
    setSize: (s: { width: number; height: number }) => void;
    setPieces: (p: Piece[]) => void;
    setOffsetTarget: (t: { id: number; points: number[] }[]) => void;
    updatePiece: (id: number, patch: Partial<Piece>) => void;
    setProblems: (p: Problem[]) => void;
    setDraftForProblem: (id: string, pieces: Piece[] | undefined) => void;
    clearDraftForProblem: (id: string) => void;
    setProblemTargets: (map: Record<string, ProblemTarget[]>) => void;
    setThumbnails: (map: Record<string, string>) => void;
    setSelectedProblem: (id: string) => void;
    setCreating: (b: boolean) => void;
    setCoverage: (n: number) => void;
    // creation flow
    startCreation: () => void;
    cancelCreation: () => void;
    saveCreation: (title?: string) => string;
    bringPieceToTop: (id: number) => void;
    // problem management
    importProblemsData: (data: ProblemData[]) => void;
    exportProblemsData: () => string;
    addProblemWithTargets: (title: string | undefined, targetsGrid: ProblemTarget[]) => string;
    deleteProblemById: (id: string) => void;
    editProblemTitle: (id: string, title: string) => void;
    generateMissingThumbnails: (width?: number, height?: number) => void;
}

export type { TangramState };

export const useTangramStore = create<TangramState>()(
    persist(
        (set, get) => ({
            size: { width: 0, height: 0 },
            pieces: [],
            drafts: {},
            // offsetTarget stores pixel-space target polygons computed from problemTargets
            offsetTarget: [],
            problems: [],
            problemTargets: {},
            thumbnails: {},
            selectedProblem: '',
            creating: false,
            coverage: 0,

            setSize: (s) => set({ size: s }),
            setPieces: (p) => set({ pieces: p }),
            setDraftForProblem: (id, pieces) =>
                set((state) => {
                    const drafts = { ...(state.drafts || {}) };
                    if (!pieces || pieces.length === 0) {
                        delete drafts[id];
                    } else {
                        // deep copy to avoid shared references
                        try {
                            drafts[id] = JSON.parse(JSON.stringify(pieces));
                        } catch {
                            drafts[id] = (pieces || []).map((x) => ({ ...x }));
                        }
                    }
                    return { drafts } as any;
                }),
            clearDraftForProblem: (id) =>
                set((state) => {
                    const drafts = { ...(state.drafts || {}) };
                    delete drafts[id];
                    return { drafts } as any;
                }),
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
            previousSelectedProblem: '',
            startCreation: () =>
                set((state) => {
                    const prev = state.selectedProblem ?? '';
                    const pieces = defaultTangram(state.size);
                    return {
                        previousSelectedProblem: prev,
                        creating: true,
                        pieces,
                        selectedProblem: '',
                    };
                }),
            cancelCreation: () =>
                set((state) => {
                    const prev = state.previousSelectedProblem ?? '';
                    const pieces = defaultTangram(state.size);
                    return {
                        creating: false,
                        pieces,
                        selectedProblem: prev,
                        previousSelectedProblem: '',
                    };
                }),
            saveCreation: (title?) => {
                const st = get();
                const pieces = st.pieces || [];
                if (!pieces || pieces.length === 0) return '';

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
                    previousSelectedProblem: '',
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
                    // include answers (pieces + thumbnail) when present in import data
                    const newProblems = data.map((d) => ({
                        id: String(d.id),
                        title: d.title,
                        answers: Array.isArray(d.answers)
                            ? d.answers.map((a: any) => ({
                                  id: a.id ? String(a.id) : nanoid(),
                                  pieces: a.pieces || [],
                                  thumbnail: a.thumbnail || '',
                              }))
                            : [],
                    }));
                    const newProblemTargets: Record<string, ProblemTarget[]> = {};
                    const newThumbnails: Record<string, string> = {};
                    data.forEach((d) => {
                        newProblemTargets[String(d.id)] = d.targets || [];
                        newThumbnails[String(d.id)] = d.thumbnail || '';
                    });
                    const pieces = defaultTangram(state.size);
                    return {
                        problems: newProblems,
                        problemTargets: newProblemTargets,
                        thumbnails: newThumbnails,
                        pieces,
                        selectedProblem: newProblems.length > 0 ? newProblems[0].id : '',
                    };
                }),
            exportProblemsData: () => {
                const st = get();
                const problemsData: ProblemData[] = st.problems.map((p) => ({
                    id: p.id,
                    title: p.title,
                    targets: st.problemTargets[p.id] || [],
                    thumbnail: st.thumbnails[p.id] || '',
                    answers: (p.answers || []).map((a: any) => ({
                        id: a.id || '',
                        pieces: a.pieces || [],
                        thumbnail: a.thumbnail || '',
                    })),
                }));
                return JSON.stringify(problemsData, null, 2);
            },
            addProblemWithTargets: (title, targetsGrid) => {
                const newId = nanoid();
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
                    let newSelected = '';
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
                    const newDrafts = { ...(state.drafts || {}) };
                    delete newDrafts[id];
                    return {
                        problems: newProblems,
                        problemTargets: newProblemTargets,
                        thumbnails: newThumbnails,
                        drafts: newDrafts,
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
