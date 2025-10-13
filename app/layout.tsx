import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
    title: 'Tangram Puzzle Game',
    description: 'Interactive Tangram Puzzle for Educational Purposes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <main>{children}</main>
                <Toaster position="top-center" />
            </body>
        </html>
    );
}
