'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';

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
    const { problemTargets, setSize, setTargetPieces, selectedProblem } = useTangramStore(
        useShallow((state) => ({
            problemTargets: state.problemTargets,
            setSize: state.setSize,
            setTargetPieces: state.setTargetPieces,
            selectedProblem: state.selectedProblem,
        })),
    );

    useEffect(() => {
        const handleResize = () => {
            const totalWidth = window.innerWidth - getSidebarWidthPx();
            setSize({ width: totalWidth, height: window.innerHeight });
            // on resize we only update size; pieces positions remain unchanged
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setSize]);

    // compute offsetTarget (pixel coords) and write to store whenever selectedProblem, problemTargets or size changes
    useEffect(() => {
        // Compute offsetTarget only from problemTargets and convert grid coords to pixel coords
        // Do NOT apply any centering offset so the stored/imported positions are preserved
        const st = useTangramStore.getState();
        const targetsGrid = st.problemTargets[st.selectedProblem] || [];
        if (!targetsGrid || targetsGrid.length === 0) {
            setTargetPieces([]);
            return;
        }

        // convert grid coords to pixel coords using GRID_CELL constant from tangramUtils
        const pixelTargets = targetsGrid.map((p: any) => ({
            id: p.id,
            points: p.points,
        }));

        // Keep positions as-is (真实像素位置), don't align/center them
        setTargetPieces(pixelTargets);
    }, [setTargetPieces, selectedProblem, problemTargets]);

    return (
        <div className="relative flex h-screen w-full">
            <Sidebar />
            <main className="relative flex-1">
                <CanvasStage />
            </main>
        </div>
    );
}
