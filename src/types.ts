export const CELL_FREE = 0;
export const CELL_OCCUPIED = 100;
export const CELL_UNKNOWN = -1;

export type CellValue = typeof CELL_FREE | typeof CELL_OCCUPIED | typeof CELL_UNKNOWN;

export interface GridMetadata {
    resolution: number; // meters per pixel
    origin: {
        x: number;
        y: number;
        theta: number;
    };
    // Optional Start/Goal for the editor
    start?: { x: number, y: number };
    goal?: { x: number, y: number };
}

export type GridData = Int8Array; // Flattened 1D array

export interface GridState {
    width: number;
    height: number;
    data: GridData;
    metadata: GridMetadata;
}

export interface GridHistoryEntry {
    data: GridData; // Snapshot of the grid data
    width: number;
    height: number;
}
