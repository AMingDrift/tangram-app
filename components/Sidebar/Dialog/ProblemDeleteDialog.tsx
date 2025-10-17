'use client';

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
import { useTangramStore } from '@/stores/tangramStore';

type Problem = any;

export default function ProblemDeleteDialog(props: {
    open: boolean;
    setOpen: (v: boolean) => void;
    problemToDelete: string | null;
    problems: Problem[];
    deleteProblemById: (id: string) => void;
    setProblems: (p: Problem[]) => void;
    problemTargets?: Record<string, any>;
    thumbnails?: Record<string, string>;
    setProblemTargets?: (t: Record<string, any>) => void;
    setThumbnails?: (t: Record<string, string>) => void;
    setSelectedProblem?: (id: string) => void;
}) {
    const {
        open,
        setOpen,
        problemToDelete,
        problems,
        deleteProblemById,
        setProblems,
        problemTargets,
        thumbnails,
        setProblemTargets,
        setThumbnails,
        setSelectedProblem,
    } = props;

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
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
                                const idx = problems.findIndex(
                                    (p: any) => p.id === problemToDelete,
                                );
                                const deletedProblem = problems[idx];
                                const deletedTargets = problemTargets?.[problemToDelete] ?? [];
                                const deletedThumbnail = thumbnails?.[problemToDelete] ?? '';

                                // perform delete
                                deleteProblemById(problemToDelete);
                                setOpen(false);

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
                                                    (p: any) => p.id === deletedProblem.id,
                                                );
                                                if (!alreadyExists) {
                                                    if (idx >= 0 && idx <= currentProblems.length) {
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
                                                setProblemTargets?.(newProblemTargets);
                                                setThumbnails?.(newThumbnails);
                                                // ensure the restored problem becomes the selected problem
                                                try {
                                                    setSelectedProblem?.(deletedProblem.id);
                                                } catch (e) {
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
    );
}
