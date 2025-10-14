'use client';

import React, { useEffect } from 'react';

import TangramCanvas from '../components/TangramCanvas/index';

export default function Page() {
    // Initialize eruda for debugging on tablets
    useEffect(() => {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            import('eruda').then((eruda) => {
                eruda.default.init();
            });
        }
    }, []);
    return <TangramCanvas />;
}
