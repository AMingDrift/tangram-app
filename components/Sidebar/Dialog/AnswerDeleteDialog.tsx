'use client';

import React from 'react';
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

type Problem = any;

export default function AnswerDeleteDialog(props: {
    open: boolean;
    setOpen: (v: boolean) => void;
    selectedProblem: string;
    answerIndex: number | null;
    setAnswerIndex: (i: number | null) => void;
    problems: Problem[];
    setProblems: (p: Problem[]) => void;
}) {
    const { open, setOpen, selectedProblem, answerIndex, setAnswerIndex, problems, setProblems } =
        props;

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>删除答案</AlertDialogTitle>
                    <AlertDialogDescription>确定要删除此答案吗？</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        onClick={() => {
                            setOpen(false);
                            setAnswerIndex(null);
                        }}
                    >
                        取消
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            try {
                                if (selectedProblem === '' || answerIndex === null) {
                                    toast.error('删除失败：未选中题目或答案');
                                    return;
                                }
                                const updated = problems.slice();
                                const pi = updated.findIndex((p) => p.id === selectedProblem);
                                if (pi === -1) {
                                    toast.error('删除失败：未找到题目');
                                    return;
                                }
                                const problem = { ...updated[pi] } as any;
                                let ans: any[] = [];
                                if (Array.isArray(problem.answers)) {
                                    ans = problem.answers.slice();
                                }
                                if (answerIndex < 0 || answerIndex >= ans.length) {
                                    toast.error('删除失败：无效的答案索引');
                                    return;
                                }
                                // keep a copy for undo
                                const deletedAnswer = ans[answerIndex];
                                const deletedIndex = answerIndex;
                                ans.splice(answerIndex, 1);
                                problem.answers = ans;
                                updated[pi] = problem;
                                setProblems(updated);
                                // show toast with undo
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
                                                const prob = { ...restored[pIdx] } as any;
                                                let currentAnswers: any[] = [];
                                                if (Array.isArray(prob.answers)) {
                                                    currentAnswers = prob.answers.slice();
                                                }
                                                currentAnswers.splice(
                                                    deletedIndex,
                                                    0,
                                                    deletedAnswer,
                                                );
                                                prob.answers = currentAnswers;
                                                restored[pIdx] = prob;
                                                setProblems(restored);
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
                                setOpen(false);
                                setAnswerIndex(null);
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
