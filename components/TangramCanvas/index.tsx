'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';

import { alignCenter, defaultTangram, GRID_CELL } from '@/lib/tangramUtils';
import { useTangramStore } from '@/stores/tangramStore';

import CanvasStage from './CanvasStage';
import Sidebar from './Sidebar';

// Sidebar width is controlled by CSS variable --sidebar-width; helper reads it as px
export const getSidebarWidthPx = () => {
    if (typeof window === 'undefined') return 320;
    const root = document.documentElement;
    const v = getComputedStyle(root).getPropertyValue('--sidebar-width')?.trim();
    if (!v) return 320;
    // If browser already computed it to px, it may be like "320px"
    if (v.endsWith('px')) return Number.parseFloat(v);
    // Support rem, vw
    if (v.endsWith('rem')) {
        const rem = Number.parseFloat(v);
        const rootFs = Number.parseFloat(getComputedStyle(root).fontSize) || 16;
        return rem * rootFs;
    }
    if (v.endsWith('vw')) {
        const num = Number.parseFloat(v);
        return (num / 100) * window.innerWidth;
    }
    // fallback parseFloat
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 320;
};
export default function TangramCanvasApp() {
    const { pieces, problemTargets, setPieces, setSize, setOffsetTarget, selectedProblem } =
        useTangramStore(
            useShallow((state) => ({
                pieces: state.pieces,
                problemTargets: state.problemTargets,
                setPieces: state.setPieces,
                setSize: state.setSize,
                setOffsetTarget: state.setOffsetTarget,
                selectedProblem: state.selectedProblem,
            })),
        );

    useEffect(() => {
        const handleResize = () => {
            setSize({ width: window.innerWidth - getSidebarWidthPx(), height: window.innerHeight });
            // 重新设置pieces和offsetTarget
            const st = useTangramStore.getState();
            if (st.size && st.size.width > 0) {
                setPieces(
                    defaultTangram({
                        width: window.innerWidth - getSidebarWidthPx(),
                        height: window.innerHeight,
                    }),
                );
            }
            // 重新设置offsetTarget
            const selectedProblem = st.selectedProblem;
            const problemTargets = st.problemTargets;
            const sz = {
                width: window.innerWidth - getSidebarWidthPx(),
                height: window.innerHeight,
            };
            const targetsGrid = problemTargets[selectedProblem] || [];
            if (!targetsGrid || targetsGrid.length === 0) {
                setOffsetTarget([]);
                return;
            }
            const GRID_CELL = st.size ? st.size.width / 20 : 32;
            const pixelTargets = targetsGrid.map((p: any) => ({
                id: p.id,
                points: p.points.map((v: number) => v * GRID_CELL),
            }));
            const [offsetX, offsetY] = alignCenter(
                pixelTargets.flatMap((t: any) => t.points),
                { ...sz, width: sz.width * 0.6 },
            );
            const offsetTarget = pixelTargets.map((p: any) => ({
                id: p.id,
                points: p.points.map((v: number, i: number) => v + [offsetX, offsetY][i % 2]),
            }));
            setOffsetTarget(offsetTarget);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setSize, setPieces, setOffsetTarget]);

    useEffect(() => {
        if ((pieces?.length || 0) === 0 && typeof window !== 'undefined') {
            const st = useTangramStore.getState();
            if (st.size && st.size.width > 0) {
                setPieces(defaultTangram(st.size));
            }
        }
    }, [pieces, setPieces]);

    // compute offsetTarget (pixel coords) and write to store whenever selectedProblem, problemTargets or size changes
    useEffect(() => {
        const st = useTangramStore.getState();
        const sz = st.size;
        if (!sz || sz.width <= 0) return;
        const targetsGrid = st.problemTargets[st.selectedProblem] || [];
        if (!targetsGrid || targetsGrid.length === 0) {
            setOffsetTarget([]);
            return;
        }

        // convert grid coords to pixel coords
        const pixelTargets = targetsGrid.map((p: any) => ({
            id: p.id,
            points: p.points.map((v: number) => v * GRID_CELL),
        }));

        // compute center offset for composition area (use half width like original)
        const [offsetX, offsetY] = alignCenter(
            pixelTargets.flatMap((t: any) => t.points),
            { ...sz, width: sz.width * 0.6 },
        );

        const offsetTarget = pixelTargets.map((p: any) => ({
            id: p.id,
            points: p.points.map((v: number, i: number) => v + [offsetX, offsetY][i % 2]),
        }));

        setOffsetTarget(offsetTarget);
    }, [setOffsetTarget, selectedProblem, problemTargets, pieces]);

    return (
        <div className="relative flex h-screen w-full">
            <Sidebar />
            <main className="relative flex-1">
                <CanvasStage />
            </main>
        </div>
    );
}
