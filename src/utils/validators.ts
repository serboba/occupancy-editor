import { z } from 'zod';
// import { CELL_FREE, CELL_OCCUPIED, CELL_UNKNOWN } from '../types';

export const GridMetadataSchema = z.object({
    resolution: z.number().positive(),
    origin: z.object({
        x: z.number(),
        y: z.number(),
        theta: z.number(),
    }),
});

export const GridImportSchema = z.object({
    width: z.number().int().positive().max(2000), // Safety cap
    height: z.number().int().positive().max(2000),
    data: z.array(z.number()), // We accept number[] in JSON
    metadata: GridMetadataSchema,
});

export type GridImportType = z.infer<typeof GridImportSchema>;
