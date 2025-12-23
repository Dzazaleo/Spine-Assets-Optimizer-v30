
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { AtlasPage, OptimizationTask, PackedRect } from '../types';
import { packAtlases } from '../utils/atlasPacker';
import { X, Map as MapIcon, ChevronLeft, ChevronRight, Layers, Box, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import clsx from 'clsx';

interface AtlasPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: OptimizationTask[];
  missingImageCount: number;
}

export const AtlasPreviewModal: React.FC<AtlasPreviewModalProps> = ({
  isOpen,
  onClose,
  tasks,
  missingImageCount
}) => {
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [pages, setPages] = useState<AtlasPage[]>([]);
  const [isOptimized, setIsOptimized] = useState(true);
  const [maxSize, setMaxSize] = useState(2048);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const [rendering, setRendering] = useState(false);
  const [hoveredRect, setHoveredRect] = useState<PackedRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{x: number, y: number} | null>(null);

  // Identify assets that are too large for the selected atlas size
  const oversizedAssets = useMemo(() => {
    return tasks.filter(t => {
        const w = isOptimized ? t.targetWidth : t.originalWidth;
        const h = isOptimized ? t.targetHeight : t.originalHeight;
        return w > maxSize || h > maxSize;
    });
  }, [tasks, maxSize, isOptimized]);

  // Packing Logic
  useEffect(() => {
    if (!isOpen) {
        setPages([]);
        return;
    }
    
    // Delay packing to allow UI/Modal to fully render and settle dimensions.
    const timer = setTimeout(() => {
        // Prepare tasks based on selected view mode
        const packerTasks = tasks.map(t => ({
            ...t,
            targetWidth: isOptimized ? t.targetWidth : t.originalWidth,
            targetHeight: isOptimized ? t.targetHeight : t.originalHeight
        }));

        const result = packAtlases(packerTasks, maxSize, 2);
        setPages(result);
        setCurrentPageIdx(0); 
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, tasks, isOptimized, maxSize]);


  // Render Main Canvas
  useEffect(() => {
    if (!isOpen || !pages[currentPageIdx] || !canvasRef.current) return;
    
    const page = pages[currentPageIdx];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    setRendering(true);
    let isMounted = true; // Track effect validity to prevent ghost draws
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background Checkboard (optional visual aid)
    ctx.fillStyle = '#1e1e23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw boundary
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    const drawImages = async () => {
      for (const item of page.items) {
        if (!isMounted) return;

        const img = new Image();
        // Use the blob directly from the task
        const url = URL.createObjectURL(item.task.blob);
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
             if (isMounted) {
                 // Draw image
                 ctx.drawImage(img, item.x, item.y, item.w, item.h);
                 
                 // Draw outline
                 ctx.strokeStyle = 'rgba(100, 255, 100, 0.3)';
                 ctx.lineWidth = 1;
                 ctx.strokeRect(item.x, item.y, item.w, item.h);
             }
             URL.revokeObjectURL(url);
             resolve();
          };
          img.onerror = () => {
            if (isMounted) {
                // Fallback placeholder
                ctx.fillStyle = '#333';
                ctx.fillRect(item.x, item.y, item.w, item.h);
                ctx.strokeStyle = 'red';
                ctx.strokeRect(item.x, item.y, item.w, item.h);
            }
            URL.revokeObjectURL(url);
            resolve();
          };
          img.src = url;
        });
      }
      if (isMounted) setRendering(false);
    };

    drawImages();

    return () => { isMounted = false; };
  }, [isOpen, currentPageIdx, pages, maxSize]);

  // Render Highlight Overlay
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (hoveredRect) {
        // Outer Glow
        ctx.shadowColor = '#ff5c5c';
        ctx.shadowBlur = 20;
        
        ctx.strokeStyle = '#ff5c5c'; // spine-accent
        ctx.lineWidth = 6;
        ctx.strokeRect(hoveredRect.x, hoveredRect.y, hoveredRect.w, hoveredRect.h);
        
        ctx.shadowBlur = 0; // Reset

        ctx.fillStyle = 'rgba(255, 92, 92, 0.15)';
        ctx.fillRect(hoveredRect.x, hoveredRect.y, hoveredRect.w, hoveredRect.h);
    }
  }, [hoveredRect]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const activePage = pages[currentPageIdx];
    if (!activePage || !overlayCanvasRef.current) return;
    
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    
    // Map visual coordinates to canvas space (maxSize x maxSize)
    const scaleX = maxSize / rect.width;
    const scaleY = maxSize / rect.height;
    
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    // Find intersection (iterate backwards to find top-most if overlap existed, though atlas is usually non-overlapping)
    const found = activePage.items.find(item => 
        canvasX >= item.x && canvasX <= item.x + item.w &&
        canvasY >= item.y && canvasY <= item.y + item.h
    );
    
    setHoveredRect(found || null);

    if (found && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // Cursor Position relative to container
        const cursorX = e.clientX - containerRect.left;
        const cursorY = e.clientY - containerRect.top;

        // Container Dimensions
        const containerW = containerRect.width;
        const containerH = containerRect.height;

        // Tooltip Dimensions (Measure active or fallback)
        let tooltipW = 220; // Min width fallback
        let tooltipH = 120; // Height estimate fallback
        
        if (tooltipRef.current) {
            const tRect = tooltipRef.current.getBoundingClientRect();
            tooltipW = tRect.width;
            tooltipH = tRect.height;
        }

        const margin = 20;
        
        // Initial Target: Bottom-Right of cursor
        let targetX = cursorX + margin;
        let targetY = cursorY + margin;

        // Horizontal Edge Detection (Flip to Left)
        if (targetX + tooltipW > containerW) {
            targetX = cursorX - tooltipW - margin;
        }

        // Vertical Edge Detection (Flip to Top)
        if (targetY + tooltipH > containerH) {
            targetY = cursorY - tooltipH - margin;
        }

        // Pixel Rounding for sharp text rendering
        setTooltipPos({ x: Math.round(targetX), y: Math.round(targetY) });
    } else {
        setTooltipPos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredRect(null);
    setTooltipPos(null);
  };

  if (!isOpen) return null;

  const activePage = pages[currentPageIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-5xl h-[90vh] overflow-hidden border border-gray-700 rounded-xl bg-spine-dark shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <MapIcon className="text-spine-accent" size={24} />
            <div>
               <h3 className="text-xl font-semibold text-white">Atlas Preview</h3>
               <p className="text-xs text-gray-400">
                  Visual estimation of packed textures ({maxSize}x{maxSize}).
               </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Controls / Stats Sidebar */}
          <div className="w-full md:w-64 p-4 border-r border-gray-700 bg-gray-900/50 flex flex-col gap-6 overflow-y-auto shrink-0">
             
             {/* Missing Assets Warning */}
             {missingImageCount > 0 && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex flex-col gap-2">
                   <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Warning</span>
                   </div>
                   <p className="text-xs text-red-200/80 leading-relaxed">
                      <span className="font-bold text-white">{missingImageCount} missing assets</span> are excluded from this preview.
                   </p>
                </div>
             )}

             {/* Oversized Assets Warning */}
             {oversizedAssets.length > 0 && (
                <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg flex flex-col gap-2">
                   <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Oversized</span>
                   </div>
                   <p className="text-xs text-amber-200/80 leading-relaxed">
                      <span className="font-bold text-white">{oversizedAssets.length} assets</span> exceed {maxSize}px and were excluded from packing.
                   </p>
                   <div className="max-h-24 overflow-y-auto space-y-1 mt-1 pr-1 scrollbar-hide">
                      {oversizedAssets.map((t, i) => (
                           <div key={i} className="text-[10px] text-amber-300/70 truncate font-mono bg-black/20 px-1.5 py-0.5 rounded" title={t.fileName}>
                              {t.fileName} ({isOptimized ? t.targetWidth : t.originalWidth}x{isOptimized ? t.targetHeight : t.originalHeight})
                           </div>
                      ))}
                   </div>
                </div>
             )}

             {/* View Toggle */}
             <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 flex flex-col gap-3">
                <span className="text-xs font-bold text-gray-400 uppercase">View Mode</span>
                <div className="flex bg-gray-900 rounded p-1 border border-gray-700">
                    <button 
                       className={clsx("flex-1 py-1.5 text-xs font-medium rounded transition-colors", !isOptimized ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-gray-300")}
                       onClick={() => setIsOptimized(false)}
                    >
                       Original
                    </button>
                    <button 
                       className={clsx("flex-1 py-1.5 text-xs font-medium rounded transition-colors", isOptimized ? "bg-spine-accent text-white shadow" : "text-gray-400 hover:text-gray-300")}
                       onClick={() => setIsOptimized(true)}
                    >
                       Optimized
                    </button>
                </div>
                <p className="text-[10px] text-gray-500">
                    {isOptimized ? "Showing calculated max render sizes." : "Showing original source dimensions."}
                </p>
             </div>

             {/* Resolution Toggle */}
             <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 flex flex-col gap-3">
                <span className="text-xs font-bold text-gray-400 uppercase">Atlas Resolution</span>
                <div className="flex bg-gray-900 rounded p-1 border border-gray-700">
                    <button 
                       className={clsx("flex-1 py-1.5 text-xs font-medium rounded transition-colors", maxSize === 2048 ? "bg-spine-accent text-white shadow" : "text-gray-400 hover:text-gray-300")}
                       onClick={() => setMaxSize(2048)}
                    >
                       2048px
                    </button>
                    <button 
                       className={clsx("flex-1 py-1.5 text-xs font-medium rounded transition-colors", maxSize === 4096 ? "bg-spine-accent text-white shadow" : "text-gray-400 hover:text-gray-300")}
                       onClick={() => setMaxSize(4096)}
                    >
                       4096px
                    </button>
                </div>
             </div>

             {/* Pagination */}
             <div className="flex flex-col gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <span className="text-xs font-bold text-gray-400 uppercase">Atlas Page</span>
                <div className="flex items-center justify-between">
                   <button 
                     onClick={() => setCurrentPageIdx(p => Math.max(0, p - 1))}
                     disabled={currentPageIdx === 0}
                     className="p-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
                   >
                     <ChevronLeft size={20} />
                   </button>
                   <span className="font-mono font-bold text-lg">
                     {pages.length > 0 ? currentPageIdx + 1 : 0} <span className="text-gray-500 text-sm">/ {pages.length}</span>
                   </span>
                   <button 
                     onClick={() => setCurrentPageIdx(p => Math.min(pages.length - 1, p + 1))}
                     disabled={currentPageIdx === pages.length - 1}
                     className="p-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
                   >
                     <ChevronRight size={20} />
                   </button>
                </div>
             </div>

             {/* Stats */}
             <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-blue-900/20 rounded border border-blue-800/30">
                  <Layers size={18} className="text-blue-400 mt-1" />
                  <div>
                    <span className="block text-xs text-blue-300 font-bold uppercase">Total Atlases</span>
                    <span className="text-xl font-bold text-white">{pages.length}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-green-900/20 rounded border border-green-800/30">
                  <Box size={18} className="text-green-400 mt-1" />
                  <div>
                    <span className="block text-xs text-green-300 font-bold uppercase">Efficiency (Page {pages.length > 0 ? currentPageIdx + 1 : 0})</span>
                    <span className="text-xl font-bold text-white">{activePage?.efficiency.toFixed(1) || 0}%</span>
                    <span className="block text-xs text-green-400/60 mt-1">
                      {(100 - (activePage?.efficiency || 0)).toFixed(1)}% Empty Space
                    </span>
                  </div>
                </div>
             </div>

             <div className="mt-auto pt-4 text-[10px] text-gray-500">
               * Preview assumes 2px padding and no rotation. Actual export engine may vary slightly.
             </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 bg-black/50 relative flex items-center justify-center p-4 overflow-hidden">
             {rendering && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20">
                   <span className="text-spine-accent font-bold animate-pulse">Rendering...</span>
                </div>
             )}
             
             {/* Canvas Container */}
             <div 
                ref={containerRef}
                className="relative shadow-2xl border border-gray-800 bg-[#1e1e23] max-w-full max-h-full aspect-square"
             >
                {/* Main Render Canvas */}
                <canvas 
                  ref={canvasRef}
                  width={maxSize}
                  height={maxSize}
                  className="block w-full h-full object-contain"
                  style={{ maxHeight: 'calc(90vh - 150px)' }}
                />
                
                {/* Interactive Overlay Canvas */}
                <canvas
                  ref={overlayCanvasRef}
                  width={maxSize}
                  height={maxSize}
                  className="absolute inset-0 w-full h-full object-contain cursor-crosshair touch-none"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />

                {/* Floating Tooltip */}
                {hoveredRect && tooltipPos && (
                    <div 
                        ref={tooltipRef}
                        className="absolute z-50 bg-gray-900/95 border border-spine-accent p-3 rounded-lg shadow-2xl pointer-events-none backdrop-blur-md min-w-[220px] transition-transform duration-100 ease-out will-change-transform antialiased"
                        style={{ 
                            top: 0,
                            left: 0,
                            transform: `translate3d(${tooltipPos.x}px, ${tooltipPos.y}px, 0)`,
                            backfaceVisibility: 'hidden',
                            transformStyle: 'preserve-3d',
                            textRendering: 'optimizeLegibility'
                        }}
                    >
                        <div className="text-xs font-bold text-white mb-1 truncate max-w-[250px]">
                            {hoveredRect.task.fileName}
                        </div>
                        <div className="h-px bg-gray-700 my-2"></div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-gray-400">Current Size:</span>
                                <span className="font-mono text-spine-accent font-bold">
                                    {hoveredRect.w} x {hoveredRect.h}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-gray-400">Original Size:</span>
                                <span className="font-mono text-gray-300">
                                    {hoveredRect.task.originalWidth} x {hoveredRect.task.originalHeight}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-gray-400">Scale Factor:</span>
                                <div className="flex items-center gap-1">
                                    {hoveredRect.w > hoveredRect.task.originalWidth ? (
                                        <Maximize2 size={10} className="text-yellow-400" />
                                    ) : (
                                        <Minimize2 size={10} className="text-green-400" />
                                    )}
                                    <span className={clsx("font-mono font-bold", 
                                        hoveredRect.w > hoveredRect.task.originalWidth ? "text-yellow-400" : "text-green-400"
                                    )}>
                                        {Math.round((hoveredRect.w / hoveredRect.task.originalWidth) * 100)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};
