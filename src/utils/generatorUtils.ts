
import { CELL_OCCUPIED, CELL_FREE, type GridData } from '../types';

export type ShapeType = 'rect' | 'square' | 'triangle' | 'circle' | 'cross' | 'room';

export interface GeneratorOptions {
    mode: 'shapes' | 'maze' | 'bugtrap';
    shapes: ShapeType[];
    count: number;
    minSize: number;
    maxSize: number;
    spacing: number;
    allowOverlap: boolean;
    clearFirst: boolean;
    bugtrap: {
        width: number;
        length: number;
        thickness: number;
        aperture: number;
        orientation: number; // 0, 90, 180, 270 ?? Or just 0 for now.
    }
}

export interface Point { x: number, y: number }

export function generateRandomMap(
    currentData: GridData,
    width: number,
    height: number,
    options: GeneratorOptions
): Int8Array {
    const newData = options.clearFirst
        ? new Int8Array(width * height).fill(CELL_FREE)
        : new Int8Array(currentData);

    if (options.mode === 'maze') {
        return generateMaze(width, height);
    } else if (options.mode === 'bugtrap') {
        return generateBugtrap(newData, width, height, options.bugtrap);
    }

    // Shape Generation Logic (Existing)
    const maxAttempts = options.count * 100;
    let attempts = 0;
    let placedCount = 0;

    const isValid = (points: Point[]): boolean => {
        if (options.allowOverlap) return true;
        for (const p of points) {
            if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue;
            const range = options.spacing;
            for (let dy = -range; dy <= range; dy++) {
                for (let dx = -range; dx <= range; dx++) {
                    const nx = p.x + dx;
                    const ny = p.y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        if (newData[ny * width + nx] === CELL_OCCUPIED) return false;
                    }
                }
            }
        }
        return true;
    };

    while (placedCount < options.count && attempts < maxAttempts) {
        attempts++;
        const shapeType = options.shapes[Math.floor(Math.random() * options.shapes.length)];
        const points = generateShape(shapeType, width, height, options.minSize, options.maxSize);

        if (isValid(points)) {
            for (const p of points) {
                if (p.x >= 0 && p.x < width && p.y >= 0 && p.y < height) {
                    newData[p.y * width + p.x] = CELL_OCCUPIED;
                }
            }
            placedCount++;
        }
    }
    return newData;
}

// Fixed Maze Generation
function generateMaze(width: number, height: number): Int8Array {
    const maze = new Int8Array(width * height).fill(CELL_OCCUPIED);

    // Recursive Backtracker
    // Grid cells are 2x2 blocks effectively?
    // Let's use step=2.
    // ensure odd dimensions are better for mazes, but we can hack it.

    const stack: { x: number, y: number }[] = [];
    const visited = new Set<string>();

    // Start at random odd point ? 1,1
    const startX = 1;
    const startY = 1;

    if (startX >= width || startY >= height) return maze; // Too small

    stack.push({ x: startX, y: startY });
    visited.add(`${startX},${startY}`);
    maze[startY * width + startX] = CELL_FREE;

    const dirs = [
        { dx: 0, dy: -2 },
        { dx: 2, dy: 0 },
        { dx: 0, dy: 2 },
        { dx: -2, dy: 0 }
    ];

    while (stack.length > 0) {
        const current = stack[stack.length - 1];

        const neighbors = [];
        for (const d of dirs) {
            const nx = current.x + d.dx;
            const ny = current.y + d.dy;

            // Check bounds (leaving 1px border)
            if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && !visited.has(`${nx},${ny}`)) {
                neighbors.push({ nx, ny, dx: d.dx, dy: d.dy });
            }
        }

        if (neighbors.length > 0) {
            const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];

            // Carve path (wall between current and chosen)
            const wx = current.x + chosen.dx / 2;
            const wy = current.y + chosen.dy / 2;

            // Open the wall
            if (wx >= 0 && wx < width && wy >= 0 && wy < height) maze[wy * width + wx] = CELL_FREE;
            // Open the neighbor
            if (chosen.nx >= 0 && chosen.nx < width && chosen.ny >= 0 && chosen.ny < height) maze[chosen.ny * width + chosen.nx] = CELL_FREE;

            visited.add(`${chosen.nx},${chosen.ny}`);
            stack.push({ x: chosen.nx, y: chosen.ny });
        } else {
            stack.pop();
        }
    }

    return maze;
}

function generateBugtrap(
    currentData: Int8Array,
    width: number,
    height: number,
    opts: { width: number, length: number, thickness: number, aperture: number }
): Int8Array {
    const data = currentData; // In-place modification of the "clearFirst" array passed in main func

    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);

    const w = opts.width;
    const l = opts.length;
    const t = opts.thickness;

    // Calculate bounds relative to center
    // U shape opening to the RIGHT by default? Or UP?
    // Let's say opening to the RIGHT.
    // So Back Wall is on LEFT.

    // Outer Bounds
    const x0 = cx - Math.floor(l / 2);
    const y0 = cy - Math.floor(w / 2);

    // Draw 3 walls

    // 1. Top Wall (Horizontal)
    // From x0 to x0+l, thickness t, at y0
    for (let y = 0; y < t; y++) {
        for (let x = 0; x < l; x++) {
            const px = x0 + x;
            const py = y0 + y;
            if (px >= 0 && px < width && py >= 0 && py < height) data[py * width + px] = CELL_OCCUPIED;
        }
    }

    // 2. Bottom Wall (Horizontal)
    // From x0 to x0+l, thickness t, at y0 + w - t
    const yBot = y0 + w - t;
    for (let y = 0; y < t; y++) {
        for (let x = 0; x < l; x++) {
            const px = x0 + x;
            const py = yBot + y;
            if (px >= 0 && px < width && py >= 0 && py < height) data[py * width + px] = CELL_OCCUPIED;
        }
    }

    // 3. Back Wall (Vertical)
    // From y0 to y0+w, thickness t, at x0
    // Handle Aperture (gap in middle of back wall)
    const midY = cy; // Center of back wall
    const halfAp = Math.floor(opts.aperture / 2);

    for (let x = 0; x < t; x++) {
        for (let y = 0; y < w; y++) {
            const realY = y0 + y;
            // Check aperture
            if (opts.aperture > 0) {
                if (realY >= midY - halfAp && realY < midY + halfAp + (opts.aperture % 2)) {
                    continue; // Gap
                }
            }

            const px = x0 + x;
            const py = realY;
            if (px >= 0 && px < width && py >= 0 && py < height) data[py * width + px] = CELL_OCCUPIED;
        }
    }

    return data;
}

function generateShape(type: ShapeType, w: number, h: number, min: number, max: number): Point[] {
    const points: Point[] = [];
    const cx = Math.floor(Math.random() * w);
    const cy = Math.floor(Math.random() * h);
    const size = Math.floor(Math.random() * (max - min + 1)) + min;
    const size2 = Math.floor(Math.random() * (max - min + 1)) + min; // For rect/cross

    if (type === 'rect' || type === 'square') {
        const sw = type === 'square' ? size : size;
        const sh = type === 'square' ? size : size2;
        const x0 = cx - Math.floor(sw / 2);
        const y0 = cy - Math.floor(sh / 2);
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                points.push({ x: x0 + x, y: y0 + y });
            }
        }
    } else if (type === 'circle') {
        const r = Math.floor(size / 2);
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                if (x * x + y * y <= r * r) {
                    points.push({ x: cx + x, y: cy + y });
                }
            }
        }
    } else if (type === 'triangle') {
        const hTri = size;
        const x0 = cx;
        const y0 = cy - Math.floor(hTri / 2);
        for (let y = 0; y < hTri; y++) {
            const widthAtY = Math.floor((y / hTri) * size);
            for (let x = -widthAtY; x <= widthAtY; x++) {
                points.push({ x: x0 + x, y: y0 + y });
            }
        }
    } else if (type === 'cross') {
        const thickness = Math.max(1, Math.floor(size / 3));
        const len = size;
        // Horizontal
        const x0 = cx - Math.floor(len / 2);
        const y0 = cy - Math.floor(thickness / 2);
        for (let x = 0; x < len; x++) {
            for (let y = 0; y < thickness; y++) points.push({ x: x0 + x, y: y0 + y });
        }
        // Vertical
        const x1 = cx - Math.floor(thickness / 2);
        const y1 = cy - Math.floor(len / 2);
        for (let y = 0; y < len; y++) {
            for (let x = 0; x < thickness; x++) points.push({ x: x1 + x, y: y1 + y });
        }
    } else if (type === 'room') {
        // Hollow rectangle
        const sw = size;
        const sh = size2;
        const x0 = cx - Math.floor(sw / 2);
        const y0 = cy - Math.floor(sh / 2);
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                // Only borders
                if (x === 0 || x === sw - 1 || y === 0 || y === sh - 1) {
                    points.push({ x: x0 + x, y: y0 + y });
                }
            }
        }
    }

    return points;
}
