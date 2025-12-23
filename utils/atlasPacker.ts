
import { OptimizationTask, AtlasPage, PackedRect } from '../types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

class MaxRectsPacker {
  width: number;
  height: number;
  padding: number;
  freeRects: Rect[];
  packedRects: PackedRect[];

  constructor(width: number, height: number, padding: number) {
    this.width = width;
    this.height = height;
    this.padding = padding;
    this.freeRects = [{ x: 0, y: 0, width: width, height: height }];
    this.packedRects = [];
  }

  insert(task: OptimizationTask): PackedRect | null {
    // Add padding to required dimensions (only right/bottom needs considering for fit, 
    // but logic treats padding as space between, so we effectively add it to the width)
    
    const requiredW = task.targetWidth + this.padding;
    const requiredH = task.targetHeight + this.padding;

    const bestNode = this.findBestNode(requiredW, requiredH);
    
    if (bestNode.score === Number.MAX_VALUE) {
      return null; // Won't fit
    }

    const newRect: PackedRect = {
      x: bestNode.rect.x,
      y: bestNode.rect.y,
      w: task.targetWidth,
      h: task.targetHeight,
      task: task
    };

    this.placeRect(bestNode.rect);
    return newRect;
  }

  private findBestNode(w: number, h: number): { score: number, rect: Rect } {
    let bestScore = Number.MAX_VALUE;
    let bestRect: Rect = { x: 0, y: 0, width: 0, height: 0 };

    for (const free of this.freeRects) {
      // Check if fits
      if (free.width >= w && free.height >= h) {
        // Heuristic: Best Short Side Fit (BSSF)
        const leftoverHoriz = Math.abs(free.width - w);
        const leftoverVert = Math.abs(free.height - h);
        const shortSideFit = Math.min(leftoverHoriz, leftoverVert);
        
        if (shortSideFit < bestScore) {
          bestScore = shortSideFit;
          bestRect = { x: free.x, y: free.y, width: w, height: h };
        }
      }
    }

    return { score: bestScore, rect: bestRect };
  }

  private placeRect(rect: Rect) {
    // CRITICAL FIX: Loop must check current length because array is modified (spliced) inside loop.
    // Using a cached length (const len = this.freeRects.length) causes undefined access when array shrinks.
    for (let i = 0; i < this.freeRects.length; i++) {
      if (this.splitFreeNode(this.freeRects[i], rect)) {
        this.freeRects.splice(i, 1);
        i--;
      }
    }
    // Perform pruning to remove contained rectangles and prevent explosion
    this.pruneFreeList();
  }

  private pruneFreeList() {
    // Go through the free list and remove any rectangle that is redundant (completely contained within another)
    for (let i = 0; i < this.freeRects.length; i++) {
      for (let j = i + 1; j < this.freeRects.length; j++) {
        const rect1 = this.freeRects[i];
        const rect2 = this.freeRects[j];

        if (this.isContained(rect1, rect2)) {
          this.freeRects.splice(i, 1);
          i--;
          break;
        }
        if (this.isContained(rect2, rect1)) {
          this.freeRects.splice(j, 1);
          j--;
        }
      }
    }
  }

  private isContained(a: Rect, b: Rect): boolean {
    return a.x >= b.x && a.y >= b.y && 
           a.x + a.width <= b.x + b.width && 
           a.y + a.height <= b.y + b.height;
  }

  private splitFreeNode(freeNode: Rect, usedNode: Rect): boolean {
    // Check for intersection
    if (usedNode.x >= freeNode.x + freeNode.width ||
        usedNode.x + usedNode.width <= freeNode.x ||
        usedNode.y >= freeNode.y + freeNode.height ||
        usedNode.y + usedNode.height <= freeNode.y) {
      return false;
    }

    // New nodes
    if (usedNode.x < freeNode.x + freeNode.width && usedNode.x + usedNode.width > freeNode.x) {
      // New node at the top side of the used node.
      if (usedNode.y > freeNode.y && usedNode.y < freeNode.y + freeNode.height) {
        const newNode: Rect = {
          x: freeNode.x,
          y: freeNode.y,
          width: freeNode.width,
          height: usedNode.y - freeNode.y
        };
        this.freeRects.push(newNode);
      }

      // New node at the bottom side of the used node.
      if (usedNode.y + usedNode.height < freeNode.y + freeNode.height) {
        const newNode: Rect = {
          x: freeNode.x,
          y: usedNode.y + usedNode.height,
          width: freeNode.width,
          height: freeNode.y + freeNode.height - (usedNode.y + usedNode.height)
        };
        this.freeRects.push(newNode);
      }
    }

    if (usedNode.y < freeNode.y + freeNode.height && usedNode.y + usedNode.height > freeNode.y) {
      // New node at the left side of the used node.
      if (usedNode.x > freeNode.x && usedNode.x < freeNode.x + freeNode.width) {
        const newNode: Rect = {
          x: freeNode.x,
          y: freeNode.y,
          width: usedNode.x - freeNode.x,
          height: freeNode.height
        };
        this.freeRects.push(newNode);
      }

      // New node at the right side of the used node.
      if (usedNode.x + usedNode.width < freeNode.x + freeNode.width) {
        const newNode: Rect = {
          x: usedNode.x + usedNode.width,
          y: freeNode.y,
          width: freeNode.x + freeNode.width - (usedNode.x + usedNode.width),
          height: freeNode.height
        };
        this.freeRects.push(newNode);
      }
    }

    return true;
  }
}

export function packAtlases(tasks: OptimizationTask[], maxSize: number = 2048, padding: number = 2): AtlasPage[] {
  // 1. Sort tasks by height descending (common heuristic for shelf/maxrects)
  const sortedTasks = [...tasks].sort((a, b) => b.targetHeight - a.targetHeight);
  
  const pages: AtlasPage[] = [];
  let currentPageIndex = 0;

  // Clone tasks to track placement
  const remaining = [...sortedTasks];

  while (remaining.length > 0) {
    const packer = new MaxRectsPacker(maxSize, maxSize, padding);
    const pageItems: PackedRect[] = [];
    const didntFit: OptimizationTask[] = [];

    for (const task of remaining) {
      // Basic check if single item exceeds atlas
      if (task.targetWidth > maxSize || task.targetHeight > maxSize) {
         // Skip items that physically cannot fit
         continue; 
      }

      const rect = packer.insert(task);
      if (rect) {
        pageItems.push(rect);
      } else {
        didntFit.push(task);
      }
    }

    // Calculate Efficiency
    let usedArea = 0;
    pageItems.forEach(p => usedArea += (p.w * p.h));
    const totalArea = maxSize * maxSize;
    const efficiency = (usedArea / totalArea) * 100;

    pages.push({
      id: currentPageIndex++,
      width: maxSize,
      height: maxSize,
      items: pageItems,
      efficiency
    });

    // If we made no progress but still have items, it means remaining items are too big or an error occurred.
    // However, the maxSize check above handles single-item-too-big.
    // If we packed nothing this round, we must break to avoid infinite loop.
    if (pageItems.length === 0 && didntFit.length === remaining.length) {
      console.warn("Packing stalled. Remaining items cannot be packed:", didntFit);
      break;
    }

    remaining.splice(0, remaining.length, ...didntFit);
  }

  return pages;
}
