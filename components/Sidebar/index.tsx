'use client';

// removed unused customAlphabet import
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/shallow';

import type { Piece } from '@/lib/tangramUtils';

import {
    computeCoverage,
    computeStageTransformForPiecesRightArea,
    computeStageTransformForTargets,
    defaultTangram,
    getTransformedPoints,
    placePiecesInRightArea,
} from '@/lib/tangramUtils';
import { useTangramStore } from '@/stores/tangramStore';

import AnswerList from './AnswerList';
import AnswerDeleteDialog from './Dialog/AnswerDeleteDialog';
import AnswerListDialog from './Dialog/AnswerListDialog';
import EditProblemDialog from './Dialog/EditProblemDialog';
import ProblemDeleteDialog from './Dialog/ProblemDeleteDialog';
import SaveProblemDialog from './Dialog/SaveProblemDialog';
import ProblemList from './ProblemList';
import ToolbarButtons from './ToolbarButtons';

export default function Sidebar() {
    // nanoid removed from here (answers are created inside ToolbarButtons)

    const {
        problems,
        pieces,
        targetPieces,
        thumbnails,
        drafts,
        creating,
        selectedProblem,
        startCreation,
        setPieces,
        setCoverage,
        setSelectedProblem,
        cancelCreation,
        saveCreation,
        deleteProblemById,
        editProblemTitleAction,
        importProblemsData,
        exportProblemsData,
        setProblems,
        problemTargets,
        setProblemTargets,
        setThumbnails,
        setDraftForProblem,
        clearDraftForProblem,
    } = useTangramStore(
        useShallow((state) => ({
            problems: state.problems,
            size: state.size,
            pieces: state.pieces,
            targetPieces: state.targetPieces,
            thumbnails: state.thumbnails,
            drafts: state.drafts,
            creating: state.creating,
            selectedProblem: state.selectedProblem,
            startCreation: state.startCreation,
            setSelectedProblem: state.setSelectedProblem,
            setPieces: state.setPieces,
            setCoverage: state.setCoverage,
            cancelCreation: state.cancelCreation,
            saveCreation: state.saveCreation,
            deleteProblemById: state.deleteProblemById,
            editProblemTitleAction: state.editProblemTitle,
            importProblemsData: state.importProblemsData,
            exportProblemsData: state.exportProblemsData,
            setProblems: state.setProblems,
            setDraftForProblem: state.setDraftForProblem,
            clearDraftForProblem: state.clearDraftForProblem,
            problemTargets: state.problemTargets,
            setProblemTargets: state.setProblemTargets,
            setThumbnails: state.setThumbnails,
        })),
    );

    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveDialogTitleInput, setSaveDialogTitleInput] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [problemToDelete, setProblemToDelete] = useState<string | null>(null);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [problemToEdit, setProblemToEdit] = useState<string | null>(null);
    const [editProblemTitle, setEditProblemTitle] = useState('');

    const [isAnswerDialogOpen, setIsAnswerDialogOpen] = useState(false);
    const [isAnswerDeleteDialogOpen, setIsAnswerDeleteDialogOpen] = useState(false);
    const [answerToDeleteIndex, setAnswerToDeleteIndex] = useState<number | null>(null);

    const onSaveProblem = useCallback(() => {
        try {
            const id = saveCreation(saveDialogTitleInput || undefined);
            if (id && id.length > 0) {
                toast.success('题目已保存');
            } else {
                toast.error('保存失败：没有可保存的图形');
            }
        } catch (err) {
            console.error('保存失败', err);
            toast.error('保存失败');
        }
        setIsSaveDialogOpen(false);
        setSaveDialogTitleInput('');
    }, [saveCreation, saveDialogTitleInput]);

    const onEditProblemTitle = useCallback(() => {
        if (problemToEdit !== null) {
            try {
                editProblemTitleAction(problemToEdit, editProblemTitle);
                setIsEditDialogOpen(false);
                toast.success('题目标题已更新');
            } catch (err) {
                console.error('更新失败', err);
                toast.error('更新失败，请查看控制台了解详情');
            }
        }
    }, [problemToEdit, editProblemTitle, editProblemTitleAction]);

    const onAnswerListPointerDownOutsideCallback = useCallback((e: any) => {
        try {
            // Try to detect clicks coming from the sonner toast portal.
            // The Toaster creates a container with id 'toast-root' and
            // the Sonner root uses class 'toaster'. If the event's
            // composedPath contains either, assume the click was on
            // the toast (eg. the undo button) and prevent the
            // dialog from closing.
            const path: any[] =
                typeof e.composedPath === 'function' ? e.composedPath() : e.path || [];

            for (const node of path) {
                if (!node) continue;
                if (node instanceof Element) {
                    const el = node as Element;
                    if (el.id === 'toast-root') {
                        e.preventDefault();
                        return;
                    }
                    if (el.classList && el.classList.contains('toaster')) {
                        e.preventDefault();
                        return;
                    }
                }
            }
        } catch {
            // on any error, do nothing and allow normal behavior
            // (closing on outside click)
        }
    }, []);

    const onAnswerSelect = useCallback(
        (answer: { id?: string; pieces: Piece[]; thumbnail: string }) => {
            setPieces(answer.pieces || []);
            setIsAnswerDialogOpen(false);
        },
        [],
    );

    const onAnswerRequestDelete = useCallback((index: number) => {
        setAnswerToDeleteIndex(index);
        setIsAnswerDeleteDialogOpen(true);
    }, []);

    // 页面首次加载时自动选中第一项（problems 可能异步获取，且只执行一次）
    const hasAutoSelectedRef = useRef(false);
    useEffect(() => {
        if (
            !hasAutoSelectedRef.current &&
            problems.length > 0 &&
            selectedProblem === '' &&
            !creating
        ) {
            setSelectedProblem(problems[0].id);
            hasAutoSelectedRef.current = true;
        }
    }, [problems, selectedProblem, setSelectedProblem, creating]);

    // derive answers directly from problems to avoid extra state
    const currentProblem =
        selectedProblem !== '' ? problems.find((p) => p.id === selectedProblem) : undefined;
    const answers: { id?: string; pieces: Piece[]; thumbnail: string }[] =
        currentProblem && Array.isArray(currentProblem.answers)
            ? currentProblem.answers.slice()
            : [];

    // compute icon sizes (px) from rem so icons scale with root font-size
    const [iconPx, setIconPx] = useState<number>(16);

    useEffect(() => {
        const compute = () => {
            if (typeof window !== 'undefined') {
                const fs =
                    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                // update using rAF to appease some linters about synchronous setState in event handlers
                requestAnimationFrame(() => setIconPx(fs));
            }
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, []);

    return (
        <aside
            className={`box-border flex h-full max-w-(--sidebar-width) flex-col border-r border-gray-300 bg-gray-50 p-3`}
            // use CSS var --sidebar-width with px fallback
            style={{
                flex: `0 0 var(--sidebar-width)`,
            }}
        >
            <ToolbarButtons
                creating={creating}
                iconPx={iconPx}
                startCreation={startCreation}
                setSelectedProblem={setSelectedProblem}
                setSaveDialogTitleInput={setSaveDialogTitleInput}
                setIsSaveDialogOpen={setIsSaveDialogOpen}
                cancelCreation={cancelCreation}
                problems={problems}
                selectedProblem={selectedProblem}
                setProblemToEdit={setProblemToEdit}
                setEditProblemTitle={setEditProblemTitle}
                setIsEditDialogOpen={setIsEditDialogOpen}
                setProblemToDelete={setProblemToDelete}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                pieces={pieces}
                setProblems={setProblems}
                toastSuccess={(s) => toast.success(s)}
                toastError={(s) => toast.error(s)}
                setIsAnswerDialogOpen={setIsAnswerDialogOpen}
                exportProblemsData={exportProblemsData}
                importProblemsData={importProblemsData}
                getCurrentProblemsCount={() => useTangramStore.getState().problems.length}
            />

            <div className="flex min-h-0 flex-1 flex-col">
                <ProblemList
                    problems={problems}
                    selectedProblem={selectedProblem}
                    creating={creating}
                    pieces={pieces}
                    drafts={drafts}
                    thumbnails={thumbnails}
                    setDraftForProblem={setDraftForProblem}
                    clearDraftForProblem={clearDraftForProblem}
                    setSelectedProblem={setSelectedProblem}
                    setPieces={setPieces}
                    setCoverage={setCoverage}
                    computeCoverage={computeCoverage}
                    defaultTangram={defaultTangram}
                    getTransformedPoints={getTransformedPoints}
                    computeStageTransformForPiecesRightArea={
                        computeStageTransformForPiecesRightArea
                    }
                    computeStageTransformForTargets={computeStageTransformForTargets}
                    placePiecesInRightArea={placePiecesInRightArea}
                    targetPieces={targetPieces}
                />
            </div>

            <ProblemDeleteDialog
                open={isDeleteDialogOpen}
                setOpen={setIsDeleteDialogOpen}
                problemToDelete={problemToDelete}
                problems={problems}
                deleteProblemById={deleteProblemById}
                setProblems={setProblems}
                problemTargets={problemTargets}
                thumbnails={thumbnails}
                setProblemTargets={setProblemTargets}
                setThumbnails={setThumbnails}
                setSelectedProblem={setSelectedProblem}
            />

            <SaveProblemDialog
                open={isSaveDialogOpen}
                setOpen={setIsSaveDialogOpen}
                title={saveDialogTitleInput}
                setTitle={setSaveDialogTitleInput}
                onSave={onSaveProblem}
            />
            <EditProblemDialog
                open={isEditDialogOpen}
                setOpen={setIsEditDialogOpen}
                title={editProblemTitle}
                setTitle={setEditProblemTitle}
                onSave={onEditProblemTitle}
            />

            <AnswerListDialog
                open={isAnswerDialogOpen}
                setOpen={setIsAnswerDialogOpen}
                onPointerDownOutsideCallback={onAnswerListPointerDownOutsideCallback}
            >
                <AnswerList
                    answers={answers}
                    selectedProblem={selectedProblem}
                    iconPx={iconPx}
                    onSelect={onAnswerSelect}
                    onRequestDelete={onAnswerRequestDelete}
                />
            </AnswerListDialog>

            <AnswerDeleteDialog
                open={isAnswerDeleteDialogOpen}
                setOpen={setIsAnswerDeleteDialogOpen}
                selectedProblem={selectedProblem}
                answerIndex={answerToDeleteIndex}
                setAnswerIndex={setAnswerToDeleteIndex}
                problems={problems}
                setProblems={setProblems}
            />
        </aside>
    );
}
