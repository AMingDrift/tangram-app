'use client';

import React, { useEffect } from 'react';

import { alignCenter, defaultTangram, GRID_CELL } from '@/lib/tangramUtils';
import { useTangramStore } from '@/stores/tangramStore';

import CanvasStage from './CanvasStage';
import Sidebar from './Sidebar';

export default function TangramCanvasApp() {
    const setSize = useTangramStore(
        (s: any) => s.setSize as (sz: { width: number; height: number }) => void,
    );
    const setPieces = useTangramStore((s: any) => s.setPieces as (p: any[]) => void);
    const setOffsetTarget = useTangramStore((s: any) => s.setOffsetTarget as (t: any[]) => void);
    const SIDEBAR_WIDTH = 260;

    useEffect(() => {
        const handleResize = () => {
            setSize({ width: window.innerWidth - SIDEBAR_WIDTH, height: window.innerHeight });
            // 重新设置pieces和offsetTarget
            const st = useTangramStore.getState();
            if (st.size && st.size.width > 0) {
                setPieces(
                    defaultTangram({
                        width: window.innerWidth - SIDEBAR_WIDTH,
                        height: window.innerHeight,
                    }),
                );
            }
            // 重新设置offsetTarget
            const selectedProblem = st.selectedProblem;
            const problemTargets = st.problemTargets;
            const sz = { width: window.innerWidth - SIDEBAR_WIDTH, height: window.innerHeight };
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

    // ensure initial pieces are present in store once size is known
    const pieces = useTangramStore((s: any) => s.pieces as any[]);
    const selectedProblem = useTangramStore((s: any) => s.selectedProblem as number);
    const problemTargets = useTangramStore((s: any) => s.problemTargets as Record<number, any[]>);
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
