'use client';

import {
    Ban,
    Check,
    Download,
    Edit3,
    NotepadText,
    PlusIcon,
    SaveIcon,
    Trash2,
    Upload,
} from 'lucide-react';
import { customAlphabet } from 'nanoid';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/shallow';

import type { Piece } from '@/lib/tangramUtils';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    computeCoverage,
    computeStageTransformForTargets,
    defaultTangram,
    generateThumbnail,
    getTransformedPoints,
    placePiecesInRightArea,
} from '@/lib/tangramUtils';
import { useTangramStore } from '@/stores/tangramStore';

// sidebar width now driven by CSS variable --sidebar-width
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export default function Sidebar() {
    const nanoid = customAlphabet('1234567890abcdef', 5);

    const {
        problems,
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

    // 页面首次加载时自动选中第一项（problems 可能异步获取，且只执行一次）
    const hasAutoSelectedRef = useRef(false);
    useEffect(() => {
        if (!hasAutoSelectedRef.current && problems.length > 0 && selectedProblem === '') {
            setSelectedProblem(problems[0].id);
            hasAutoSelectedRef.current = true;
        }
    }, [problems, selectedProblem, setSelectedProblem]);
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
    const getAnswerKey = (a: { id?: string; pieces: Piece[]; thumbnail: string }) => {
        if (a.thumbnail) return a.thumbnail;
        try {
            return btoa(JSON.stringify(a.pieces)).slice(0, 12);
        } catch {
            return String(Math.random()).slice(2, 10);
        }
    };
    // derive answers directly from problems to avoid extra state
    const currentProblem =
        selectedProblem !== '' ? problems.find((p) => p.id === selectedProblem) : undefined;
    const answers: { id?: string; pieces: Piece[]; thumbnail: string }[] =
        currentProblem && Array.isArray(currentProblem.answers)
            ? currentProblem.answers.slice()
            : [];

    // 确保从 store 中获取 pieces
    const { pieces } = useTangramStore(
        useShallow((state) => ({
            pieces: state.pieces,
        })),
    );

    // compute icon sizes (px) from rem so icons scale with root font-size
    const [iconPx, setIconPx] = useState<number>(() => {
        if (typeof window === 'undefined') return 16;
        return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    });

    useEffect(() => {
        const compute = () => {
            const fs = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            // update using rAF to appease some linters about synchronous setState in event handlers
            requestAnimationFrame(() => setIconPx(fs));
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, []);

    return (
        <aside
            className={`box-border overflow-auto border-r border-gray-300 bg-gray-50 p-3`}
            // use CSS var --sidebar-width with px fallback
            style={{ flex: `0 0 var(--sidebar-width, 320px)` }}
        >
            <div className="mb-2 flex gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            className="cursor-pointer"
                            onClick={() => {
                                try {
                                    startCreation();
                                    setSelectedProblem(''); // 新建时不选中任何题目
                                } catch (err) {
                                    console.error('新建失败', err);
                                }
                            }}
                            variant="outline"
                            size="icon"
                            aria-label="New"
                            disabled={creating}
                        >
                            <PlusIcon size={Math.round(iconPx)} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>新建</p>
                    </TooltipContent>
                </Tooltip>

                {creating && (
                    <>
                        {/* Save dialog moved into Sidebar (only in creation mode) */}
                        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                            <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-[26.5625rem]">
                                <DialogHeader>
                                    <DialogTitle>保存题目</DialogTitle>
                                    <DialogDescription>
                                        请输入题目的名称，以便后续识别和使用。
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Input
                                            id="title"
                                            value={saveDialogTitleInput}
                                            onChange={(e) =>
                                                setSaveDialogTitleInput(e.target.value)
                                            }
                                            className="col-span-4"
                                            placeholder="输入题目名称"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsSaveDialogOpen(false)}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="submit"
                                        onClick={() => {
                                            try {
                                                const id = saveCreation(
                                                    saveDialogTitleInput || undefined,
                                                );
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
                                        }}
                                    >
                                        保存
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="cursor-pointer"
                                    onClick={() => {
                                        // open save dialog
                                        // find existing titles like "用户题目 N" and choose max(N)+1
                                        const re = /^用户题目\s*(\d+)$/;
                                        let maxN = 0;
                                        for (const p of problems) {
                                            const m = String(p.title || '').match(re);
                                            if (m) {
                                                const n = Number(m[1]) || 0;
                                                if (n > maxN) maxN = n;
                                            }
                                        }
                                        const newId = maxN > 0 ? maxN + 1 : problems.length + 1;
                                        setSaveDialogTitleInput(`用户题目 ${newId}`);
                                        setIsSaveDialogOpen(true);
                                    }}
                                    variant="outline"
                                    size="icon"
                                    aria-label="Save"
                                >
                                    <SaveIcon size={Math.round(iconPx)} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>保存</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="cursor-pointer"
                                    onClick={() => {
                                        try {
                                            cancelCreation();
                                        } catch (err) {
                                            console.error('取消失败', err);
                                        }
                                    }}
                                    variant="outline"
                                    size="icon"
                                    aria-label="Cancel"
                                >
                                    <Ban size={Math.round(iconPx)} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>取消</p>
                            </TooltipContent>
                        </Tooltip>
                    </>
                )}

                {/* Show delete and edit buttons when a problem is selected and not in creation mode */}
                {!creating && selectedProblem !== '' && (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="cursor-pointer"
                                    variant="outline"
                                    size="icon"
                                    aria-label="Edit"
                                    onClick={() => {
                                        const pb = problems.find(
                                            (p: any) => p.id === selectedProblem,
                                        );
                                        setProblemToEdit(selectedProblem);
                                        setEditProblemTitle(pb?.title || '');
                                        setIsEditDialogOpen(true);
                                    }}
                                >
                                    <Edit3 size={Math.round(iconPx)} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>编辑</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="cursor-pointer"
                                    variant="outline"
                                    size="icon"
                                    aria-label="Delete"
                                    onClick={() => {
                                        setProblemToDelete(selectedProblem);
                                        setIsDeleteDialogOpen(true);
                                    }}
                                >
                                    <Trash2 className="text-red-500" size={Math.round(iconPx)} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>删除</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="cursor-pointer"
                                    variant="outline"
                                    size="icon"
                                    aria-label="Answer List"
                                    onClick={() => {
                                        setIsAnswerDialogOpen(true);
                                    }}
                                >
                                    <NotepadText size={Math.round(iconPx)} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>答案列表</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="cursor-pointer"
                                    variant="outline"
                                    size="icon"
                                    aria-label="Save Answer"
                                    onClick={() => {
                                        try {
                                            // 修改 generateThumbnail 调用，增加 isAnswer 参数
                                            const thumbnail = generateThumbnail(
                                                pieces.map((p) => ({
                                                    id: p.id,
                                                    points: getTransformedPoints(p),
                                                    color: p.color,
                                                })),
                                                160,
                                                120,
                                            );
                                            const newAnswer = {
                                                id: nanoid(),
                                                pieces: [...pieces],
                                                thumbnail,
                                            };
                                            const problemIndex = problems.findIndex(
                                                (p) => p.id === selectedProblem,
                                            );
                                            if (problemIndex !== -1) {
                                                const updatedProblems = [...problems];
                                                const problem = updatedProblems[problemIndex];
                                                problem.answers = problem.answers
                                                    ? [...problem.answers, newAnswer]
                                                    : [newAnswer];
                                                setProblems(updatedProblems);
                                                toast.success('答案已保存');
                                            }
                                        } catch (err) {
                                            console.error('保存答案失败', err);
                                            toast.error('保存答案失败');
                                        }
                                    }}
                                >
                                    <Check size={Math.round(iconPx)} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>保存答案</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Answer List Dialog */}
                        <Dialog open={isAnswerDialogOpen} onOpenChange={setIsAnswerDialogOpen}>
                            <DialogContent
                                className="sm:max-w-[40rem] lg:max-w-[60vw]"
                                onPointerDownOutside={(e) => {
                                    // Prevent closing the answers dialog when clicking outside
                                    e.preventDefault();
                                }}
                            >
                                <DialogHeader>
                                    <DialogTitle>答案列表</DialogTitle>
                                    <DialogDescription>点击答案以查看具体内容。</DialogDescription>
                                </DialogHeader>
                                <div className="grid max-h-[60vh] grid-cols-2 gap-4 overflow-auto py-4 pr-[0.0625rem] lg:max-h-[80vh]">
                                    {answers.map((answer, index) => (
                                        <div
                                            key={
                                                answer.id
                                                    ? `${selectedProblem}-${answer.id}`
                                                    : `${selectedProblem}-${getAnswerKey(answer)}`
                                            }
                                            role="button"
                                            tabIndex={0}
                                            className="relative flex cursor-pointer items-center justify-center rounded-lg border p-2 hover:bg-gray-100"
                                            onClick={() => {
                                                setPieces(answer.pieces || []);
                                                setIsAnswerDialogOpen(false);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    setPieces(answer.pieces || []);
                                                    setIsAnswerDialogOpen(false);
                                                }
                                            }}
                                        >
                                            {/* delete button - stop propagation so parent onClick isn't triggered */}
                                            <div className="absolute top-2 right-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`删除答案 ${index + 1}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAnswerToDeleteIndex(index);
                                                        setIsAnswerDeleteDialogOpen(true);
                                                    }}
                                                >
                                                    <Trash2
                                                        className="text-red-500"
                                                        size={Math.round(iconPx)}
                                                    />
                                                </Button>
                                            </div>

                                            <div className="flex justify-center">
                                                <Image
                                                    src={answer.thumbnail}
                                                    alt={`答案 ${index + 1}`}
                                                    width={200}
                                                    height={200}
                                                    unoptimized
                                                    className="block h-auto w-[12.5rem] object-contain"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsAnswerDialogOpen(false)}
                                    >
                                        关闭
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                        {/* Answer delete confirmation dialog */}
                        <AlertDialog
                            open={isAnswerDeleteDialogOpen}
                            onOpenChange={setIsAnswerDeleteDialogOpen}
                        >
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>删除答案</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        确定要删除此答案吗？
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel
                                        onClick={() => {
                                            setIsAnswerDeleteDialogOpen(false);
                                            setAnswerToDeleteIndex(null);
                                        }}
                                    >
                                        取消
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => {
                                            try {
                                                if (
                                                    selectedProblem === '' ||
                                                    answerToDeleteIndex === null
                                                ) {
                                                    toast.error('删除失败：未选中题目或答案');
                                                    return;
                                                }
                                                const updated = problems.slice();
                                                const pi = updated.findIndex(
                                                    (p) => p.id === selectedProblem,
                                                );
                                                if (pi === -1) {
                                                    toast.error('删除失败：未找到题目');
                                                    return;
                                                }
                                                const problem = { ...updated[pi] } as any;
                                                const ans = Array.isArray(problem.answers)
                                                    ? problem.answers.slice()
                                                    : [];
                                                if (
                                                    answerToDeleteIndex! < 0 ||
                                                    answerToDeleteIndex! >= ans.length
                                                ) {
                                                    toast.error('删除失败：无效的答案索引');
                                                    return;
                                                }
                                                // keep a copy for undo
                                                const deletedAnswer = ans[answerToDeleteIndex!];
                                                const deletedIndex = answerToDeleteIndex!;
                                                ans.splice(answerToDeleteIndex!, 1);
                                                problem.answers = ans;
                                                updated[pi] = problem;
                                                setProblems(updated);
                                                // close the answers dialog so user sees toast (restore previous behavior)
                                                toast.success('答案已删除', {
                                                    action: {
                                                        label: '撤销',
                                                        onClick: () => {
                                                            try {
                                                                const restored = updated.slice();
                                                                const pIdx = restored.findIndex(
                                                                    (p) => p.id === selectedProblem,
                                                                );
                                                                if (pIdx === -1) return;
                                                                const prob = {
                                                                    ...restored[pIdx],
                                                                } as any;
                                                                const currentAnswers =
                                                                    Array.isArray(prob.answers)
                                                                        ? prob.answers.slice()
                                                                        : [];
                                                                currentAnswers.splice(
                                                                    deletedIndex,
                                                                    0,
                                                                    deletedAnswer,
                                                                );
                                                                prob.answers = currentAnswers;
                                                                restored[pIdx] = prob;
                                                                setProblems(restored);
                                                                // reopen answers dialog after undo so user sees the restored answer
                                                                toast.success('已撤销删除');
                                                            } catch (err) {
                                                                console.error('撤销失败', err);
                                                                toast.error('撤销失败');
                                                            }
                                                        },
                                                    },
                                                });
                                            } catch (err) {
                                                console.error('删除答案失败', err);
                                                toast.error('删除答案失败');
                                            } finally {
                                                setIsAnswerDeleteDialogOpen(false);
                                                setAnswerToDeleteIndex(null);
                                            }
                                        }}
                                    >
                                        删除
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            className="cursor-pointer"
                            onClick={() => {
                                try {
                                    const dataStr = exportProblemsData();
                                    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(
                                        dataStr,
                                    )}`;
                                    const exportFileDefaultName = 'tangram-problems.json';
                                    const linkElement = document.createElement('a');
                                    linkElement.setAttribute('href', dataUri);
                                    linkElement.setAttribute('download', exportFileDefaultName);
                                    linkElement.click();
                                } catch (e) {
                                    console.error('导出失败:', e);
                                    toast.error('导出失败，请查看控制台了解详情');
                                }
                            }}
                            variant="outline"
                            size="icon"
                            aria-label="Download"
                            disabled={creating}
                        >
                            <Download size={Math.round(iconPx)} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>下载</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            className="cursor-pointer"
                            variant="outline"
                            size="icon"
                            aria-label="Upload"
                            disabled={creating}
                            onClick={() => document.getElementById('import-problems')?.click()}
                        >
                            <Upload size={Math.round(iconPx)} />
                        </Button>
                    </TooltipTrigger>
                    <input
                        id="import-problems"
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                try {
                                    const data = JSON.parse(ev.target?.result as string);
                                    importProblemsData(data);
                                    // 使用setTimeout确保状态更新完成后再显示toast
                                    setTimeout(() => {
                                        const currentProblems = useTangramStore.getState().problems;
                                        toast.success(`成功导入 ${currentProblems.length} 个题目`);
                                    }, 0);
                                } catch (err) {
                                    console.error('导入失败', err);
                                    toast.error('导入失败，请确保文件有效');
                                }
                            };
                            reader.readAsText(file);
                            (e.target as HTMLInputElement).value = '';
                        }}
                        className="hidden"
                    />
                    <TooltipContent>
                        <p>上传</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            <h3 className="my-3 text-[1.125rem] font-medium">题目列表</h3>
            <div className="grid gap-2">
                {problems.map((pb: { id: string; title: string }) => (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                    <div
                        key={pb.id}
                        onClick={() => {
                            if (creating) return;
                            // if clicking the already-selected problem, do nothing
                            if (pb.id === selectedProblem) return;
                            try {
                                // Before switching, save current pieces as transient draft in store
                                if (selectedProblem && selectedProblem !== '') {
                                    try {
                                        if (pieces && pieces.length > 0) {
                                            setDraftForProblem(selectedProblem, pieces);
                                        } else {
                                            // clear empty draft
                                            clearDraftForProblem(selectedProblem);
                                        }
                                    } catch (e) {
                                        console.warn('保存草稿失败', e);
                                    }
                                }

                                // set selected problem in store
                                setSelectedProblem(pb.id);

                                // initialize pieces using transient draft from store if available, otherwise defaultTangram
                                const hasDraft =
                                    Array.isArray(drafts?.[pb.id]) && drafts[pb.id].length > 0;
                                let finalPieces: Piece[] = [];
                                if (hasDraft) {
                                    // draft already stores world coordinates -> use as-is
                                    finalPieces = drafts[pb.id];
                                    setPieces(finalPieces);
                                } else {
                                    // use defaultTangram but place it into the right 40% area (centered)
                                    try {
                                        const originPieces = defaultTangram();
                                        // compute bbox/center of origin pieces
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
                                        // compute a stageTransform consistent with CanvasStage
                                        const st = useTangramStore.getState();
                                        const stageTransform = computeStageTransformForTargets(
                                            st.size || { width: 0, height: 0 },
                                            st.problemTargets[st.selectedProblem] || [],
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
                                        // place using helper (best-effort using store size)
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

                                // compute coverage using offsetTarget if available
                                const targets =
                                    targetPieces && targetPieces.length > 0 ? targetPieces : [];
                                // if finalPieces not assigned (shouldn't happen) fall back to store pieces
                                if (!finalPieces || finalPieces.length === 0) {
                                    finalPieces = useTangramStore.getState().pieces || [];
                                }
                                const pct = computeCoverage(finalPieces, targets, 200, 160);
                                setCoverage(pct);
                            } catch (err) {
                                console.error('切换题目失败', err);
                            }
                        }}
                        className={`cursor-pointer rounded-lg border-2 p-2 text-left transition-colors ${
                            pb.id === selectedProblem
                                ? 'border-sky-500 bg-sky-50'
                                : 'border-gray-300 bg-white hover:bg-gray-100'
                        } ${creating ? 'cursor-not-allowed! opacity-50' : ''}`}
                    >
                        <div className="flex items-center gap-2">
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
                            <div className="flex-1">
                                <div className="font-semibold">{pb.title}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Delete confirmation dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>确定要删除这个题目吗？</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                try {
                                    if (problemToDelete === null) {
                                        toast.error('删除失败：无效的题目 ID');
                                        return;
                                    }

                                    // capture state for undo
                                    const idx = problems.findIndex((p) => p.id === problemToDelete);
                                    const deletedProblem = problems[idx];
                                    const deletedTargets = problemTargets?.[problemToDelete] ?? [];
                                    const deletedThumbnail = thumbnails?.[problemToDelete] ?? '';

                                    // perform delete
                                    deleteProblemById(problemToDelete);
                                    setIsDeleteDialogOpen(false);

                                    // show undo toast
                                    toast.success('题目已删除', {
                                        action: {
                                            label: '撤销',
                                            onClick: () => {
                                                try {
                                                    // re-insert problem at original index using latest store value
                                                    const currentProblems = useTangramStore
                                                        .getState()
                                                        .problems.slice();
                                                    const alreadyExists = currentProblems.some(
                                                        (p) => p.id === deletedProblem.id,
                                                    );
                                                    if (!alreadyExists) {
                                                        if (
                                                            idx >= 0 &&
                                                            idx <= currentProblems.length
                                                        ) {
                                                            currentProblems.splice(
                                                                idx,
                                                                0,
                                                                deletedProblem,
                                                            );
                                                        } else {
                                                            currentProblems.push(deletedProblem);
                                                        }
                                                    }
                                                    // restore targets and thumbnail
                                                    const newProblemTargets = {
                                                        ...(problemTargets || {}),
                                                        [deletedProblem.id]: deletedTargets,
                                                    };
                                                    const newThumbnails = {
                                                        ...(thumbnails || {}),
                                                        [deletedProblem.id]: deletedThumbnail,
                                                    };
                                                    // update store with currentProblems (may be unchanged if already existed)
                                                    setProblems(currentProblems);
                                                    setProblemTargets(newProblemTargets);
                                                    setThumbnails(newThumbnails);
                                                    // ensure the restored problem becomes the selected problem
                                                    try {
                                                        setSelectedProblem(deletedProblem.id);
                                                    } catch (e) {
                                                        // defensive: if setter is not available for some reason, ignore
                                                        console.warn('无法设置选中题目', e);
                                                    }
                                                    toast.success('已撤销删除');
                                                } catch (err) {
                                                    console.error('撤销失败', err);
                                                    toast.error('撤销失败');
                                                }
                                            },
                                        },
                                    });
                                } catch (err) {
                                    console.error('删除题目失败', err);
                                    toast.error('删除题目失败');
                                }
                            }}
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit problem title dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[26.5625rem]">
                    <DialogHeader>
                        <DialogTitle>编辑题目标题</DialogTitle>
                        <DialogDescription>
                            修改题目的名称后，点击保存以更新题目。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Input
                                id="edit-title"
                                value={editProblemTitle}
                                onChange={(e) => setEditProblemTitle(e.target.value)}
                                className="col-span-4"
                                placeholder="输入新题目名称"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            取消
                        </Button>
                        <Button
                            onClick={() => {
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
                            }}
                        >
                            保存
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </aside>
    );
}
