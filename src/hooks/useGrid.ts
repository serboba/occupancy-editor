import { useState, useCallback, useRef } from 'react';
import {
    CELL_FREE,
    type GridData,
    type GridMetadata,
    type GridState
} from '../types';

const MAX_HISTORY = 20;

interface UseGridOptions {
    initialWidth: number;
    initialHeight: number;
    initialResolution: number;
}

export function useGrid({ initialWidth, initialHeight, initialResolution }: UseGridOptions) {
    const [width, setWidth] = useState(initialWidth);
    const [height, setHeight] = useState(initialHeight);

    // Metadata state
    const [metadata, setMetadata] = useState<GridMetadata>({
        resolution: initialResolution,
        origin: { x: 0, y: 0, theta: 0 },
    });

    // Current grid data
    const [gridData, setGridData] = useState<GridData>(() => {
        return new Int8Array(initialWidth * initialHeight).fill(CELL_FREE);
    });

    // History for Undo/Redo
    const historyRef = useRef<GridState[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const [, setVersion] = useState(0); // Trigger re-reners

    const saveToHistory = useCallback((newState: GridState) => {
        const currentIndex = historyIndexRef.current;
        const newHistory = historyRef.current.slice(0, currentIndex + 1);
        newHistory.push(newState);
        if (newHistory.length > MAX_HISTORY) {
            newHistory.shift();
        }
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        setVersion(v => v + 1);
    }, []);

    // Initial history push
    if (historyRef.current.length === 0) {
        historyRef.current.push({ width, height, data: gridData, metadata });
        historyIndexRef.current = 0;
    }

    const updateGrid = useCallback((newData: GridData, newWidth: number = width, newHeight: number = height) => {
        setGridData(newData);
        if (newWidth !== width) setWidth(newWidth);
        if (newHeight !== height) setHeight(newHeight);

        saveToHistory({
            width: newWidth,
            height: newHeight,
            data: newData,
            metadata
        });
    }, [width, height, metadata, saveToHistory]);

    const undo = useCallback(() => {
        if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            const state = historyRef.current[historyIndexRef.current];
            setGridData(state.data);
            setWidth(state.width);
            setHeight(state.height);
            setMetadata(state.metadata);
            setVersion(v => v + 1);
        }
    }, []);

    const redo = useCallback(() => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            const state = historyRef.current[historyIndexRef.current];
            setGridData(state.data);
            setWidth(state.width);
            setHeight(state.height);
            setMetadata(state.metadata);
            setVersion(v => v + 1);
        }
    }, []);

    const clearGrid = useCallback(() => {
        const newData = new Int8Array(width * height).fill(CELL_FREE);
        updateGrid(newData, width, height);
    }, [width, height, updateGrid]);

    const setStart = useCallback((x: number, y: number) => {
        const newMeta = { ...metadata, start: { x, y } };
        setMetadata(newMeta);
        saveToHistory({ width, height, data: gridData, metadata: newMeta });
    }, [width, height, gridData, metadata, saveToHistory]);

    const setGoal = useCallback((x: number, y: number) => {
        const newMeta = { ...metadata, goal: { x, y } };
        setMetadata(newMeta);
        saveToHistory({ width, height, data: gridData, metadata: newMeta });
    }, [width, height, gridData, metadata, saveToHistory]);

    const clearStart = useCallback(() => {
        const newMeta = { ...metadata };
        delete newMeta.start;
        setMetadata(newMeta);
        saveToHistory({ width, height, data: gridData, metadata: newMeta });
    }, [width, height, gridData, metadata, saveToHistory]);

    const clearGoal = useCallback(() => {
        const newMeta = { ...metadata };
        delete newMeta.goal;
        setMetadata(newMeta);
        saveToHistory({ width, height, data: gridData, metadata: newMeta });
    }, [width, height, gridData, metadata, saveToHistory]);

    // Resizing logic with offset
    const resizeGrid = useCallback((newWidth: number, newHeight: number, originX: number = 0, originY: number = 0) => {
        const newData = new Int8Array(newWidth * newHeight).fill(CELL_FREE);

        for (let y = 0; y < height; y++) {
            const destY = y + originY;
            if (destY < 0 || destY >= newHeight) continue;

            for (let x = 0; x < width; x++) {
                const destX = x + originX;
                if (destX < 0 || destX >= newWidth) continue;

                const val = gridData[y * width + x];
                newData[destY * newWidth + destX] = val;
            }
        }

        updateGrid(newData, newWidth, newHeight);
    }, [width, height, gridData, updateGrid]);

    const updateMetadata = useCallback((newMetadata: GridMetadata) => {
        setMetadata(newMetadata);
        saveToHistory({ width, height, data: gridData, metadata: newMetadata });
    }, [width, height, gridData, saveToHistory]);

    return {
        width,
        height,
        gridData,
        metadata,
        updateGrid,
        updateMetadata,
        undo,
        redo,
        resize: resizeGrid,
        clearGrid,
        setStart,
        setGoal,
        clearStart,
        clearGoal,
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < historyRef.current.length - 1
    };
}
