import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CELL_OCCUPIED, CELL_FREE } from '../types';

// Actually standard resize cursors + arrows in CSS/SVG is better.

interface GridCanvasProps {
    width: number;
    height: number;
    data: Int8Array;
    metadata?: any;
    tool: string;
    onUpdate: (data: Int8Array) => void;
    onSetStart?: (x: number, y: number) => void;
    onSetGoal?: (x: number, y: number) => void;
    onResize?: (w: number, h: number, ox: number, oy: number) => void;
    useRelativeCoords?: boolean;
}
// Define handle for imperative methods
export interface GridCanvasHandle {
    resetView: () => void;
    recenterAroundStart: () => void;
}

export const GridCanvas = React.forwardRef<GridCanvasHandle, GridCanvasProps>(({ width, height, data, metadata, tool, onUpdate, onSetStart, onSetGoal, onResize, useRelativeCoords = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Transform state: scale (k), translation (x, y)
    const [transform, setTransform] = useState({ k: 20, x: 50, y: 50 }); // Start with reasonable zoom
    const [initialized, setInitialized] = useState(false);
    const [isPanning, setIsPanning] = useState(false);

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false);
    const startPosRef = useRef<{ x: number, y: number } | null>(null);
    const lastPosRef = useRef<{ x: number, y: number } | null>(null);

    // Resizing State
    const activeDragNodeRef = useRef<'top' | 'bottom' | 'left' | 'right' | null>(null);
    const resizeStartRef = useRef<{ mx: number, my: number, w: number, h: number, tx: number, ty: number } | null>(null);

    // Transient resizing state for "online" visualization
    const [ghostDims, setGhostDims] = useState<{ w: number, h: number, ox: number, oy: number } | null>(null);

    const [previewRect, setPreviewRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [hoverCoord, setHoverCoord] = useState<{ x: number, y: number } | null>(null);

    // Effective Dimensions (Ghost if resizing, else Props)
    const activeW = ghostDims ? ghostDims.w : width;
    const activeH = ghostDims ? ghostDims.h : height;
    const activeOX = ghostDims ? ghostDims.ox : 0;
    const activeOY = ghostDims ? ghostDims.oy : 0;

    // Auto-fit function
    const fitView = useCallback(() => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const kx = (clientWidth * 0.95) / width;
        const ky = (clientHeight * 0.95) / height;
        const k = Math.min(Math.min(kx, ky), 50);
        const x = (clientWidth - width * k) / 2;
        const y = (clientHeight - height * k) / 2;
        setTransform({ k, x, y });
    }, [width, height]);

    // Initial Auto-fit
    useEffect(() => {
        if (!initialized && containerRef.current) {
            fitView();
            setInitialized(true);
        }
    }, [initialized, fitView]);

    // Recenter around start point
    const recenterAroundStart = useCallback(() => {
        if (!metadata?.start || !containerRef.current) return;
        
        setTransform(prev => {
            const { clientWidth, clientHeight } = containerRef.current!;
            const startX = metadata.start!.x;
            const startY = metadata.start!.y;
            
            // Calculate the screen position of the start point
            const startScreenX = prev.x + startX * prev.k;
            const startScreenY = prev.y + startY * prev.k;
            
            // Calculate how much we need to shift to center it
            const deltaX = clientWidth / 2 - startScreenX;
            const deltaY = clientHeight / 2 - startScreenY;
            
            // Update transform to center on start
            return {
                k: prev.k,
                x: prev.x + deltaX,
                y: prev.y + deltaY
            };
        });
    }, [metadata]);

    // Expose resetView and recenterAroundStart via ref
    React.useImperativeHandle(ref, () => ({
        resetView: fitView,
        recenterAroundStart
    }));

    // Helper: Screen to World (Grid coordinates)
    const screenToWorld = (sx: number, sy: number) => {
        return {
            x: Math.floor((sx - transform.x) / transform.k),
            y: Math.floor((sy - transform.y) / transform.k)
        };
    };

    // Helper for handle styles
    const handleStyle = (pos: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => {
        // Calculate position in screen space
        // Grid TopLeft in screen: tx, ty
        // Grid Width in screen: w * k
        const gx = transform.x;
        const gy = transform.y;
        const gw = width * transform.k;
        const gh = height * transform.k;
        const size = 10 * Math.max(0.5, Math.min(1, transform.k / 10)); // Dynamic handle size?
        const offset = 5;

        const style: React.CSSProperties = {
            position: 'absolute',
            zIndex: 100, // Above canvas
            // centered on edge
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
        };

        // Centered handles
        if (pos === 'top') {
            return { ...style, top: gy - size - offset, left: gx + gw / 2 - 20, width: 40, height: size, cursor: 'ns-resize' };
        } else if (pos === 'bottom') {
            return { ...style, top: gy + gh + offset, left: gx + gw / 2 - 20, width: 40, height: size, cursor: 'ns-resize' };
        } else if (pos === 'left') {
            return { ...style, top: gy + gh / 2 - 20, left: gx - size - offset, width: size, height: 40, cursor: 'ew-resize' };
        } else if (pos === 'right') {
            return { ...style, top: gy + gh / 2 - 20, left: gx + gw + offset, width: size, height: 40, cursor: 'ew-resize' };
        }
        return {};
    };

    const startResize = (e: React.MouseEvent, node: 'top' | 'bottom' | 'left' | 'right') => {
        e.stopPropagation();
        e.preventDefault();

        activeDragNodeRef.current = node;
        resizeStartRef.current = {
            mx: e.clientX,
            my: e.clientY,
            w: width,
            h: height,
            tx: transform.x,
            ty: transform.y
        };

        document.body.style.cursor = (node === 'top' || node === 'bottom') ? 'ns-resize' : 'ew-resize';
        window.addEventListener('mouseup', handleResizeUpWindow);
        window.addEventListener('mousemove', handleResizeMoveWindow);
    };

    // --- Rendering Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const render = () => {
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;

            if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
                canvas.width = clientWidth * dpr;
                canvas.height = clientHeight * dpr;
                ctx.scale(dpr, dpr);
                canvas.style.width = `${clientWidth}px`;
                canvas.style.height = `${clientHeight}px`;
            }

            // Clear Background (Whole Canvas)
            ctx.fillStyle = '#f3f4f6'; // Light gray outer background
            ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            ctx.save();
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.k, transform.k);

            // 1. Draw Grid Background (Active Area)
            ctx.fillStyle = '#ffffff'; // Pure White
            ctx.fillRect(0, 0, activeW, activeH);

            // 2. Render Existing Data
            // If resizing, we need to respect offset (activeOX, activeOY)
            // We only render the intersection of old data and new active area.

            // Prepare Grid Data Image (of original data)
            // Optimization: Create ImageData once per `data` change usually, but here we render every frame.
            // For 500x500 it's fast enough.
            const gridImage = ctx.createImageData(width, height);
            const buf = new Uint32Array(gridImage.data.buffer);

            for (let i = 0; i < data.length; i++) {
                const val = data[i];
                if (val === CELL_OCCUPIED) {
                    buf[i] = 0xFF000000; // Black
                } else if (val === CELL_FREE) {
                    buf[i] = 0xFFFFFFFF; // White
                } else {
                    buf[i] = 0xFFD1D5DB; // Gray 300
                }
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            tempCanvas.getContext('2d')?.putImageData(gridImage, 0, 0);

            ctx.imageSmoothingEnabled = false;
            // Draw original data at -activeOX, -activeOY relative to new origin?
            // If I expanded LEFT by 10 (activeOX = 10, offset of old origin in new grid), 
            // then old data starts at (10, 0) in new grid.
            ctx.drawImage(tempCanvas, activeOX, activeOY);

            // 3. Grid Lines (Black Mesh)
            ctx.lineWidth = 0.5 / transform.k;
            // "visible black edges inside the grid so that each cell is visible"
            // User requested 1.0 alpha black.
            ctx.lineWidth = 0.05; // Thin enough to not obscure data but visible
            ctx.strokeStyle = '#555555'; // Dark Grey

            ctx.beginPath();
            // Vertical lines
            for (let x = 0; x <= activeW; x++) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, activeH);
            }
            // Horizontal lines
            for (let y = 0; y <= activeH; y++) {
                ctx.moveTo(0, y);
                ctx.lineTo(activeW, y);
            }
            ctx.stroke();

            // 4. Main Border (Thicker)
            ctx.lineWidth = 2 / transform.k;
            ctx.strokeStyle = '#000000';
            ctx.strokeRect(0, 0, activeW, activeH);

            // 5. Start / Goal
            const drawPoint = (p: { x: number, y: number }, color: string) => {
                // Adjust for offset if ghost dims active
                const px = p.x + activeOX;
                const py = p.y + activeOY;

                if (px >= 0 && px < activeW && py >= 0 && py < activeH) {
                    ctx.fillStyle = color;
                    ctx.fillRect(px, py, 1, 1);
                }
            };

            if (metadata?.start) drawPoint(metadata.start, '#22c55e');
            if (metadata?.goal) drawPoint(metadata.goal, '#ef4444');

            // 6. Preview Rect
            if (previewRect) {
                ctx.fillStyle = tool === 'eraser' ? 'rgba(251, 252, 254, 0.8)' : 'rgba(0,0,0,0.5)';
                // Adjust for offset? drawing tools use current screen coords map to activeW?
                // Wait, if I resize, I disable tools.
                ctx.fillRect(previewRect.x, previewRect.y, previewRect.w, previewRect.h);
            }

            ctx.restore();

            // 7. Axis Rulers (Outside transform usually, or transformed?)
            // Rulers should align with grid.
            // Screen coords of top-left grid corner:
            const tlX = transform.x;
            const tlY = transform.y;
            const cellSize = transform.k;

            ctx.font = '10px monospace';
            ctx.fillStyle = '#6b7280';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            // X Axis
            // Draw every 5 or 10 cells depending on zoom
            // Step size power of 10 or 5
            // Min px distance between numbers = 30px
            const step = Math.ceil(30 / cellSize);
            // const xStart = Math.floor(-transform.x / transform.k); // Visible start
            // Just iterate relevant range

            // Helper to get label value (absolute or relative to start)
            const getLabel = (index: number, startPos: number | undefined, resolution: number): string => {
                if (!useRelativeCoords || startPos === undefined) {
                    // Absolute world coordinates
                    return (index * resolution).toFixed(2);
                }
                // Relative to start: Start becomes 0.0
                return ((index - startPos) * resolution).toFixed(2);
            };

            for (let i = 0; i <= activeW; i += Math.max(1, step)) {
                // Determine label value
                const val = useRelativeCoords && metadata?.start
                    ? getLabel(i, metadata.start.x, metadata.resolution)
                    : i.toString();
                const sx = tlX + i * cellSize;
                if (sx > 0 && sx < clientWidth) {
                    ctx.fillText(val, sx, tlY - 4);
                    // Tick mark
                    ctx.beginPath();
                    ctx.moveTo(sx, tlY);
                    ctx.lineTo(sx, tlY - 3);
                    ctx.stroke();
                }
            }

            // Y Axis
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (let i = 0; i <= activeH; i += Math.max(1, step)) {
                const val = useRelativeCoords && metadata?.start
                    ? getLabel(i, metadata.start.y, metadata.resolution)
                    : i.toString();
                const sy = tlY + i * cellSize;
                if (sy > 0 && sy < clientHeight) {
                    ctx.fillText(val, tlX - 8, sy);
                    ctx.beginPath();
                    ctx.moveTo(tlX, sy);
                    ctx.lineTo(tlX - 5, sy);
                    ctx.stroke();
                }
            }
        };

        const id = requestAnimationFrame(render);
        return () => cancelAnimationFrame(id);
    }, [width, height, data, metadata, transform, previewRect, tool, ghostDims, activeW, activeH, activeOX, activeOY, useRelativeCoords]);


    // --- Event Handling ---
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const scaleFactor = 1 + delta;
        const newK = Math.min(Math.max(transform.k * scaleFactor, 2), 100); // Max zoom 100, min 2

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const wx = (mx - transform.x) / transform.k;
        const wy = (my - transform.y) / transform.k;
        const newTx = mx - wx * newK;
        const newTy = my - wy * newK;

        setTransform({ k: newK, x: newTx, y: newTy });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            return;
        }

        if (e.button === 0) {
            if (!containerRef.current) return;
            // If resizing, ignore drawing?
            // Actually resize handles intercept events via stopsPropagation.

            const rect = containerRef.current.getBoundingClientRect();
            const pos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

            // Bounds check
            if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) return;

            if (tool === 'pencil' || tool === 'eraser') {
                setIsDrawing(true);
                lastPosRef.current = pos;
                modifyGrid([{ x: pos.x, y: pos.y }], tool === 'pencil' ? CELL_OCCUPIED : CELL_FREE);
            } else if (tool === 'rect') {
                setIsDrawing(true);
                startPosRef.current = pos;
                setPreviewRect({ x: pos.x, y: pos.y, w: 1, h: 1 });
            } else if (tool === 'start') {
                onSetStart?.(pos.x, pos.y);
            } else if (tool === 'goal') {
                onSetGoal?.(pos.x, pos.y);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const pos = screenToWorld(mouseX, mouseY);

        // Update Hover Coord
        if (pos.x >= 0 && pos.x < activeW && pos.y >= 0 && pos.y < activeH) {
            setHoverCoord(pos);
        } else {
            setHoverCoord(null);
        }

        // Pan
        if (isPanning) {
            setTransform(prev => ({
                ...prev,
                x: prev.x + e.movementX,
                y: prev.y + e.movementY
            }));
            return;
        }

        // Draw
        if (isDrawing) {
            if (tool === 'rect' && startPosRef.current) {
                const sx = startPosRef.current.x;
                const sy = startPosRef.current.y;
                setPreviewRect({
                    x: Math.min(sx, pos.x),
                    y: Math.min(sy, pos.y),
                    w: Math.abs(pos.x - sx) + 1,
                    h: Math.abs(pos.y - sy) + 1
                });
            } else if ((tool === 'pencil' || tool === 'eraser') && lastPosRef.current) {
                const points = bresenham(lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y);
                modifyGrid(points, tool === 'pencil' ? CELL_OCCUPIED : CELL_FREE);
                lastPosRef.current = { x: pos.x, y: pos.y };
            }
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setIsDrawing(false);

        if (tool === 'rect' && previewRect) {
            const points = [];
            for (let py = previewRect.y; py < previewRect.y + previewRect.h; py++) {
                for (let px = previewRect.x; px < previewRect.x + previewRect.w; px++) {
                    points.push({ x: px, y: py });
                }
            }
            modifyGrid(points, CELL_OCCUPIED);
            setPreviewRect(null);
        }

        startPosRef.current = null;
        lastPosRef.current = null;
    };

    const modifyGrid = (points: { x: number, y: number }[], explicitValue?: number) => {
        const newData = new Int8Array(data);
        let changed = false;
        const targetVal = explicitValue ?? (tool === 'eraser' ? CELL_FREE : CELL_OCCUPIED);

        points.forEach(p => {
            if (p.x >= 0 && p.x < width && p.y >= 0 && p.y < height) {
                const idx = p.y * width + p.x;
                if (newData[idx] !== targetVal) {
                    newData[idx] = targetVal;
                    changed = true;
                }
            }
        });

        if (changed) {
            onUpdate(newData);
        }
    };

    // Bresenham
    const bresenham = (x0: number, y0: number, x1: number, y1: number) => {
        const points = [];
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            points.push({ x: x0, y: y0 });
            if ((x0 === x1) && (y0 === y1)) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        return points;
    };


    // --- Resize Logic ---


    const handleResizeMoveWindow = useCallback((e: MouseEvent) => {
        const node = activeDragNodeRef.current;
        const start = resizeStartRef.current;
        if (!node || !start) return;

        const dxPx = e.clientX - start.mx;
        const dyPx = e.clientY - start.my;

        const dX = Math.round(dxPx / transform.k);
        const dY = Math.round(dyPx / transform.k);

        let newW = start.w;
        let newH = start.h;
        let offX = 0;
        let offY = 0;

        if (node === 'right') {
            newW = Math.max(1, start.w + dX);
        } else if (node === 'bottom') {
            newH = Math.max(1, start.h + dY);
        } else if (node === 'left') {
            newW = Math.max(1, start.w - dX);
            offX = -dX;
        } else if (node === 'top') {
            newH = Math.max(1, start.h - dY);
            offY = -dY;
        }

        // Update ghost dims for online visualization
        setGhostDims({ w: newW, h: newH, ox: offX, oy: offY });

        // VISUAL OFFSET COMPENSATION
        // If resizing from left/top, shift visual origin so the opposing edge stays fixed.
        // We calculate expected shift from start.tx
        if (offX !== 0 || offY !== 0) {
            // offX is amount index 0 shifted right.
            // We want index 0 to move left in screen space by offX*k?
            // Wait. offX=10 means Data shifted right by 10 cells.
            // We want Data to visually stay put.
            // So we must shift View Origin Left by 10 cells.
            // newTx = start.tx - offX * k
            const newTx = start.tx - (offX * transform.k);
            const newTy = start.ty - (offY * transform.k);

            // Only update if changed significantly? 
            // React state updates are cheap if value is same.
            setTransform(prev => ({ ...prev, x: newTx, y: newTy }));
        }
    }, [transform.k]);

    const handleResizeUpWindow = useCallback((e: MouseEvent) => {
        document.body.style.cursor = '';
        window.removeEventListener('mouseup', handleResizeUpWindow);
        window.removeEventListener('mousemove', handleResizeMoveWindow);

        const node = activeDragNodeRef.current;
        activeDragNodeRef.current = null;
        setGhostDims(null); // Clear ghost

        if (!node || !resizeStartRef.current) return;

        // Calculate final
        const start = resizeStartRef.current;
        const dX = Math.round((e.clientX - start.mx) / transform.k);
        const dY = Math.round((e.clientY - start.my) / transform.k);

        let newW = start.w;
        let newH = start.h;
        let offX = 0;
        let offY = 0;

        if (node === 'right') {
            newW = Math.max(1, newW + dX);
        } else if (node === 'bottom') {
            newH = Math.max(1, newH + dY);
        } else if (node === 'left') {
            newW = Math.max(1, newW - dX);
            offX = -dX;
        } else if (node === 'top') {
            newH = Math.max(1, newH - dY);
            offY = -dY;
        }

        // Apply final visual shift one last time to ensure sync?
        // Actually, if onResize triggers re-render, props update.
        // We just want to ensure Transform is correct.
        if (offX !== 0 || offY !== 0) {
            const newTx = start.tx - (offX * transform.k);
            const newTy = start.ty - (offY * transform.k);
            setTransform(prev => ({ ...prev, x: newTx, y: newTy }));
        }

        if (newW !== width || newH !== height || offX !== 0 || offY !== 0) {
            onResize?.(newW, newH, offX, offY);
        }
    }, [width, height, onResize, transform.k, handleResizeMoveWindow]); // Dependencies


    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
        >
            <canvas ref={canvasRef} className="cursor-crosshair" />

            {/* Tooltip */}
            {hoverCoord && (
                <div
                    className="absolute pointer-events-none bg-black/80 text-white text-xs px-2 py-1 rounded shadow"
                    style={{
                        left: transform.x + hoverCoord.x * transform.k + 15,
                        top: transform.y + hoverCoord.y * transform.k - 15
                    }}
                >
                    {hoverCoord.x}, {hoverCoord.y}
                </div>
            )}

            {/* Resize Handles */}
            {initialized && (
                <>
                    <div style={handleStyle('top')} onMouseDown={(e) => startResize(e, 'top')} title="Drag Height">
                        {/* Icon */}
                        <div className="w-4 h-1 bg-gray-400 rounded-full" />
                    </div>
                    <div style={handleStyle('bottom')} onMouseDown={(e) => startResize(e, 'bottom')} title="Drag Height">
                        <div className="w-4 h-1 bg-gray-400 rounded-full" />
                    </div>
                    <div style={handleStyle('left')} onMouseDown={(e) => startResize(e, 'left')} title="Drag Width">
                        <div className="w-1 h-4 bg-gray-400 rounded-full" />
                    </div>
                    <div style={handleStyle('right')} onMouseDown={(e) => startResize(e, 'right')} title="Drag Width">
                        <div className="w-1 h-4 bg-gray-400 rounded-full" />
                    </div>
                </>
            )}
        </div>
    );
    // End GridCanvas
});
