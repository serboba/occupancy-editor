import type { GridData, GridState, GridMetadata } from '../types';

/**
 * Adjusts the metadata origin so that the start point's world coordinate becomes (0, 0)
 * Does NOT shift the grid data - preserves spatial integrity of the map
 * 
 * World coordinate calculation: World_X = Origin_X + (Pixel_X * Resolution)
 * To make World_X = 0 at Pixel_X = sx: 0 = New_Origin_X + (sx * res)
 * Therefore: New_Origin_X = -(sx * res)
 */
export const shiftGridToStartOrigin = (
    data: GridData,
    width: number,
    height: number,
    metadata: GridMetadata
): { data: GridData; width: number; height: number; metadata: GridMetadata } => {
    if (!metadata.start) {
        // No start point, return unchanged
        return { data, width, height, metadata };
    }

    const { x: sx, y: sy } = metadata.start;
    const res = metadata.resolution;

    /**
     * FIX: We do NOT move the pixels (no toroidal shift).
     * Instead, we change the 'origin' so that the world coordinate 
     * of the Start Pixel is (0, 0).
     * World_X = Origin_X + (Pixel_X * Resolution)
     * To make World_X = 0 at Pixel_X = sx:
     * 0 = New_Origin_X + (sx * res)  =>  New_Origin_X = -(sx * res)
     */
    const newMetadata: GridMetadata = {
        ...metadata,
        origin: {
            x: -(sx * res),
            y: -(sy * res),
            theta: metadata.origin.theta
        },
        // In the exported local grid coordinates, 
        // the start and goal pixels remain at their original indices.
        // We do NOT change start.x to 0, because the data hasn't moved.
        start: { x: sx, y: sy },
        goal: metadata.goal ? { x: metadata.goal.x, y: metadata.goal.y } : undefined
    };

    // Return the original data buffer unchanged
    return { data, width, height, metadata: newMetadata };
};

export const generateCSV = (data: GridData, width: number, height: number, metadata?: GridMetadata, shiftToStart: boolean = false): string => {
    let csv = '';
    let finalData = data;
    let finalMetadata = metadata;
    
    // Shift grid if requested
    if (shiftToStart && metadata?.start) {
        const shifted = shiftGridToStartOrigin(data, width, height, metadata);
        finalData = shifted.data;
        finalMetadata = shifted.metadata;
        
        // For CSV export, show start as (0,0) and goal relative to start
        // even though grid data positions remain unchanged
        finalMetadata = {
            ...finalMetadata,
            start: { x: 0, y: 0 },
            goal: metadata.goal ? {
                x: metadata.goal.x - metadata.start.x,
                y: metadata.goal.y - metadata.start.y
            } : undefined
        };
    }
    
    // Add metadata as comments at the top
    if (finalMetadata) {
        if (finalMetadata.start) {
            csv += `# start,${finalMetadata.start.x},${finalMetadata.start.y}\n`;
        }
        if (finalMetadata.goal) {
            csv += `# goal,${finalMetadata.goal.x},${finalMetadata.goal.y}\n`;
        }
    }
    
    // Add grid data
    for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
            row.push(finalData[y * width + x]);
        }
        csv += row.join(',') + '\n';
    }
    return csv;
};

export const generateJSON = (state: GridState, shiftToStart: boolean = false): string => {
    let finalState = state;
    
    // Shift grid if requested
    if (shiftToStart && state.metadata.start) {
        const shifted = shiftGridToStartOrigin(state.data, state.width, state.height, state.metadata);
        finalState = {
            width: shifted.width,
            height: shifted.height,
            data: shifted.data,
            metadata: {
                ...shifted.metadata,
                // For JSON export, show start as (0,0) and goal relative to start
                // even though grid data positions remain unchanged
                start: { x: 0, y: 0 },
                goal: state.metadata.goal ? {
                    x: state.metadata.goal.x - state.metadata.start.x,
                    y: state.metadata.goal.y - state.metadata.start.y
                } : undefined
            }
        };
    }
    
    // Convert Int8Array to regular array for JSON serialization
    const serializable = {
        ...finalState,
        data: Array.from(finalState.data)
    };
    return JSON.stringify(serializable, null, 2);
};

/**
 * Generates a PNG image of the occupancy grid
 */
export const generatePNG = async (
    data: GridData,
    width: number,
    height: number,
    metadata?: GridMetadata,
    shiftToStart: boolean = false
): Promise<Blob> => {
    let finalData = data;
    let finalMetadata = metadata;
    
    // Shift grid if requested
    if (shiftToStart && metadata?.start) {
        const shifted = shiftGridToStartOrigin(data, width, height, metadata);
        finalData = shifted.data;
        finalMetadata = shifted.metadata;
    }
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    // Create ImageData
    const imageData = ctx.createImageData(width, height);
    const buf = new Uint32Array(imageData.data.buffer);
    
    // Fill with grid data
    for (let i = 0; i < finalData.length; i++) {
        const val = finalData[i];
        if (val === 100) { // CELL_OCCUPIED
            buf[i] = 0xFF000000; // Black
        } else if (val === 0) { // CELL_FREE
            buf[i] = 0xFFFFFFFF; // White
        } else { // CELL_UNKNOWN
            buf[i] = 0xFFD1D5DB; // Gray
        }
    }
    
    // Draw start and goal if present
    if (finalMetadata) {
        if (finalMetadata.start) {
            const idx = finalMetadata.start.y * width + finalMetadata.start.x;
            if (idx >= 0 && idx < buf.length) {
                buf[idx] = 0xFF22C55E; // Green
            }
        }
        if (finalMetadata.goal) {
            const idx = finalMetadata.goal.y * width + finalMetadata.goal.x;
            if (idx >= 0 && idx < buf.length) {
                buf[idx] = 0xFFEF4444; // Red
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to blob
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to create PNG blob'));
            }
        }, 'image/png');
    });
};
