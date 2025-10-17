'use client';

import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

interface TooltipButtonProps {
    label: string;
    children: ReactNode;
}

export default function TooltipButton({ label, children }: TooltipButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent>
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    );
}
