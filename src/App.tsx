import { useState, useRef } from 'react';
import { useGrid } from './hooks/useGrid';
import type { GridCanvasHandle } from './components/GridCanvas';
import { GridCanvas } from './components/GridCanvas';
import { GeneratorPanel } from './components/GeneratorPanel';
import { Pencil, Square, Eraser, Undo, Redo, Download, Upload, MapPin, Flag, Scan } from 'lucide-react';
import clsx from 'clsx';
import { saveAs } from 'file-saver';
import type { GridMetadata } from './types';

function App() {
  // Grid State
  const {
    width,
    height,
    gridData,
    metadata,
    updateGrid,
    updateMetadata,
    resize,
    clearGrid,
    setStart,
    setGoal,
    clearStart,
    clearGoal,
    undo,
    redo,
    canUndo,
    canRedo
  } = useGrid({
    initialWidth: 50,
    initialHeight: 50,
    initialResolution: 0.05
  });

  const canvasRef = useRef<GridCanvasHandle>(null);
  const handleGridUpdate = (newData: Int8Array) => updateGrid(newData, width, height);

  const [tool, setTool] = useState<'pencil' | 'rect' | 'eraser' | 'start' | 'goal'>('pencil');

  // Export Handler
  const [shiftToStart, setShiftToStart] = useState(false);
  
  // Recenter and relative coordinates
  const [useRelativeCoords, setUseRelativeCoords] = useState(false);

  const handleExport = async () => {
    // Dynamic import to avoid heavy bundle if not used? 
    // Vite handles code splitting automatically but explicit is nice.
    const JSZip = (await import('jszip')).default;
    const { saveAs } = (await import('file-saver'));
    const { generatePGM, generateYAML } = (await import('./utils/rosExporter'));

    const zip = new JSZip();

    const pgm = generatePGM(gridData, width, height, metadata, shiftToStart);
    // We need metadata for YAML. `useGrid` has metadata state but current hook exposes `metadata`?
    // Wait, I see I forgot to export `metadata` from the destructuring in App, but it IS returned by hook.
    // I need to add it to destructuring.

    const yaml = generateYAML(metadata, 'map.pgm', shiftToStart);

    zip.file("map.pgm", pgm);
    zip.file("map.yaml", yaml);

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "occupancy_grid.zip");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const fileName = file.name.toLowerCase();
      
      // Determine file type by extension
      if (fileName.endsWith('.csv')) {
        // Parse CSV
        const { parseCSV } = await import('./utils/csvParser');
        const parsed = parseCSV(text, metadata.resolution);
        
        // Always set start to (0,0) when importing
        // If goal exists, adjust it relative to the original start position
        const adjustedMetadata = { ...parsed.metadata };
        if (parsed.metadata.start) {
          const originalStart = parsed.metadata.start;
          // Set start to (0,0)
          adjustedMetadata.start = { x: 0, y: 0 };
          // Adjust goal relative to original start
          if (parsed.metadata.goal) {
            adjustedMetadata.goal = {
              x: parsed.metadata.goal.x - originalStart.x,
              y: parsed.metadata.goal.y - originalStart.y
            };
          }
        } else {
          // If no start in CSV, set it to (0,0)
          adjustedMetadata.start = { x: 0, y: 0 };
        }
        
        // Update grid and metadata
        updateGrid(parsed.data, parsed.width, parsed.height);
        updateMetadata(adjustedMetadata);
      } else {
        // Try JSON
        const json = JSON.parse(text);
        const { GridImportSchema } = await import('./utils/validators');
        const parsed = GridImportSchema.parse(json);

        // Always set start to (0,0) when importing
        // If goal exists, adjust it relative to the original start position
        // Cast to GridMetadata since the schema doesn't include optional start/goal
        const parsedMeta = parsed.metadata as GridMetadata;
        const adjustedMetadata: GridMetadata = { ...parsedMeta };
        const originalStart = parsedMeta.start;
        if (originalStart) {
          // Set start to (0,0)
          adjustedMetadata.start = { x: 0, y: 0 };
          // Adjust goal relative to original start
          if (parsedMeta.goal) {
            adjustedMetadata.goal = {
              x: parsedMeta.goal.x - originalStart.x,
              y: parsedMeta.goal.y - originalStart.y
            };
          }
        } else {
          // If no start in JSON, set it to (0,0)
          adjustedMetadata.start = { x: 0, y: 0 };
        }

        // Convert number[] back to Int8Array
        const newData = new Int8Array(parsed.data);
        updateGrid(newData, parsed.width, parsed.height);
        updateMetadata(adjustedMetadata);
      }
    } catch (err) {
      console.error("Import failed:", err);
      alert(`Import failed: ${err instanceof Error ? err.message : 'Invalid file format'}`);
    }

    // Reset input
    e.target.value = '';
  };

  // Export Logic with options
  const [exportFormat, setExportFormat] = useState<'ros' | 'csv' | 'json' | 'png'>('ros');

  const handleExportClick = async () => {
    if (exportFormat === 'ros') {
      handleExport(); // Existing ROS ZIP export
    } else if (exportFormat === 'csv') {
      const { generateCSV } = await import('./utils/exportUtils');
      const csv = generateCSV(gridData, width, height, metadata, shiftToStart);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, 'occupancy_grid.csv');
    } else if (exportFormat === 'json') {
      const { generateJSON } = await import('./utils/exportUtils');
      const json = generateJSON({ width, height, data: gridData, metadata }, shiftToStart);
      const blob = new Blob([json], { type: 'application/json' });
      saveAs(blob, 'occupancy_grid.json');
    } else if (exportFormat === 'png') {
      const { generatePNG } = await import('./utils/exportUtils');
      const blob = await generatePNG(gridData, width, height, metadata, shiftToStart);
      saveAs(blob, 'occupancy_grid.png');
    }
  };

  // Generator
  const handleRunGenerator = async (opts: any) => {
    const { generateRandomMap } = await import('./utils/generatorUtils');
    const newData = generateRandomMap(gridData, width, height, opts);
    updateGrid(newData, width, height);
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black overflow-hidden font-sans">
      {/* Header / Toolbar */}
      <header className="h-16 border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
        <h1 className="font-bold text-xl tracking-tight">
          Occupancy Editor
        </h1>

        <div className="flex items-center gap-2 bg-white border border-gray-200 p-1 rounded-md shadow-sm">
          <ToolbarBtn icon={<Pencil size={18} />} active={tool === 'pencil'} onClick={() => setTool('pencil')} title="Pencil (P)" />
          <ToolbarBtn icon={<Square size={18} />} active={tool === 'rect'} onClick={() => setTool('rect')} title="Rectangle (R)" />
          <ToolbarBtn icon={<Eraser size={18} />} active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser (E)" />
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <ToolbarBtn icon={<MapPin size={18} className="text-green-600" />} active={tool === 'start'} onClick={() => setTool('start')} title="Set Start" />
          <ToolbarBtn icon={<Flag size={18} className="text-red-500" />} active={tool === 'goal'} onClick={() => setTool('goal')} title="Set Goal" />
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <ToolbarBtn icon={<Undo size={18} />} disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)" />
          <ToolbarBtn icon={<Redo size={18} />} disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)" />
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <ToolbarBtn icon={<span className="text-xs font-bold">CLR</span>} onClick={() => { if (confirm('Reset grid?')) clearGrid(); }} title="Clear Grid" />
        </div>

        <div className="flex items-center gap-3">

          {/* Resize Inputs */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 p-1 rounded-md text-sm">
            <span className="text-gray-500 px-1 text-xs font-bold">W:</span>
            <input
              type="text"
              value={width}
              className="w-10 bg-transparent text-center focus:outline-none focus:ring-1 rounded"
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val > 0) resize(val, height, 0, 0);
              }}
            />
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <span className="text-gray-500 px-1 text-xs font-bold">H:</span>
            <input
              type="text"
              value={height}
              className="w-10 bg-transparent text-center focus:outline-none focus:ring-1 rounded"
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val > 0) resize(width, val, 0, 0);
              }}
            />
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-sm font-medium transition-colors cursor-pointer text-gray-700">
            <Upload size={16} /> Import
            <input type="file" accept=".json,.csv" className="hidden" onChange={handleImport} />
          </label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={shiftToStart}
                onChange={(e) => setShiftToStart(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-black focus:ring-1 focus:ring-black"
                disabled={!metadata?.start}
                title={metadata?.start ? "Shift grid so start point is at (0,0)" : "Set a start point first"}
              />
              <span className="whitespace-nowrap">Start at (0,0)</span>
            </label>
            <div className="flex rounded-md shadow-sm" role="group">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-l-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="ros">ROS (Zip)</option>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="png">PNG</option>
              </select>
              <button
                onClick={handleExportClick}
                className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-r-md text-sm font-medium transition-colors"
              >
                <Download size={16} /> Export
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Area */}
        <main className="flex-1 overflow-hidden relative">
          <GridCanvas
            ref={canvasRef}
            width={width}
            height={height}
            data={gridData}
            metadata={metadata}
            tool={tool}
            onUpdate={handleGridUpdate}
            onSetStart={setStart}
            onSetGoal={setGoal}
            onClearStart={clearStart}
            onClearGoal={clearGoal}
            onResize={resize}
            useRelativeCoords={useRelativeCoords}
          />

          {/* Reset View FAB */}
          <button
            onClick={() => canvasRef.current?.resetView()}
            className="absolute bottom-6 right-6 p-3 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
            title="Reset View"
          >
            <Scan size={24} />
          </button>
        </main>

        {/* Persistent Generator Sidebar */}
        <GeneratorPanel
          onGenerate={handleRunGenerator}
        />

        {/* Dimensions Status */}
        <div className="absolute bottom-6 left-6 bg-white border border-gray-200 shadow-md px-4 py-2 rounded-full text-sm font-mono text-gray-600 pointer-events-none tabular-nums">
          {width} x {height} ({metadata.resolution}m/px)
        </div>
        
        {/* Relative Coordinates Toggle */}
        <div className="absolute top-6 right-6 bg-white border border-gray-200 shadow-md px-3 py-2 rounded-md text-sm pointer-events-auto">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useRelativeCoords}
              onChange={(e) => setUseRelativeCoords(e.target.checked)}
              disabled={!metadata?.start}
              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-1 focus:ring-black"
              title={metadata?.start ? "Show coordinates relative to start point" : "Set a start point first"}
            />
            <span className="text-gray-700 whitespace-nowrap">Use (0,0) at Start</span>
          </label>
        </div>
      </div>


    </div>
  )
}



function ToolbarBtn({ icon, active, disabled, onClick, title }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        "p-2 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed",
        active ? "bg-black text-white" : "text-gray-500 hover:text-black hover:bg-gray-100",
      )}
    >
      {icon}
    </button>
  )
}

export default App
