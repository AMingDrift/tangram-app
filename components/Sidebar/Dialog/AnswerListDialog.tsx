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

interface Props {
    open: boolean;
    setOpen: (v: boolean) => void;
    onPointerDownOutsideCallback: (event: any) => void;
    children: React.ReactNode;
}

export default function AnswerListDialog({
    open,
    setOpen,
    onPointerDownOutsideCallback,
    children,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                className="sm:max-w-[40rem] lg:max-w-[60vw]"
                onPointerDownOutside={(e) => onPointerDownOutsideCallback(e)}
            >
                <DialogHeader>
                    <DialogTitle>答案列表</DialogTitle>
                    <DialogDescription>点击答案以查看具体内容。</DialogDescription>
                </DialogHeader>
                {children}
                <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        关闭
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
