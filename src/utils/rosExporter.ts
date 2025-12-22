import { type GridData, type GridMetadata, CELL_OCCUPIED, CELL_FREE } from '../types';
import { shiftGridToStartOrigin } from './exportUtils';

/**
 * Generates a PGM (P2 format) string from the grid data.
 * ROS map_server:
 * - Occupied (100) -> 0 (Black)
 * - Free (0) -> 254 (White)
 * - Unknown (-1) -> 205 (Gray)
 */
export function generatePGM(data: GridData, width: number, height: number, metadata?: GridMetadata, shiftToStart: boolean = false): string {
    let finalData = data;
    
    // Shift grid if requested
    if (shiftToStart && metadata?.start) {
        const shifted = shiftGridToStartOrigin(data, width, height, metadata);
        finalData = shifted.data;
    }
    let pgm = `P2\n${width} ${height}\n255\n`;

    // Limits lines to 70 chars is recommended for PGM P2 but not strictly required by all parsers.
    // However, clean output is nice.
    let line = '';

    for (let i = 0; i < finalData.length; i++) {
        let val = 205; // Default Unknown
        if (finalData[i] === CELL_OCCUPIED) {
            val = 0;
        } else if (finalData[i] === CELL_FREE) {
            val = 254;
        }

        const segment = val.toString() + ' ';
        if (line.length + segment.length > 70) {
            pgm += line.trim() + '\n';
            line = segment;
        } else {
            line += segment;
        }
    }

    if (line.length > 0) {
        pgm += line.trim() + '\n';
    }

    return pgm;
}

/**
 * Generates the YAML configuration file for ROS map_server.
 */
export function generateYAML(metadata: GridMetadata, imageFilename: string = 'map.pgm', shiftToStart: boolean = false): string {
    let finalMetadata = { ...metadata };
    
    // If no start is set, set it to (0,0)
    if (!finalMetadata.start) {
        finalMetadata.start = { x: 0, y: 0 };
    }
    
    // Shift metadata if requested
    if (shiftToStart && finalMetadata.start) {
        const shifted = shiftGridToStartOrigin(
            new Int8Array(0), // Dummy data, we only need metadata
            finalMetadata.start.x + 1, // Dummy dimensions
            finalMetadata.start.y + 1,
            finalMetadata
        );
        finalMetadata = shifted.metadata;
    }
    
    return `image: ${imageFilename}
resolution: ${finalMetadata.resolution}
origin: [${finalMetadata.origin.x}, ${finalMetadata.origin.y}, ${finalMetadata.origin.theta}]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
`;
}
