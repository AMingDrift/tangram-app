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

import type { Piece } from '@/lib/tangramUtils';

import { generateThumbnail, getTransformedPoints } from '@/lib/tangramUtils';

import { Button } from '../ui/button';
import TooltipButton from '../ui/tooltip-button';

interface Props {
    creating: boolean;
    iconPx: number;
    startCreation: () => void;
    setSelectedProblem: (id: string) => void;
    setSaveDialogTitleInput: (s: string) => void;
    setIsSaveDialogOpen: (b: boolean) => void;
    cancelCreation: () => void;
    problems: any[];
    selectedProblem: string;
    setProblemToEdit: (id: string | null) => void;
    setEditProblemTitle: (t: string) => void;
    setIsEditDialogOpen: (b: boolean) => void;
    setProblemToDelete: (id: string | null) => void;
    setIsDeleteDialogOpen: (b: boolean) => void;
    pieces: Piece[];
    setProblems: (ps: any[]) => void;
    toastSuccess: (s: string) => void;
    toastError: (s: string) => void;
    setIsAnswerDialogOpen: (b: boolean) => void;
    exportProblemsData: () => string;
    importProblemsData: (data: any) => void;
    getCurrentProblemsCount: () => number;
    creatingDisabled?: boolean;
}

const nanoid = customAlphabet('1234567890abcdef', 5);

export default function ToolbarButtons(props: Props) {
    const {
        creating,
        iconPx,
        startCreation,
        setSelectedProblem,
        setSaveDialogTitleInput,
        setIsSaveDialogOpen,
        cancelCreation,
        problems,
        selectedProblem,
        setProblemToEdit,
        setEditProblemTitle,
        setIsEditDialogOpen,
        setProblemToDelete,
        setIsDeleteDialogOpen,
        pieces,
        setProblems,
        toastSuccess,
        toastError,
        setIsAnswerDialogOpen,
        exportProblemsData,
    } = props;

    return (
        <div className="mb-2 flex gap-2">
            <TooltipButton label="新建">
                <Button
                    className="cursor-pointer"
                    onClick={() => {
                        try {
                            startCreation();
                            setSelectedProblem('');
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
            </TooltipButton>

            {creating && (
                <>
                    <TooltipButton label="保存">
                        <Button
                            className="cursor-pointer"
                            onClick={() => {
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
                    </TooltipButton>

                    <TooltipButton label="取消">
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
                    </TooltipButton>
                </>
            )}

            {!creating && selectedProblem !== '' && (
                <>
                    <TooltipButton label="编辑">
                        <Button
                            className="cursor-pointer"
                            variant="outline"
                            size="icon"
                            aria-label="Edit"
                            onClick={() => {
                                const pb = problems.find((p: any) => p.id === selectedProblem);
                                setProblemToEdit(selectedProblem);
                                setEditProblemTitle(pb?.title || '');
                                setIsEditDialogOpen(true);
                            }}
                        >
                            <Edit3 size={Math.round(iconPx)} />
                        </Button>
                    </TooltipButton>

                    <TooltipButton label="删除">
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
                    </TooltipButton>

                    <TooltipButton label="保存答案">
                        <Button
                            className="cursor-pointer"
                            variant="outline"
                            size="icon"
                            aria-label="Save Answer"
                            onClick={() => {
                                try {
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
                                        toastSuccess('答案已保存');
                                    }
                                } catch (err) {
                                    console.error('保存答案失败', err);
                                    toastError('保存答案失败');
                                }
                            }}
                        >
                            <Check size={Math.round(iconPx)} />
                        </Button>
                    </TooltipButton>

                    <TooltipButton label="答案列表">
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
                    </TooltipButton>
                </>
            )}

            <TooltipButton label="下载">
                <Button
                    className="cursor-pointer"
                    onClick={() => {
                        try {
                            const dataStr = exportProblemsData();
                            const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
                            const exportFileDefaultName = 'tangram-problems.json';
                            const linkElement = document.createElement('a');
                            linkElement.setAttribute('href', dataUri);
                            linkElement.setAttribute('download', exportFileDefaultName);
                            linkElement.click();
                        } catch (e) {
                            console.error('导出失败:', e);
                            toastError('导出失败，请查看控制台了解详情');
                        }
                    }}
                    variant="outline"
                    size="icon"
                    aria-label="Download"
                    disabled={creating}
                >
                    <Download size={Math.round(iconPx)} />
                </Button>
            </TooltipButton>

            <TooltipButton label="上传">
                <Button
                    className="cursor-pointer"
                    variant="outline"
                    size="icon"
                    aria-label="Upload"
                    disabled={creating}
                    onClick={() => document.getElementById('import-problems')?.click()}
                >
                    <Upload size={Math.round(iconPx)} />
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
                                    props.importProblemsData(data);
                                    setTimeout(() => {
                                        const count = props.getCurrentProblemsCount();
                                        props.toastSuccess(`成功导入 ${count} 个题目`);
                                    }, 0);
                                } catch (err) {
                                    console.error('导入失败', err);
                                    props.toastError('导入失败，请确保文件有效');
                                }
                            };
                            reader.readAsText(file);
                            (e.target as HTMLInputElement).value = '';
                        }}
                        className="hidden"
                    />
                </Button>
            </TooltipButton>
        </div>
    );
}
