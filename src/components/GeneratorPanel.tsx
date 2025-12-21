import { useState } from 'react';
import { Play } from 'lucide-react';
import type { GeneratorOptions, ShapeType } from '../utils/generatorUtils';
import clsx from 'clsx';

interface GeneratorPanelProps {
    onGenerate: (options: GeneratorOptions) => void;
}

export function GeneratorPanel({ onGenerate }: GeneratorPanelProps) {
    const [mode, setMode] = useState<'shapes' | 'maze' | 'bugtrap'>('shapes');

    // Shapes State
    const [selectedShapes, setSelectedShapes] = useState<Record<ShapeType, boolean>>({
        rect: true,
        square: true,
        circle: true,
        triangle: true,
        cross: true,
        room: true
    });
    const [counts, setCounts] = useState(10);
    const [minSize, setMinSize] = useState(3);
    const [maxSize, setMaxSize] = useState(10);
    const [spacing, setSpacing] = useState(1);
    const [allowOverlap, setAllowOverlap] = useState(false);
    const [clearFirst, setClearFirst] = useState(false);

    // Maze State
    // (None yet, maybe corridor width later)

    // Bugtrap State
    const [btWidth, setBtWidth] = useState(20);
    const [btLength, setBtLength] = useState(30);
    const [btThickness, setBtThickness] = useState(2);
    const [btAperture, setBtAperture] = useState(0);

    const toggleShape = (s: ShapeType) => {
        setSelectedShapes(prev => ({ ...prev, [s]: !prev[s] }));
    };

    const handleGenerate = () => {
        if (mode === 'shapes') {
            const shapes = (Object.keys(selectedShapes) as ShapeType[]).filter(k => selectedShapes[k]);
            if (shapes.length === 0) {
                alert("Please select at least one shape.");
                return;
            }
            onGenerate({
                mode: 'shapes',
                shapes,
                count: counts,
                minSize,
                maxSize,
                spacing,
                allowOverlap,
                clearFirst,
                bugtrap: { width: 0, length: 0, thickness: 0, aperture: 0, orientation: 0 }
            });
        } else if (mode === 'maze') {
            onGenerate({
                mode: 'maze',
                shapes: [],
                count: 0,
                minSize: 0,
                maxSize: 0,
                spacing: 0,
                allowOverlap: false,
                clearFirst: true,
                bugtrap: { width: 0, length: 0, thickness: 0, aperture: 0, orientation: 0 }
            });
        } else if (mode === 'bugtrap') {
            onGenerate({
                mode: 'bugtrap',
                shapes: [],
                count: 0,
                minSize: 0,
                maxSize: 0,
                spacing: 0,
                allowOverlap: false,
                clearFirst: true, // Usually precise setup needs clean slate? Assume yes or make option.
                bugtrap: { width: btWidth, length: btLength, thickness: btThickness, aperture: btAperture, orientation: 0 }
            });
        }
    };

    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-xl z-20">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-bold text-lg">Generator</h2>
                <div className="flex bg-gray-200 rounded p-1 mt-2">
                    <button
                        className={clsx("flex-1 py-1 text-xs font-medium rounded transition-colors", mode === 'shapes' ? "bg-white shadow text-black" : "text-gray-600 hover:text-black")}
                        onClick={() => setMode('shapes')}
                    >
                        Shapes
                    </button>
                    <button
                        className={clsx("flex-1 py-1 text-xs font-medium rounded transition-colors", mode === 'maze' ? "bg-white shadow text-black" : "text-gray-600 hover:text-black")}
                        onClick={() => setMode('maze')}
                    >
                        Maze
                    </button>
                    <button
                        className={clsx("flex-1 py-1 text-xs font-medium rounded transition-colors", mode === 'bugtrap' ? "bg-white shadow text-black" : "text-gray-600 hover:text-black")}
                        onClick={() => setMode('bugtrap')}
                    >
                        Bugtrap
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {mode === 'shapes' && (
                    <>
                        {/* Shapes Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Shapes</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.keys(selectedShapes) as ShapeType[]).map(shape => (
                                    <label key={shape} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedShapes[shape]}
                                            onChange={() => toggleShape(shape)}
                                            className="rounded text-black focus:ring-black"
                                        />
                                        <span className="capitalize">{shape}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Dimensions */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-gray-500 uppercase">Config</label>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>Count: {counts}</span>
                                </div>
                                <input
                                    type="range" min="1" max="100" value={counts}
                                    onChange={(e) => setCounts(parseInt(e.target.value))}
                                    className="w-full accent-black"
                                />
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Min Size</label>
                                    <input
                                        type="number" value={minSize}
                                        onChange={(e) => setMinSize(parseInt(e.target.value))}
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Max Size</label>
                                    <input
                                        type="number" value={maxSize}
                                        onChange={(e) => setMaxSize(parseInt(e.target.value))}
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>Spacing: {spacing}px</span>
                                </div>
                                <input
                                    type="range" min="0" max="20" value={spacing}
                                    onChange={(e) => setSpacing(parseInt(e.target.value))}
                                    className="w-full accent-black"
                                />
                            </div>
                        </div>

                        {/* Options */}
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={allowOverlap}
                                    onChange={(e) => setAllowOverlap(e.target.checked)}
                                    className="rounded text-black focus:ring-black"
                                />
                                <span>Allow Overlap</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={clearFirst}
                                    onChange={(e) => setClearFirst(e.target.checked)}
                                    className="rounded text-black focus:ring-black"
                                />
                                <span>Clear Grid First</span>
                            </label>
                        </div>
                    </>
                )}

                {mode === 'maze' && (
                    <div className="text-sm text-gray-600">
                        <p>Generates a random maze using Recursive Backtracker algorithm.</p>
                        <p className="mt-2 text-xs italic">Note: This will overwrite the entire grid.</p>
                    </div>
                )}

                {mode === 'bugtrap' && (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-600 mb-4">
                            <p>Generates a U-shaped obstacle at the center of the map.</p>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Width: {btWidth}px</span>
                            </div>
                            <input
                                type="range" min="5" max="100" value={btWidth}
                                onChange={(e) => setBtWidth(parseInt(e.target.value))}
                                className="w-full accent-black"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Length: {btLength}px</span>
                            </div>
                            <input
                                type="range" min="5" max="100" value={btLength}
                                onChange={(e) => setBtLength(parseInt(e.target.value))}
                                className="w-full accent-black"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Thickness: {btThickness}px</span>
                            </div>
                            <input
                                type="range" min="1" max="10" value={btThickness}
                                onChange={(e) => setBtThickness(parseInt(e.target.value))}
                                className="w-full accent-black"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Back Opening: {btAperture}px</span>
                            </div>
                            <input
                                type="range" min="0" max={btWidth - 2} value={btAperture}
                                onChange={(e) => setBtAperture(parseInt(e.target.value))}
                                className="w-full accent-black"
                            />
                            <p className="text-xs text-gray-500 mt-1">Size of the gap at the closed end.</p>
                        </div>
                    </div>
                )}

            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button
                    onClick={handleGenerate}
                    className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white py-2 rounded-md font-medium transition-colors"
                >
                    <Play size={16} /> Generate {mode === 'maze' ? 'Maze' : mode === 'bugtrap' ? 'Bugtrap' : 'Objects'}
                </button>
            </div>
        </div>
    );
}
