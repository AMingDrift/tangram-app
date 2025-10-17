import { Trash2 } from 'lucide-react';
import Image from 'next/image';

import type { Piece } from '@/lib/tangramUtils';

import { Button } from '../ui/button';

interface Answer {
    id?: string;
    pieces: Piece[];
    thumbnail: string;
}

export default function AnswerList(props: {
    answers: Answer[];
    selectedProblem: string;
    iconPx: number;
    onSelect: (answer: Answer) => void;
    onRequestDelete: (index: number) => void;
}) {
    const { answers, selectedProblem, iconPx, onSelect, onRequestDelete } = props;

    const getAnswerKey = (a: Answer) => {
        if (a.thumbnail) return a.thumbnail;
        try {
            return btoa(JSON.stringify(a.pieces)).slice(0, 12);
        } catch {
            return String(Math.random()).slice(2, 10);
        }
    };

    return (
        <div className="grid max-h-[60vh] grid-cols-2 gap-4 overflow-auto py-4 pr-[0.0625rem] lg:max-h-[80vh]">
            {answers.map((answer, index) => (
                <div
                    key={
                        answer.id
                            ? `${selectedProblem}-${answer.id}`
                            : `${selectedProblem}-${getAnswerKey(answer)}`
                    }
                    role="button"
                    tabIndex={0}
                    className="relative flex cursor-pointer items-center justify-center rounded-lg border p-2 hover:bg-gray-100"
                    onClick={() => onSelect(answer)}
                    onKeyDown={(e) => {
                        if ((e as any).key === 'Enter') onSelect(answer);
                    }}
                >
                    <div className="absolute top-2 right-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`删除答案 ${index + 1}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onRequestDelete(index);
                            }}
                        >
                            <Trash2 className="text-red-500" size={Math.round(iconPx)} />
                        </Button>
                    </div>

                    <div className="flex justify-center">
                        <Image
                            src={answer.thumbnail}
                            alt={`答案 ${index + 1}`}
                            width={200}
                            height={200}
                            unoptimized
                            className="block h-auto w-[12.5rem] object-contain"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
