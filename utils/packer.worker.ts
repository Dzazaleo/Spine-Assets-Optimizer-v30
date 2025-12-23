
import { packAtlases } from './atlasPacker';

// Define expected message structure
interface PackerMessage {
  tasks: any[];
  maxSize: number;
  padding: number;
}

self.onmessage = (e: MessageEvent<PackerMessage>) => {
  const { tasks, maxSize, padding } = e.data;
  
  // Tasks here are "lightweight" versions stripped of Blobs by the main thread
  // to prevent clone overhead, but structure matches OptimizationTask for the packer's needs.
  
  try {
    const pages = packAtlases(tasks, maxSize, padding);
    self.postMessage({ success: true, pages });
  } catch (err) {
    console.error("Worker Packing Error:", err);
    self.postMessage({ success: false, error: String(err) });
  }
};
