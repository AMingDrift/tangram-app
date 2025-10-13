'use client';

import { Ban, Download, Edit3, PlusIcon, SaveIcon, Trash2, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

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
import { computeCoverage, defaultTangram } from '@/lib/tangramUtils';
import { useTangramStore } from '@/stores/tangramStore';

import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export default function Sidebar() {
    const problems = useTangramStore((s: any) => s.problems as { id: number; title: string }[]);
    const thumbnails = useTangramStore((s: any) => s.thumbnails as Record<number, string>);
    const creating = useTangramStore((s: any) => s.creating as boolean);
    const selectedProblem = useTangramStore((s: any) => s.selectedProblem as number);
    const startCreation = useTangramStore((s: any) => s.startCreation as () => void);
    const setSelectedProblem = useTangramStore(
        (s: any) => s.setSelectedProblem as (id: number) => void,
    );
    const cancelCreation = useTangramStore((s: any) => s.cancelCreation as () => void);
    const saveCreation = useTangramStore((s: any) => s.saveCreation as (title?: string) => number);

    // 页面首次加载时自动选中第一项
    React.useEffect(() => {
        if (problems.length > 0 && selectedProblem === -1) {
            useTangramStore.getState().setSelectedProblem(problems[0].id);
        }
        // 只在挂载时运行
    }, []);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveDialogTitleInput, setSaveDialogTitleInput] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [problemToDelete, setProblemToDelete] = useState<number | null>(null);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [problemToEdit, setProblemToEdit] = useState<number | null>(null);
    const [editProblemTitle, setEditProblemTitle] = useState('');

    const deleteProblemById = useTangramStore(
        (s: any) => s.deleteProblemById as (id: number) => void,
    );
    const editProblemTitleAction = useTangramStore(
        (s: any) => s.editProblemTitle as (id: number, title: string) => void,
    );

    return (
        <aside className="box-border w-[260px] flex-none overflow-auto border-r border-gray-300 bg-gray-50 p-3">
            <div className="mb-2 flex gap-2">
                <Tooltip>
                    <TooltipTrigger>
                        <Button
                            className="cursor-pointer"
                            onClick={() => {
                                try {
                                    startCreation();
                                    setSelectedProblem(-1); // 新建时不选中任何题目
                                } catch (err) {
                                    console.error('新建失败', err);
                                }
                            }}
                            variant="outline"
                            size="icon"
                            aria-label="New"
                            disabled={creating}
                        >
                            <PlusIcon />
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
                            <DialogContent className="sm:max-w-[425px]">
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
                                                if (id && id > 0) {
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
                            <TooltipTrigger>
                                <Button
                                    className="cursor-pointer"
                                    onClick={() => {
                                        // open save dialog
                                        const st = useTangramStore.getState();
                                        const newId =
                                            Math.max(...st.problems.map((x: any) => x.id), 0) + 1;
                                        setSaveDialogTitleInput(`用户题目 ${newId}`);
                                        setIsSaveDialogOpen(true);
                                    }}
                                    variant="outline"
                                    size="icon"
                                    aria-label="Save"
                                >
                                    <SaveIcon />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>保存</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger>
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
                                    <Ban />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>取消</p>
                            </TooltipContent>
                        </Tooltip>
                    </>
                )}

                {/* Show delete and edit buttons when a problem is selected and not in creating mode */}
                {!creating && selectedProblem !== -1 && (
                    <>
                        <Tooltip>
                            <TooltipTrigger>
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
                                    <Trash2 />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>删除</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger>
                                <Button
                                    className="cursor-pointer"
                                    variant="outline"
                                    size="icon"
                                    aria-label="Edit"
                                    onClick={() => {
                                        const st = useTangramStore.getState();
                                        const pb = st.problems.find(
                                            (p: any) => p.id === selectedProblem,
                                        );
                                        setProblemToEdit(selectedProblem);
                                        setEditProblemTitle(pb?.title || '');
                                        setIsEditDialogOpen(true);
                                    }}
                                >
                                    <Edit3 />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>编辑</p>
                            </TooltipContent>
                        </Tooltip>
                    </>
                )}

                <Tooltip>
                    <TooltipTrigger>
                        <Button
                            className="cursor-pointer"
                            onClick={() => {
                                try {
                                    const dataStr = useTangramStore.getState().exportProblemsData();
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
                            <Download />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>下载</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger>
                        <Button
                            className="cursor-pointer"
                            variant="outline"
                            size="icon"
                            aria-label="Upload"
                            disabled={creating}
                            onClick={() => document.getElementById('import-problems')?.click()}
                        >
                            <Upload />
                        </Button>

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
                                        useTangramStore
                                            .getState()
                                            .importProblemsData(data as any[]);
                                        const st = useTangramStore.getState();
                                        toast.success(`成功导入 ${st.problems.length} 个题目`);
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
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>上传</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            <h3 className="text-md my-3 font-medium">题目列表</h3>
            <div className="grid gap-2">
                {problems.map((pb: { id: number; title: string }) => (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                    <div
                        key={pb.id}
                        onClick={() => {
                            if (creating) return;
                            // set selected problem in store
                            useTangramStore.getState().setSelectedProblem(pb.id);
                            // initialize pieces using store size
                            const st = useTangramStore.getState();
                            const pieces = defaultTangram(st.size);
                            useTangramStore.getState().setPieces(pieces);
                            // compute coverage using offsetTarget if available
                            const targets =
                                st.offsetTarget && (st.offsetTarget as any[]).length > 0
                                    ? (st.offsetTarget as any[])
                                    : [];
                            const pct = computeCoverage(pieces, targets as any, 200, 160);
                            useTangramStore.getState().setCoverage(pct);
                        }}
                        className={`cursor-pointer rounded-lg border-2 p-2 text-left transition-colors ${
                            pb.id === selectedProblem
                                ? 'border-sky-500 bg-sky-50'
                                : 'border-gray-300 bg-white hover:bg-gray-100'
                        } ${creating ? 'cursor-not-allowed! opacity-50' : ''}`}
                    >
                        <div className="flex items-center gap-2">
                            <div className="h-14 w-18 flex-none overflow-hidden rounded-lg border border-gray-300 bg-gray-100">
                                {thumbnails[pb.id] ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={thumbnails[pb.id]}
                                        alt={pb.title}
                                        className="block h-full w-full object-cover"
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
                        <AlertDialogDescription>
                            确定要删除这个题目吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (problemToDelete !== null) {
                                    deleteProblemById(problemToDelete);
                                }
                                setIsDeleteDialogOpen(false);
                                setProblemToDelete(null);
                            }}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <div className="grid gap-4 py-4">
                        <DialogHeader>
                            <DialogTitle>编辑题目名称</DialogTitle>
                            <DialogDescription>修改题目的名称，便于识别和使用。</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Input
                                id="edit-title"
                                value={editProblemTitle}
                                onChange={(e) => setEditProblemTitle(e.target.value)}
                                className="col-span-4"
                                placeholder="输入题目名称"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        // confirm edit
                                        if (problemToEdit !== null) {
                                            editProblemTitleAction(problemToEdit, editProblemTitle);
                                            toast.success('题目名称修改成功');
                                        }
                                        setIsEditDialogOpen(false);
                                        setProblemToEdit(null);
                                    }
                                }}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                取消
                            </Button>
                            <Button
                                onClick={() => {
                                    if (problemToEdit !== null) {
                                        editProblemTitleAction(problemToEdit, editProblemTitle);
                                        toast.success('题目名称修改成功');
                                    }
                                    setIsEditDialogOpen(false);
                                    setProblemToEdit(null);
                                }}
                            >
                                保存
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </aside>
    );
}
