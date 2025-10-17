'use client';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface Props {
    open: boolean;
    setOpen: (v: boolean) => void;
    title: string;
    setTitle: (s: string) => void;
    onSave: () => void;
}

export default function SaveProblemDialog({ open, setOpen, title, setTitle, onSave }: Props) {
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-[26.5625rem]">
                <DialogHeader>
                    <DialogTitle>保存题目</DialogTitle>
                    <DialogDescription>请输入题目的名称，以便后续识别和使用。</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="col-span-4"
                            placeholder="输入题目名称"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        取消
                    </Button>
                    <Button type="submit" onClick={onSave}>
                        保存
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
