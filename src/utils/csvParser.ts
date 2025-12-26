import type { GridData, GridMetadata } from '../types';

export interface ParsedCSV {
    width: number;
    height: number;
    data: GridData;
    metadata: GridMetadata;
}

/**
 * Parses a CSV file containing occupancy grid data
 * Format:
 *   # start,x,y (optional)
 *   # goal,x,y (optional)
 *   val,val,val,...
 *   val,val,val,...
 *   ...
 */
export function parseCSV(csvText: string, defaultResolution: number = 0.05): ParsedCSV {
    const lines = csvText.trim().split('\n');
    const dataRows: string[] = [];
    let start: { x: number; y: number } | undefined;
    let goal: { x: number; y: number } | undefined;

    // Parse comment lines and collect data rows
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('#')) {
            // Parse metadata comments
            const parts = trimmed.substring(1).trim().split(',');
            if (parts.length >= 3) {
                const type = parts[0].trim();
                const x = parseInt(parts[1].trim(), 10);
                const y = parseInt(parts[2].trim(), 10);
                
                if (!isNaN(x) && !isNaN(y)) {
                    if (type === 'start') {
                        start = { x, y };
                    } else if (type === 'goal') {
                        goal = { x, y };
                    }
                }
            }
        } else {
            // Data row
            dataRows.push(trimmed);
        }
    }

    if (dataRows.length === 0) {
        throw new Error('CSV file contains no data rows');
    }

    // Determine dimensions from first row
    const firstRow = dataRows[0].split(',');
    const width = firstRow.length;
    const height = dataRows.length;

    if (width === 0 || height === 0) {
        throw new Error('Invalid CSV dimensions');
    }

    // Parse all data
    const data = new Int8Array(width * height);
    for (let y = 0; y < height; y++) {
        const row = dataRows[y].split(',');
        if (row.length !== width) {
            throw new Error(`Row ${y + 1} has ${row.length} columns, expected ${width}`);
        }

        for (let x = 0; x < width; x++) {
            const val = parseInt(row[x].trim(), 10);
            if (isNaN(val)) {
                throw new Error(`Invalid value at row ${y + 1}, column ${x + 1}: "${row[x]}"`);
            }
            data[y * width + x] = val;
        }
    }

    // Create metadata
    const metadata: GridMetadata = {
        resolution: defaultResolution,
        origin: { x: 0, y: 0, theta: 0 },
        start,
        goal
    };

    return {
        width,
        height,
        data,
        metadata
    };
}

