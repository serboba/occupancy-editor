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

    // Auto-fit function (center the grid)
    const fitView = useCallback(() => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const kx = (clientWidth * 0.95) / width;
        const ky = (clientHeight * 0.95) / height;
        const k = Math.min(Math.min(kx, ky), 50);
        // Center the grid (transform.x and transform.y represent the center point)
        const x = clientWidth / 2;
        const y = clientHeight / 2;
        setTransform({ k, x, y });
    }, [width, height]);

    // Initial Auto-fit
    useEffect(() => {
        if (!initialized && containerRef.current) {
            fitView();
            setInitialized(true);
        }
    }, [initialized, fitView]);

    // Coordinate conversion helpers
    // Display coordinates: center-based (-width/2 to +width/2, -height/2 to +height/2)
    // Internal coordinates: 0-based (0 to width-1, 0 to height-1)
    const displayToInternal = useCallback((dx: number, dy: number) => {
        const centerX = Math.floor(activeW / 2);
        const centerY = Math.floor(activeH / 2);
        return {
            x: Math.floor(dx + centerX),
            y: Math.floor(dy + centerY)
        };
    }, [activeW, activeH]);
    
    const internalToDisplay = useCallback((ix: number, iy: number) => {
        const centerX = Math.floor(activeW / 2);
        const centerY = Math.floor(activeH / 2);
        return {
            x: ix - centerX,
            y: iy - centerY
        };
    }, [activeW, activeH]);

    // Recenter around start point
    const recenterAroundStart = useCallback(() => {
        if (!metadata?.start || !containerRef.current) return;
        
        setTransform(prev => {
            const { clientWidth, clientHeight } = containerRef.current!;
            // Start is in internal coordinates, convert to display
            const startDisplay = internalToDisplay(metadata.start!.x, metadata.start!.y);
            
            // Calculate the screen position of the start point (center-based)
            const startScreenX = prev.x + startDisplay.x * prev.k;
            const startScreenY = prev.y + startDisplay.y * prev.k;
            
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
    }, [metadata, activeW, activeH, internalToDisplay]);

    // Expose resetView and recenterAroundStart via ref
    React.useImperativeHandle(ref, () => ({
        resetView: fitView,
        recenterAroundStart
    }));
    
    // Helper: Screen to Display coordinates (center-based)
    const screenToDisplay = useCallback((sx: number, sy: number) => {
        // transform.x and transform.y represent the center point in screen coordinates
        // Convert screen coords to display coords (center-based)
        const displayX = (sx - transform.x) / transform.k;
        const displayY = (sy - transform.y) / transform.k;
        return {
            x: Math.floor(displayX),
            y: Math.floor(displayY)
        };
    }, [transform]);

    // Helper for handle styles (center-based coordinates)
    const handleStyle = (pos: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => {
        // Calculate position in screen space (center-based)
        // transform.x/y is the center point
        const halfW = (activeW * transform.k) / 2;
        const halfH = (activeH * transform.k) / 2;
        const size = 10 * Math.max(0.5, Math.min(1, transform.k / 10));
        const offset = 5;

        const style: React.CSSProperties = {
            position: 'absolute',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
        };

        // Centered handles (positioned relative to center)
        if (pos === 'top') {
            return { ...style, top: transform.y - halfH - size - offset, left: transform.x - 20, width: 40, height: size, cursor: 'ns-resize' };
        } else if (pos === 'bottom') {
            return { ...style, top: transform.y + halfH + offset, left: transform.x - 20, width: 40, height: size, cursor: 'ns-resize' };
        } else if (pos === 'left') {
            return { ...style, top: transform.y - 20, left: transform.x - halfW - size - offset, width: size, height: 40, cursor: 'ew-resize' };
        } else if (pos === 'right') {
            return { ...style, top: transform.y - 20, left: transform.x + halfW + offset, width: size, height: 40, cursor: 'ew-resize' };
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
            
            // Center-based coordinate system
            const centerX = Math.floor(activeW / 2);
            const centerY = Math.floor(activeH / 2);
            
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.k, transform.k);
            ctx.translate(-centerX, -centerY); // Shift so center is at (0,0)

            // 1. Draw Grid Background (Active Area)
            ctx.fillStyle = '#ffffff'; // Pure White
            ctx.fillRect(-centerX, -centerY, activeW, activeH);

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
            // Draw original data centered
            // Map internal coordinates (0-based) to display coordinates (center-based)
            const oldCenterX = Math.floor(width / 2);
            const oldCenterY = Math.floor(height / 2);
            ctx.drawImage(tempCanvas, -oldCenterX + activeOX, -oldCenterY + activeOY);

            // 3. Grid Lines (Black Mesh)
            ctx.lineWidth = 0.5 / transform.k;
            // "visible black edges inside the grid so that each cell is visible"
            // User requested 1.0 alpha black.
            ctx.lineWidth = 0.05; // Thin enough to not obscure data but visible
            ctx.strokeStyle = '#555555'; // Dark Grey

            ctx.beginPath();
            // Vertical lines (center-based)
            // Display coordinates: -centerX to (activeW - centerX - 1)
            // For 50x50: center=25, range is -25 to +24 (50 cells, no true center)
            // For 51x51: center=25, range is -25 to +25 (51 cells, center at 0,0)
            const minX = -centerX;
            const maxX = activeW - centerX; // Exclusive upper bound
            const minY = -centerY;
            const maxY = activeH - centerY; // Exclusive upper bound
            
            for (let x = minX; x <= maxX; x++) {
                ctx.moveTo(x, minY);
                ctx.lineTo(x, maxY);
            }
            // Horizontal lines
            for (let y = minY; y <= maxY; y++) {
                ctx.moveTo(minX, y);
                ctx.lineTo(maxX, y);
            }
            ctx.stroke();

            // 4. Main Border (Thicker) - center-based
            ctx.lineWidth = 2 / transform.k;
            ctx.strokeStyle = '#000000';
            ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
            
            // 4.5. Center axes (highlight 0,0)
            ctx.lineWidth = 1 / transform.k;
            ctx.strokeStyle = '#3b82f6'; // Blue for center axes
            ctx.beginPath();
            // Vertical center line
            ctx.moveTo(0, minY);
            ctx.lineTo(0, maxY);
            // Horizontal center line
            ctx.moveTo(minX, 0);
            ctx.lineTo(maxX, 0);
            ctx.stroke();

            // 5. Start / Goal (in display coordinates, already center-based)
            const drawPoint = (p: { x: number, y: number }, color: string) => {
                // p is in display coordinates (center-based)
                const px = p.x;
                const py = p.y;
                
                // Check if within bounds
                if (px >= minX && px < maxX && py >= minY && py < maxY) {
                    ctx.fillStyle = color;
                    ctx.fillRect(px, py, 1, 1);
                }
            };

            if (metadata?.start) {
                // Convert internal coords to display coords if needed
                const startDisplay = internalToDisplay(metadata.start.x, metadata.start.y);
                drawPoint(startDisplay, '#22c55e');
            }
            if (metadata?.goal) {
                const goalDisplay = internalToDisplay(metadata.goal.x, metadata.goal.y);
                drawPoint(goalDisplay, '#ef4444');
            }

            // 6. Preview Rect (convert to display coordinates)
            if (previewRect) {
                ctx.fillStyle = tool === 'eraser' ? 'rgba(251, 252, 254, 0.8)' : 'rgba(0,0,0,0.5)';
                // previewRect is in internal coordinates, convert to display
                const rectDisplay = internalToDisplay(previewRect.x, previewRect.y);
                ctx.fillRect(rectDisplay.x, rectDisplay.y, previewRect.w, previewRect.h);
            }

            ctx.restore();

            // 7. Axis Rulers (center-based coordinates)
            // Calculate center position in screen coordinates
            const centerScreenX = transform.x;
            const centerScreenY = transform.y;
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

            // Helper to get label value (center-based display coordinates)
            const getLabel = (displayCoord: number, startPos: number | undefined, resolution: number): string => {
                if (!useRelativeCoords || startPos === undefined) {
                    // Absolute world coordinates (center-based)
                    return (displayCoord * resolution).toFixed(2);
                }
                // Relative to start: Start becomes 0.0
                const startDisplay = internalToDisplay(startPos, 0).x;
                return ((displayCoord - startDisplay) * resolution).toFixed(2);
            };

            // X Axis Ruler (center-based: negative to positive)
            const minDisplayX = -centerX;
            const maxDisplayX = activeW - centerX;
            for (let displayX = minDisplayX; displayX <= maxDisplayX; displayX += Math.max(1, step)) {
                const screenX = centerScreenX + displayX * cellSize;
                if (screenX > 0 && screenX < clientWidth) {
                    const val = useRelativeCoords && metadata?.start
                        ? getLabel(displayX, metadata.start.x, metadata.resolution)
                        : displayX.toString();
                    ctx.fillText(val, screenX, centerScreenY - 4);
                    // Tick mark
                    ctx.beginPath();
                    ctx.moveTo(screenX, centerScreenY);
                    ctx.lineTo(screenX, centerScreenY - 3);
                    ctx.stroke();
                }
            }

            // Y Axis Ruler (center-based: negative to positive, up is positive)
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const minDisplayY = -centerY;
            const maxDisplayY = activeH - centerY;
            for (let displayY = minDisplayY; displayY <= maxDisplayY; displayY += Math.max(1, step)) {
                const screenY = centerScreenY + displayY * cellSize;
                if (screenY > 0 && screenY < clientHeight) {
                    const val = useRelativeCoords && metadata?.start
                        ? getLabel(-displayY, metadata.start.y, metadata.resolution) // Negate Y so up is positive
                        : (-displayY).toString(); // Negate so up is positive
                    ctx.fillText(val, centerScreenX - 8, screenY);
                    ctx.beginPath();
                    ctx.moveTo(centerScreenX, screenY);
                    ctx.lineTo(centerScreenX - 5, screenY);
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
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const display = screenToDisplay(mouseX, mouseY);
            const internal = displayToInternal(display.x, display.y);

            // Bounds check (internal coordinates)
            if (internal.x < 0 || internal.x >= width || internal.y < 0 || internal.y >= height) return;

            if (tool === 'pencil' || tool === 'eraser') {
                setIsDrawing(true);
                lastPosRef.current = internal; // Store internal for drawing
                modifyGrid([{ x: internal.x, y: internal.y }], tool === 'pencil' ? CELL_OCCUPIED : CELL_FREE);
            } else if (tool === 'rect') {
                setIsDrawing(true);
                startPosRef.current = internal; // Store internal for rect
                setPreviewRect({ x: internal.x, y: internal.y, w: 1, h: 1 });
            } else if (tool === 'start') {
                onSetStart?.(internal.x, internal.y);
            } else if (tool === 'goal') {
                onSetGoal?.(internal.x, internal.y);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Update Hover Coord (in display coordinates)
        const display = screenToDisplay(mouseX, mouseY);
        const internal = displayToInternal(display.x, display.y);
        
        if (internal.x >= 0 && internal.x < activeW && internal.y >= 0 && internal.y < activeH) {
            setHoverCoord(display); // Store display coordinates for hover
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
            const display = screenToDisplay(mouseX, mouseY);
            const internal = displayToInternal(display.x, display.y);
            
            if (tool === 'rect' && startPosRef.current) {
                const sx = startPosRef.current.x;
                const sy = startPosRef.current.y;
                setPreviewRect({
                    x: Math.min(sx, internal.x),
                    y: Math.min(sy, internal.y),
                    w: Math.abs(internal.x - sx) + 1,
                    h: Math.abs(internal.y - sy) + 1
                });
            } else if ((tool === 'pencil' || tool === 'eraser') && lastPosRef.current) {
                const points = bresenham(lastPosRef.current.x, lastPosRef.current.y, internal.x, internal.y);
                modifyGrid(points, tool === 'pencil' ? CELL_OCCUPIED : CELL_FREE);
                lastPosRef.current = { x: internal.x, y: internal.y };
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
