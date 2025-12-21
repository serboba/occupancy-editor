import { describe, it, expect } from 'vitest';
import { GridImportSchema } from './validators';
import { generatePGM } from './rosExporter';
import { CELL_OCCUPIED, CELL_FREE, CELL_UNKNOWN } from '../types';

describe('Validators', () => {
    it('validates a correct grid object', () => {
        const valid = {
            width: 2,
            height: 2,
            data: [0, 100, -1, 0],
            metadata: {
                resolution: 0.05,
                origin: { x: 0, y: 0, theta: 0 }
            }
        };
        expect(GridImportSchema.parse(valid)).toEqual(valid);
    });

    it('rejects invalid dimensions', () => {
        const invalid = {
            width: -10,
            height: 2,
            data: [],
            metadata: { resolution: 1, origin: { x: 0, y: 0, theta: 0 } }
        };
        expect(() => GridImportSchema.parse(invalid)).toThrow();
    });
});

describe('ROS Exporter', () => {
    it('generates correct PGM header', () => {
        const data = new Int8Array([CELL_OCCUPIED, CELL_FREE, CELL_UNKNOWN, CELL_OCCUPIED]);
        const pgm = generatePGM(data, 2, 2);

        const lines = pgm.split('\n');
        expect(lines[0]).toBe('P2');
        expect(lines[1]).toBe('2 2');
        expect(lines[2]).toBe('255');
    });

    it('maps values correctly', () => {
        const data = new Int8Array([CELL_OCCUPIED, CELL_FREE, CELL_UNKNOWN]);
        // Occupied -> 0, Free -> 254, Unknown -> 205
        const pgm = generatePGM(data, 3, 1);
        // Expect body: "0 254 205"
        expect(pgm).toContain('0 254 205');
    });
});
