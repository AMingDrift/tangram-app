'use client';

import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';

import { Confetti } from '@/components/ui/confetti';
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
    const { problemTargets, setSize, setTargetPieces, selectedProblem, coverage, size } =
        useTangramStore(
            useShallow((state) => ({
                problemTargets: state.problemTargets,
                setSize: state.setSize,
                setTargetPieces: state.setTargetPieces,
                selectedProblem: state.selectedProblem,
                coverage: state.coverage,
                size: state.size,
            })),
        );

    // confetti ref to call .fire()
    const confettiRef = useRef<any>(null);
    const prevCoverageRef = useRef<number>(0);

    // watch coverage and trigger confetti when crossing >98 from <=98
    useEffect(() => {
        const prev = prevCoverageRef.current ?? 0;
        const cur = coverage ?? 0;
        if (prev <= 98 && cur > 98) {
            try {
                const radio = size.width / 1920;
                confettiRef.current?.fire?.({
                    startVelocity: 45 * radio,
                    spread: 45 * radio,
                    gravity: radio,
                    scalar: radio,
                });
            } catch {
                // ignore confetti errors
            }
        }
        prevCoverageRef.current = cur;
    }, [coverage]);

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
                {/* Confetti canvas positioned centered under the stage */}
                <Confetti ref={confettiRef} className="absolute top-0 left-0 z-0 size-full" />
                <CanvasStage />
            </main>
        </div>
    );
}
