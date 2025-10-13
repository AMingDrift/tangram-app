'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Group, Text } from 'react-konva';
import { Button } from './ui/button';
import { Ban, Download, PlusIcon, SaveIcon, Upload, Trash2, Edit3 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
// import Fireworks from './Fireworks';

type Piece = {
    id: number;
    points: number[]; // local points
    color: string;
    x: number;
    y: number;
    rotation: number;
    placed?: boolean;
    centerX?: number;
    centerY?: number;
};

const GRID_CELL = 100;
const SIDEBAR_WIDTH = 260;

const mockTarget = [
    {
        id: 1,
        points: [-1, -1, 3, -1, 1, 1],
    },
    {
        id: 2,
        points: [0, 0, 2, 2, 0, 4],
    },
    {
        id: 3,
        points: [4, 0, 4, 2, 3, 1],
    },
    {
        id: 4,
        points: [2, 2, 3, 1, 4, 2, 3, 3],
    },
    {
        id: 5,
        points: [2, 2, 3, 3, 1, 3],
    },
    {
        id: 6,
        points: [1, 3, 3, 3, 2, 4, 0, 4],
    },
    {
        id: 7,
        points: [4, 2, 4, 4, 2, 4],
    },
].map(p => ({
    ...p,
    points: p.points.map(pi => pi * GRID_CELL),
}));

const alignCenter = (allPoints: number[], size: { width: number; height: number }) => {
    // 找出最小和最大的 x、y 值
    let minX = Infinity,
        minY = Infinity;
    let maxX = -Infinity,
        maxY = -Infinity;

    for (let i = 0; i < allPoints.length; i += 2) {
        const x = allPoints[i];
        const y = allPoints[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    // 计算包围盒的中心点
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 计算 canvas 的中心点
    const canvasCenterX = size.width / 2;
    const canvasCenterY = size.height / 2;

    // 计算需要的偏移量
    const offsetX = canvasCenterX - centerX;
    const offsetY = canvasCenterY - centerY;
    return [offsetX, offsetY];
};

const defaultPieces = (stageW: number, stageH: number): Piece[] => {
    // global adjustment to nudge the whole composition slightly left and down
    const offsetX = -2 * GRID_CELL; // negative -> move left
    const offsetY = 4.5 * GRID_CELL; // positive -> move down
    // composition top-left is computed when needed; left/top unused and removed

    // palette initial x on right side
    const px = stageW - 130;

    return [
        // 1 大三角 - top big triangle (red)
        {
            id: 1,
            points: [0, 0, 4, 0, 2, 2],
            color: '#c62828',
            // start in palette on the right
            x: 0,
            y: -1,
            rotation: 0,
            placed: false,
            centerX: 2,
            centerY: 1,
        },
        // 2 大三角 - left big triangle (orange)
        {
            id: 2,
            points: [0, 0, 2, 2, 0, 4],
            color: '#ff8f00',
            x: -1,
            y: 0,
            rotation: 0,
            placed: false,
            centerX: 1,
            centerY: 2,
        },
        // 3 小三角 - top-right small triangle (cyan)
        {
            id: 3,
            points: [4, 0, 4, 2, 3, 1],
            color: '#00acc1',
            x: 1.5,
            y: -1,
            rotation: 0,
            placed: false,
            centerX: 3.5,
            centerY: 1,
        },
        // 4 正方形(菱形) - diamond (green)
        {
            id: 4,
            points: [2, 2, 3, 1, 4, 2, 3, 3],
            color: '#7cb342',
            x: 1,
            y: 0,
            rotation: 0,
            placed: false,
            centerX: 3,
            centerY: 2,
        },
        // 5 小三角 - center small triangle (pink)
        {
            id: 5,
            points: [2, 2, 3, 3, 1, 3],
            color: '#d81b60',
            x: 0,
            y: 0.5,
            rotation: 0,
            placed: false,
            centerX: 2,
            centerY: 2.5,
        },
        // 6 平行四边形 - bottom-left parallelogram (purple)
        {
            id: 6,
            // parallelogram shape: top-left, top-right, bottom-right, bottom-left
            points: [1, 3, 3, 3, 2, 4, 0, 4],
            color: '#7e57c2',
            x: -0.5,
            y: 1.5,
            rotation: 0,
            placed: false,
            centerX: 1.5,
            centerY: 3.5,
        },
        // 7 中三角 - bottom-right triangle (yellow)
        {
            id: 7,
            points: [4, 2, 4, 4, 2, 4],
            color: '#fdd835',
            x: 1.5,
            y: 1.5,
            rotation: 0,
            placed: false,
            centerX: 3.5,
            centerY: 3.5,
        },
    ].map(p => ({
        ...p,
        x: p.x * GRID_CELL + offsetX + px,
        y: p.y * GRID_CELL + offsetY,
        points: p.points.map(pi => pi * GRID_CELL),
        centerX: p.centerX * GRID_CELL,
        centerY: p.centerY * GRID_CELL,
    }));
};

const distance = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);

// 返回 piece 在当前 rotation/x/y 下的世界坐标点数组
const getTransformedPoints = (p: Piece) => {
    const angle = ((p.rotation || 0) * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cx = p.centerX ?? 0;
    const cy = p.centerY ?? 0;
    const out: number[] = [];
    for (let i = 0; i < p.points.length; i += 2) {
        const lx = p.points[i];
        const ly = p.points[i + 1];
        const rx = (lx - cx) * cosA - (ly - cy) * sinA + p.x;
        const ry = (lx - cx) * sinA + (ly - cy) * cosA + p.y;
        out.push(rx, ry);
    }
    return out;
};

type Edge = {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    length: number;
    angle: number; // degrees
    midx: number;
    midy: number;
};

const getEdgesFromPoints = (pts: number[]) => {
    const edges: Edge[] = [];
    for (let i = 0; i < pts.length; i += 2) {
        const ax = pts[i];
        const ay = pts[i + 1];
        const bx = pts[(i + 2) % pts.length];
        const by = pts[(i + 3) % pts.length];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        edges.push({
            ax,
            ay,
            bx,
            by,
            length: len,
            angle,
            midx: (ax + bx) / 2,
            midy: (ay + by) / 2,
        });
    }
    return edges;
};

const angleDiff = (a: number, b: number) => {
    let d = Math.abs(((a - b) % 360) + 360) % 360;
    if (d > 180) d = 360 - d;
    return d;
};

// 尝试将 piece 的任意一条边吸附到目标多边形的任意一条边
// 返回 {x,y,rotation} 或 null
const findSnapForPiece = (piece: Piece, targetPolys: { id: number; points: number[] }[]) => {
    // tolerances
    const MAX_LENGTH_DIFF = 12; // px
    const MAX_ANGLE_DIFF = 10; // degrees
    const MAX_MIDPOINT_DIST = 18; // px

    const pieceWorldPts = getTransformedPoints(piece);
    const pieceEdges = getEdgesFromPoints(pieceWorldPts);

    // collect target edges
    const targetEdges: Edge[] = [];
    for (const t of targetPolys) {
        const edges = getEdgesFromPoints(t.points);
        for (const e of edges) targetEdges.push(e);
    }

    // try matching
    for (const pe of pieceEdges) {
        for (const te of targetEdges) {
            const lenDiff = Math.abs(pe.length - te.length);
            if (lenDiff > MAX_LENGTH_DIFF) continue;
            // angle: consider both directions (edge could be reversed)
            const d1 = angleDiff(pe.angle, te.angle);
            const d2 = angleDiff((pe.angle + 180) % 360, te.angle);
            if (d1 > MAX_ANGLE_DIFF && d2 > MAX_ANGLE_DIFF) continue;
            // compute required rotation delta (rotate piece so pe.angle aligns with te.angle)
            const chosenPeAngle = d1 <= d2 ? pe.angle : (pe.angle + 180) % 360;
            const deltaAngle = te.angle - chosenPeAngle;

            // simulate rotation around piece center
            const newRotation = ((piece.rotation || 0) + deltaAngle + 360) % 360;
            const rotated: Piece = { ...piece, rotation: newRotation };
            const rotatedPts = getTransformedPoints(rotated);
            const rotatedEdges = getEdgesFromPoints(rotatedPts);

            // find the corresponding rotated piece edge (match by nearest mid point)
            let matchedEdge: Edge | null = null;
            for (const re of rotatedEdges) {
                const md = distance(re.midx, re.midy, te.midx, te.midy);
                if (md < MAX_MIDPOINT_DIST && Math.abs(re.length - te.length) < MAX_LENGTH_DIFF) {
                    matchedEdge = re;
                    break;
                }
            }
            if (!matchedEdge) continue;

            // compute translation to align midpoints
            const dx = te.midx - matchedEdge.midx;
            const dy = te.midy - matchedEdge.midy;
            const newX = piece.x + dx;
            const newY = piece.y + dy;

            // validate endpoints overlap roughly
            // find index of matched edge in original piece's edges to compute endpoints after transform
            // we'll compute distance between edge endpoints after applying translation
            const ax = matchedEdge.ax + dx;
            const ay = matchedEdge.ay + dy;
            const bx = matchedEdge.bx + dx;
            const by = matchedEdge.by + dy;
            const da = distance(ax, ay, te.ax, te.ay);
            const db = distance(bx, by, te.bx, te.by);
            const daRev = distance(ax, ay, te.bx, te.by);
            const dbRev = distance(bx, by, te.ax, te.ay);
            const best = Math.min(Math.max(da, db), Math.max(daRev, dbRev));
            if (best > 20) continue; // endpoints too far

            return { x: newX, y: newY, rotation: newRotation };
        }
    }

    return null;
};

export default function TangramCanvas() {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [pieces, setPieces] = useState<Piece[]>([]);
    // const [showFireworks, setShowFireworks] = useState(false);
    const groupRefs = useRef<Record<number, any>>({});

    // composition creation area size (for new puzzles)

    // problems state (可动态添加题目)
    const initialProblemsList = [{ id: 1, title: '（默认）' }];

    // 定义统一的数据结构用于存储所有题目相关数据
    type ProblemData = {
        id: number;
        title: string;
        targets: { id: number; points: number[] }[];
        thumbnail: string;
    };

    type Problem = {
        id: number;
        title: string;
    };

    // mapping from problem id -> target polygons (stored as grid coords, not pixels)
    const [problemTargets, setProblemTargets] = useState<
        Record<number, { id: number; points: number[] }[]>
    >(() => {
        if (typeof window !== 'undefined') {
            try {
                // 首先尝试读取新的统一数据结构
                const raw = localStorage.getItem('tangram:problemsData');
                if (raw) {
                    const data: ProblemData[] = JSON.parse(raw);
                    const targets: Record<number, { id: number; points: number[] }[]> = {};
                    data.forEach(problem => {
                        targets[problem.id] = problem.targets;
                    });
                    return targets;
                }
            } catch (e) {
                console.error(e);
                return {};
            }
        }
        const map: Record<number, { id: number; points: number[] }[]> = {};
        for (const pb of initialProblemsList)
            map[pb.id] = mockTarget.map(p => ({
                id: p.id,
                points: p.points.map(pi => Math.round(pi / GRID_CELL)),
            }));
        return map;
    });

    // currently displayed target polygons (grid coords). 可在新建时清空
    const [targetPolys, setTargetPolys] = useState(problemTargets[initialProblemsList[0].id] || []);

    const [creating, setCreating] = useState(false);

    // selected problem (moved up so useEffect can reference it)
    const [selectedProblem, setSelectedProblem] = useState<number>(1);

    // Store previously selected problem when entering creation mode
    const [previousSelectedProblem, setPreviousSelectedProblem] = useState<number>(1);

    // compute centered offset and pixel-version offsetTarget from targetPolys (grid coords -> pixels)
    const allPointsPixels = targetPolys.flatMap(p => p.points.map(pi => pi * GRID_CELL));
    const [offsetX, offsetY] = targetPolys.length
        ? alignCenter(allPointsPixels, { width: size.width - 450, height: size.height })
        : [0, 0];
    const offsetTarget = targetPolys.map(p => ({
        ...p,
        points: p.points.map((pi, i) => pi * GRID_CELL + [offsetX, offsetY][i % 2]),
    }));

    useEffect(() => {
        const handleResize = () =>
            setSize({ width: window.innerWidth - SIDEBAR_WIDTH, height: window.innerHeight });
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (size.width && size.height) {
            setPieces(defaultPieces(size.width, size.height));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size.width, size.height]);

    // when selected problem changes or problemTargets changes, update displayed targetPolys
    useEffect(() => {
        // if selectedProblem maps to a target, use it; otherwise keep current targetPolys
        if (problemTargets[selectedProblem]) setTargetPolys(problemTargets[selectedProblem]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProblem, problemTargets]);

    const updatePiece = (id: number, patch: Partial<Piece>, callback?: (p: Piece[]) => void) => {
        setPieces(prev => {
            const cur = prev.map(p => (p.id === id ? { ...p, ...patch } : p));
            callback?.(cur);
            return cur;
        });
    };

    const handleDragMove = (e: any, piece: Piece) => {
        const newX = e.target.x();
        const newY = e.target.y();
        // update position continuously so labels follow during drag
        updatePiece(piece.id, { x: newX, y: newY });
    };

    // 修改 handleDragStart 函数，添加 moveToTop 逻辑
    const handleDragStart = (e: any, piece: Piece) => {
        // bring this piece to the end of the array so it renders on top
        setPieces(prev => {
            const found = prev.find(p => p.id === piece.id);
            if (!found) return prev;
            const others = prev.filter(p => p.id !== piece.id);
            return [...others, found];
        });
    };

    const handleLabelClick = (e: any, piece: Piece) => {
        // 旋转45度
        const newRot = (piece.rotation + 45) % 360;
        updatePiece(piece.id, { rotation: newRot }, pieces => {
            const pct = computeCoverage(pieces, offsetTarget, 200, 160);
            setCoverage(pct);
        });
    };

    const changeSelectedProblem = (id: number) => {
        setSelectedProblem(id);
        setPieces(() => {
            const pieces = defaultPieces(size.width, size.height);
            const pct = computeCoverage(pieces, offsetTarget, 200, 160);
            setCoverage(pct);
            return pieces;
        });
    };

    const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

    // sample problem list (placeholder titles). Later these can include thumbnails or shape data.
    const [thumbnails, setThumbnails] = useState<Record<number, string>>(() => {
        if (typeof window !== 'undefined') {
            try {
                // 首先尝试读取新的统一数据结构
                const raw = localStorage.getItem('tangram:problemsData');
                if (raw) {
                    const data: ProblemData[] = JSON.parse(raw);
                    const thumbs: Record<number, string> = {};
                    data.forEach(problem => {
                        thumbs[problem.id] = problem.thumbnail;
                    });
                    return thumbs;
                }
            } catch (e) {
                console.error(e);
                return {};
            }
        }

        return {};
    });
    const [coverage, setCoverage] = useState<number>(0); // percentage 0-100
    const [problems, setProblems] = useState<Problem[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                // 首先尝试读取新的统一数据结构
                const raw = localStorage.getItem('tangram:problemsData');
                if (raw) {
                    const data: ProblemData[] = JSON.parse(raw);
                    return data.map(problem => ({
                        id: problem.id,
                        title: problem.title,
                    }));
                }
            } catch (e) {
                console.error(e);
                return [];
            }
        }

        return initialProblemsList;
    });
    // persist problemTargets, thumbnails and problems to localStorage
    const initialized = useRef(false);
    useEffect(() => {
        // Skip the first initialization
        if (!initialized.current) {
            initialized.current = true;
            return;
        }
        if (typeof window === 'undefined') return;

        try {
            // 使用新的统一数据结构存储所有数据
            const problemsData: ProblemData[] = problems.map((problem: Problem) => ({
                id: problem.id,
                title: problem.title,
                targets: problemTargets[problem.id] || [],
                thumbnail: thumbnails[problem.id] || '',
            }));
            localStorage.setItem('tangram:problemsData', JSON.stringify(problemsData));
        } catch (e) {
            // ignore storage errors
        }
    }, [problemTargets, thumbnails, problems]);

    useEffect(() => {
        if (pieces.length === 0) return;
        // setShowFireworks(coverage >= 98);
    }, [pieces, coverage]);

    // handlers for creating new problem
    const handleNew = () => {
        // enter creation mode: clear targetPolys so canvas shows empty target area
        setCreating(true);
        setTargetPolys([]);
        setPieces(defaultPieces(size.width, size.height));
        // Save currently selected problem and clear selection
        setPreviousSelectedProblem(selectedProblem);
        setSelectedProblem(0);
    };

    const handleCancel = () => {
        // exit creation mode, restore selected problem's target
        setCreating(false);
        setPieces(defaultPieces(size.width, size.height));
        // Restore previously selected problem
        setSelectedProblem(previousSelectedProblem);
        if (problemTargets[previousSelectedProblem])
            setTargetPolys(problemTargets[previousSelectedProblem]);
    };

    const handleSave = (title?: string) => {
        // convert currently placed pieces (those not in palette area) to target polygons
        // We'll take each piece's transformed points, translate them relative to composition origin
        const placedPieces = pieces;
        setPieces(defaultPieces(size.width, size.height));
        if (placedPieces.length === 0) {
            // nothing to save, just exit
            setCreating(false);
            if (problemTargets[selectedProblem]) setTargetPolys(problemTargets[selectedProblem]);
            return;
        }

        // compute target polygons in local coordinates (world coords -> remove offsets)
        const newTargetsPixels = placedPieces.map((p, idx) => {
            const pts = getTransformedPoints(p);
            // convert back to local relative coordinates by removing offsetX/offsetY
            const local = pts.map((v, i) => v - [offsetX, offsetY][i % 2]);
            return { id: idx + 1, points: local };
        });

        // normalize to grid coords (0..4 style) for storage
        const newTargetsGrid = newTargetsPixels.map(t => ({
            id: t.id,
            points: t.points.map(v => Math.round((v / GRID_CELL) * 100) / 100),
        }));

        // create new problem entry
        const newId = Math.max(...problems.map((x: Problem) => x.id)) + 1;
        const newTitle = title || `用户题目 ${newId}`;
        setProblems((prev: Problem[]) => [...prev, { id: newId, title: newTitle }]);
        setProblemTargets(prev => ({ ...prev, [newId]: newTargetsGrid }));
        setSelectedProblem(newId);
        setCreating(false);
        setTargetPolys(newTargetsGrid);
        // generate thumbnail for new target using pixel coords
        const pixelForThumb = newTargetsGrid.map(p => ({
            id: p.id,
            points: p.points.map(v => v * GRID_CELL),
        }));
        const url = generateThumbnail(pixelForThumb, 160, 120);
        setThumbnails(prev => ({ ...prev, [newId]: url }));
    };

    // New function to handle save with dialog
    const handleSaveWithDialog = () => {
        const newId = Math.max(...problems.map((x: Problem) => x.id), 0) + 1;
        const defaultTitle = `用户题目 ${newId}`;
        setSaveDialogTitleInput(defaultTitle);
        setIsSaveDialogOpen(true);
    };

    // Function to confirm save with title
    const confirmSaveWithTitle = () => {
        handleSave(saveDialogTitleInput);
        setIsSaveDialogOpen(false);
        setSaveDialogTitleInput('');
    };

    // State for save dialog
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveDialogTitleInput, setSaveDialogTitleInput] = useState('');

    // State for delete confirmation dialog
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [problemToDelete, setProblemToDelete] = useState<number | null>(null);

    // State for edit dialog
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [problemToEdit, setProblemToEdit] = useState<number | null>(null);
    const [editProblemTitle, setEditProblemTitle] = useState('');

    // generate thumbnail data URL from target polygons (mockTarget)
    const generateThumbnail = (
        targetPolys: { id: number; points: number[] }[],
        width = 160,
        height = 120,
    ) => {
        if (!targetPolys || targetPolys.length === 0) return '';
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // compute bounds of targetPolys
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const p of targetPolys) {
            for (let i = 0; i < p.points.length; i += 2) {
                const vx = p.points[i];
                const vy = p.points[i + 1];
                if (vx < minX) minX = vx;
                if (vy < minY) minY = vy;
                if (vx > maxX) maxX = vx;
                if (vy > maxY) maxY = vy;
            }
        }
        if (!isFinite(minX)) return '';

        const pad = 8;
        const contentW = Math.max(1, maxX - minX);
        const contentH = Math.max(1, maxY - minY);
        const scale = Math.min((width - pad * 2) / contentW, (height - pad * 2) / contentH);

        // clear
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;

        // draw each polygon
        for (const p of targetPolys) {
            ctx.beginPath();
            for (let i = 0; i < p.points.length; i += 2) {
                const ax = (p.points[i] - minX) * scale + pad;
                const ay = (p.points[i + 1] - minY) * scale + pad;
                if (i === 0) ctx.moveTo(ax, ay);
                else ctx.lineTo(ax, ay);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        return canvas.toDataURL('image/png');
    };

    // regenerate thumbnails when pieces change
    useEffect(() => {
        if (pieces.length === 0) return;
        // targetPolys are grid coords; convert to pixels for thumbnail generation
        const pixelTargets = targetPolys.map(p => ({
            id: p.id,
            points: p.points.map(v => v * GRID_CELL),
        }));
        const url = generateThumbnail(pixelTargets, 160, 120);
        const map: Record<number, string> = {};
        for (const pb of problems) map[pb.id] = url;
        // eslint-disable-nextine react-hooks/exhaustive-deps
    }, [pieces.length]);

    // ensure thumbnails exist for all problems (generate from problemTargets)
    useEffect(() => {
        const missing: number[] = [];
        for (const pb of problems) {
            if (!thumbnails[pb.id]) missing.push(pb.id);
        }
        if (missing.length === 0) return;
        const map = { ...thumbnails };
        for (const id of missing) {
            const t = problemTargets[id] || [];
            const pixel = t.map(p => ({ id: p.id, points: p.points.map(v => v * GRID_CELL) }));
            map[id] = generateThumbnail(pixel, 160, 120);
        }
        setThumbnails(map);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [problems, problemTargets]);

    // compute coverage of target area by current placed pieces (pixel mask comparison)
    const computeCoverage = (
        piecesForCalc: Piece[],
        targetPolys: typeof mockTarget,
        w = 200,
        h = 200,
    ) => {
        if (!piecesForCalc || piecesForCalc.length === 0) return 0;

        // use a small offscreen canvas for speed; scale factor to map world coords into canvas
        const canvasA = document.createElement('canvas');
        const canvasB = document.createElement('canvas');
        canvasA.width = w;
        canvasA.height = h;
        canvasB.width = w;
        canvasB.height = h;
        const a = canvasA.getContext('2d');
        const b = canvasB.getContext('2d');
        if (!a || !b) return 0;

        // determine bounds from targetPolys to fit into canvas
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const p of targetPolys) {
            for (let i = 0; i < p.points.length; i += 2) {
                const vx = p.points[i];
                const vy = p.points[i + 1];
                if (vx < minX) minX = vx;
                if (vy < minY) minY = vy;
                if (vx > maxX) maxX = vx;
                if (vy > maxY) maxY = vy;
            }
        }
        if (!isFinite(minX)) return 0;

        const pad = 4; // pixels padding
        const contentW = Math.max(1, maxX - minX);
        const contentH = Math.max(1, maxY - minY);
        const scale = Math.min((w - pad * 2) / contentW, (h - pad * 2) / contentH);

        // draw target mask in canvasA (black filled target)
        a.clearRect(0, 0, w, h);
        a.fillStyle = '#000';
        for (const p of targetPolys) {
            a.beginPath();
            for (let i = 0; i < p.points.length; i += 2) {
                const ax = (p.points[i] - minX) * scale + pad;
                const ay = (p.points[i + 1] - minY) * scale + pad;
                if (i === 0) a.moveTo(ax, ay);
                else a.lineTo(ax, ay);
            }
            a.closePath();
            a.fill();
        }

        // draw pieces mask in canvasB (black filled for placed pieces only)
        b.clearRect(0, 0, w, h);
        b.fillStyle = '#000';
        for (const p of piecesForCalc) {
            if (!p) continue;
            // draw using p.points positioned at p.x/p.y with rotation and offset
            const angle = ((p.rotation || 0) * Math.PI) / 180;
            const cosA = Math.cos(angle),
                sinA = Math.sin(angle);
            const cx = p.centerX ?? 0;
            const cy = p.centerY ?? 0;
            b.beginPath();
            for (let i = 0; i < p.points.length; i += 2) {
                const lx = p.points[i];
                const ly = p.points[i + 1];
                const rx = (lx - cx) * cosA - (ly - cy) * sinA + p.x;
                const ry = (lx - cx) * sinA + (ly - cy) * cosA + p.y;
                const ax = (rx - minX) * scale + pad;
                const ay = (ry - minY) * scale + pad;
                if (i === 0) b.moveTo(ax, ay);
                else b.lineTo(ax, ay);
            }
            b.closePath();
            b.fill();
        }

        // compare pixel data
        const da = a.getImageData(0, 0, w, h).data;
        const db = b.getImageData(0, 0, w, h).data;
        let targetPixels = 0;
        let coveredPixels = 0;
        for (let i = 0; i < da.length; i += 4) {
            const aOn = da[i + 3] > 0; // alpha > 0 indicates target
            const bOn = db[i + 3] > 0; // alpha > 0 indicates piece present
            if (aOn) targetPixels++;
            if (aOn && bOn) coveredPixels++;
        }
        if (targetPixels === 0) return 0;
        return Math.round((coveredPixels / targetPixels) * 100);
    };

    const handleDragEnd = (e: any, piece: Piece) => {
        // on drag end, try to snap to any matching edge of current displayed target
        const snap = findSnapForPiece(piece, offsetTarget);
        if (snap) {
            updatePiece(
                piece.id,
                {
                    x: snap.x,
                    y: snap.y,
                    rotation: snap.rotation,
                    placed: true,
                },
                pieces => {
                    const pct = computeCoverage(pieces, offsetTarget, 200, 160);
                    setCoverage(pct);
                },
            );
        } else {
            // if not snapped, mark as not placed
            updatePiece(piece.id, { placed: false }, pieces => {
                const pct = computeCoverage(pieces, offsetTarget, 200, 160);
                setCoverage(pct);
            });
        }
    };

    // 导出题目数据为JSON文件
    const exportProblems = () => {
        try {
            // 创建统一数据结构
            const problemsData: ProblemData[] = problems.map((problem: Problem) => ({
                id: problem.id,
                title: problem.title,
                targets: problemTargets[problem.id] || [],
                thumbnail: thumbnails[problem.id] || '',
            }));

            // 创建JSON数据
            const dataStr = JSON.stringify(problemsData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

            // 创建下载链接并触发下载
            const exportFileDefaultName = 'tangram-problems.json';
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        } catch (e) {
            console.error('导出失败:', e);
            toast.error('导出失败，请查看控制台了解详情');
        }
    };

    // 从JSON文件导入题目数据
    const importProblems = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const content = e.target?.result as string;
                const problemsData = JSON.parse(content) as ProblemData[];

                // 更新各个状态
                const newProblems: Problem[] = problemsData.map(problem => ({
                    id: problem.id,
                    title: problem.title,
                }));

                const newProblemTargets: Record<number, { id: number; points: number[] }[]> = {};
                const newThumbnails: Record<number, string> = {};

                problemsData.forEach(problem => {
                    newProblemTargets[problem.id] = problem.targets;
                    newThumbnails[problem.id] = problem.thumbnail;
                });

                setProblems(newProblems);
                setProblemTargets(newProblemTargets);
                setThumbnails(newThumbnails);

                // 如果有题目，选择第一个
                if (newProblems.length > 0) {
                    setSelectedProblem(newProblems[0].id);
                }

                toast.success(`成功导入 ${problemsData.length} 个题目`);
            } catch (e) {
                console.error('导入失败:', e);
                toast.error('导入失败，请确保选择的是有效的JSON文件');
            }
        };
        reader.readAsText(file);
        // 重置input值以便可以重复导入相同文件
        event.target.value = '';
    };

    // Delete problem function
    const handleDeleteProblem = (id: number) => {
        if (problems.length <= 1) {
            toast.error('至少需要保留一个题目');
            return;
        }

        const newProblems = problems.filter((p: Problem) => p.id !== id);
        setProblems(newProblems);

        const newProblemTargets = { ...problemTargets };
        delete newProblemTargets[id];
        setProblemTargets(newProblemTargets);

        const newThumbnails = { ...thumbnails };
        delete newThumbnails[id];
        setThumbnails(newThumbnails);

        // If we're deleting the currently selected problem, select the first one
        if (selectedProblem === id) {
            setSelectedProblem(newProblems[0].id);
        }

        toast.success('题目删除成功');
    };

    // Open delete confirmation dialog
    const openDeleteDialog = (id: number) => {
        setProblemToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    // Confirm delete
    const confirmDelete = () => {
        if (problemToDelete !== null) {
            handleDeleteProblem(problemToDelete);
        }
        setIsDeleteDialogOpen(false);
        setProblemToDelete(null);
    };

    // Open edit dialog
    const openEditDialog = (id: number, currentTitle: string) => {
        setProblemToEdit(id);
        setEditProblemTitle(currentTitle);
        setIsEditDialogOpen(true);
    };

    // Confirm edit
    const confirmEdit = () => {
        if (problemToEdit !== null) {
            setProblems(
                problems.map(p => (p.id === problemToEdit ? { ...p, title: editProblemTitle } : p)),
            );
            toast.success('题目名称修改成功');
        }
        setIsEditDialogOpen(false);
        setProblemToEdit(null);
        setEditProblemTitle('');
    };

    return (
        <div className="relative flex h-screen w-full">
            {/* Sidebar */}
            <aside className="box-border w-[260px] flex-none overflow-auto border-r border-gray-300 bg-gray-50 p-3">
                <div className="mb-2 flex gap-2">
                    <Tooltip>
                        <TooltipTrigger>
                            <Button
                                className="cursor-pointer"
                                onClick={handleNew}
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

                    {creating ? (
                        <>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Button
                                        className="cursor-pointer"
                                        onClick={handleSaveWithDialog}
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
                                        onClick={handleCancel}
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
                    ) : null}

                    <Tooltip>
                        <TooltipTrigger>
                            <Button
                                className="cursor-pointer"
                                onClick={exportProblems}
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
                                onChange={importProblems}
                                className="hidden"
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>上传</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Show delete and edit buttons when a problem is selected and not in creating mode */}
                    {!creating && selectedProblem !== 0 && (
                        <>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Button
                                        className="cursor-pointer"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Delete"
                                        onClick={() => openDeleteDialog(selectedProblem)}
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
                                            const problem = problems.find(
                                                (p: Problem) => p.id === selectedProblem,
                                            );
                                            if (problem) {
                                                openEditDialog(selectedProblem, problem.title);
                                            }
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
                </div>

                <h3 className="text-md my-3 font-medium">题目列表</h3>
                {/* <div className="text-sm text-gray-700 mb-2">
                    目标覆盖: <strong>{coverage}%</strong>
                </div> */}
                <div className="grid gap-2">
                    {problems.map((pb: Problem) => (
                        <div
                            key={pb.id}
                            onClick={() => !creating && changeSelectedProblem(pb.id)}
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
            </aside>

            {/* Main canvas area */}
            <main className="relative flex-1">
                {/* {showFireworks && <Fireworks />} */}
                {size.width > 0 && (
                    <Stage width={size.width} height={size.height}>
                        <Layer>
                            {/* Grid background */}
                            {(() => {
                                const lines = [] as any[];
                                const GRID = GRID_CELL / 2;
                                const cols = Math.ceil(size.width / GRID);
                                const rows = Math.ceil(size.height / GRID);
                                for (let i = 0; i <= cols; i++) {
                                    const x = i * GRID;
                                    lines.push(
                                        <Line
                                            key={`v-${i}`}
                                            points={[x, 0, x, size.height]}
                                            stroke="#ddd"
                                            strokeWidth={1}
                                            opacity={0.6}
                                        />,
                                    );
                                }
                                for (let j = 0; j <= rows; j++) {
                                    const y = j * GRID;
                                    lines.push(
                                        <Line
                                            key={`h-${j}`}
                                            points={[0, y, size.width, y]}
                                            stroke="#ddd"
                                            strokeWidth={1}
                                            opacity={0.6}
                                        />,
                                    );
                                }
                                return lines;
                            })()}
                            {/* 中央的黑色目标形状 - 居中显示 */}
                            {offsetTarget.map(p => {
                                return (
                                    <Line
                                        key={p.id}
                                        points={p.points}
                                        fill="black"
                                        closed
                                        opacity={0.25}
                                    />
                                );
                            })}
                            {/* 已放置/可拖拽的图形（包含右侧调色板位置） */}
                            {pieces.map(p => {
                                const cX = p.centerX ?? 0;
                                const cY = p.centerY ?? 0;

                                return (
                                    <Group
                                        ref={n => {
                                            groupRefs.current[p.id] = n;
                                        }}
                                        key={`piece-${p.id}`}
                                        x={p.x}
                                        y={p.y}
                                        rotation={p.rotation}
                                        offsetX={cX}
                                        offsetY={cY}
                                        draggable
                                        onDragMove={e => handleDragMove(e, p)}
                                        onDragStart={e => handleDragStart(e, p)}
                                        onDragEnd={e => handleDragEnd(e, p)}
                                    >
                                        <Line
                                            points={p.points}
                                            fill={p.color}
                                            closed
                                            shadowBlur={6}
                                            opacity={p.placed ? 1 : 0.9}
                                        />
                                        {/* label inside group: position at group's origin (0,0), cancel group's rotation so text stays upright */}
                                        <Text
                                            key={`label-${p.id}`}
                                            text={circled[p.id - 1]}
                                            fontSize={20}
                                            fill={'#000'}
                                            x={p.centerX ?? 0}
                                            y={p.centerY ?? 0}
                                            offsetX={10}
                                            offsetY={10}
                                            rotation={-p.rotation}
                                            onClick={e => handleLabelClick(e, p)}
                                            onTap={e => handleLabelClick(e, p)}
                                        />
                                    </Group>
                                );
                            })}
                        </Layer>
                    </Stage>
                )}
            </main>

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
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit problem dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>编辑题目名称</DialogTitle>
                        <DialogDescription>修改题目的名称，便于识别和使用。</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Input
                                id="title"
                                value={editProblemTitle}
                                onChange={e => setEditProblemTitle(e.target.value)}
                                className="col-span-4"
                                placeholder="输入题目名称"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        confirmEdit();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            取消
                        </Button>
                        <Button type="submit" onClick={confirmEdit}>
                            保存
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Save problem dialog */}
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
                                onChange={e => setSaveDialogTitleInput(e.target.value)}
                                className="col-span-4"
                                placeholder="输入题目名称"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                            取消
                        </Button>
                        <Button type="submit" onClick={confirmSaveWithTitle}>
                            保存
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
