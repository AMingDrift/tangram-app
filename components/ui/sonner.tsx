'use client';

import type { ToasterProps } from 'sonner';

import { useTheme } from 'next-themes';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Toaster as Sonner } from 'sonner';

const TOAST_ROOT_ID = 'toast-root';

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = 'light' } = useTheme();
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        let el = document.getElementById(TOAST_ROOT_ID) as HTMLElement | null;
        let created = false;

        if (!el) {
            el = document.createElement('div');
            el.id = TOAST_ROOT_ID;
            // container shouldn't block pointer events; toasts inside will receive events
            el.style.position = 'fixed';
            el.style.inset = '0';
            el.style.zIndex = '2147483647';
            el.style.pointerEvents = 'none';
            document.body.appendChild(el);
            created = true;
        }

        // schedule setState to avoid strict-mode double-call surprises during mount
        requestAnimationFrame(() => setContainer(el));

        return () => {
            if (created && el && el.parentNode) el.parentNode.removeChild(el);
        };
    }, []);

    const toaster = (
        <Sonner
            theme={theme as ToasterProps['theme']}
            className="toaster group pointer-events-auto"
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                } as React.CSSProperties
            }
            {...props}
        />
    );

    if (container) return ReactDOM.createPortal(toaster, container);
    return toaster;
};

export { Toaster };
