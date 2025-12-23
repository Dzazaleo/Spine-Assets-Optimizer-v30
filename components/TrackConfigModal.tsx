import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Download, GripVertical, Clock, Repeat, FileText, Layers, Zap, Bone, MessageSquare, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { TrackItem, SkinDoc, EventDoc, BoneDoc, ViewerData, TrackAnimationConfig } from '../types';
import { generateStandaloneHtml } from '../utils/htmlGenerator';
import clsx from 'clsx';

interface TrackConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableAnimations: string[];
  trackList: TrackItem[];
  setTrackList: React.Dispatch<React.SetStateAction<TrackItem[]>>;
  skinDocs: SkinDoc[];
  setSkinDocs: React.Dispatch<React.SetStateAction<SkinDoc[]>>;
  eventDocs: EventDoc[];
  setEventDocs: React.Dispatch<React.SetStateAction<EventDoc[]>>;
  boneDocs: BoneDoc[];
  setBoneDocs: React.Dispatch<React.SetStateAction<BoneDoc[]>>;
  generalNotes: string;
  setGeneralNotes: (val: string) => void;
  masterSkins: string[];
  masterEvents: string[];
  masterBones: string[];
  safetyBuffer: number;
  resizedCount: number;
  optimizationReduction: string;
  projectedAtlasCount: number;
  skeletonName: string;
  totalImages: number;
  totalAnimations: number;
}

export const TrackConfigModal: React.FC<TrackConfigModalProps> = ({
  isOpen,
  onClose,
  availableAnimations,
  trackList,
  setTrackList,
  skinDocs,
  setSkinDocs,
  eventDocs,
  setEventDocs,
  boneDocs,
  setBoneDocs,
  generalNotes,
  setGeneralNotes,
  masterSkins,
  masterEvents,
  masterBones,
  safetyBuffer,
  resizedCount,
  optimizationReduction,
  projectedAtlasCount,
  skeletonName,
  totalImages,
  totalAnimations
}) => {
  const [activeTab, setActiveTab] = useState<'tracks' | 'docs'>('tracks');
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set(['notes']));

  useEffect(() => {
    // Auto-enable sections if they have content
    const newVisible = new Set(visibleSections);
    if (skinDocs.length > 0) newVisible.add('skins');
    if (eventDocs.length > 0) newVisible.add('events');
    if (boneDocs.length > 0) newVisible.add('bones');
    if (generalNotes) newVisible.add('notes');
    setVisibleSections(newVisible);
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSection = (section: string) => {
    const next = new Set(visibleSections);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    setVisibleSections(next);
  };

  const addAnimationToTrack = (trackId: string) => {
    setTrackList(prev => prev.map(track => {
      if (track.id === trackId) {
        return {
          ...track,
          animations: [
            ...track.animations,
            {
              id: Math.random().toString(36).substring(2, 9),
              name: availableAnimations[0] || '',
              mixDuration: 0.2,
              loop: false,
              notes: ''
            }
          ]
        };
      }
      return track;
    }));
  };

  const updateAnimation = (trackId: string, animId: string, updates: Partial<TrackAnimationConfig>) => {
    setTrackList(prev => prev.map(track => {
      if (track.id === trackId) {
        return {
          ...track,
          animations: track.animations.map(anim => 
            anim.id === animId ? { ...anim, ...updates } : anim
          )
        };
      }
      return track;
    }));
  };

  const removeAnimation = (trackId: string, animId: string) => {
    setTrackList(prev => prev.map(track => {
      if (track.id === trackId) {
        return {
          ...track,
          animations: track.animations.filter(a => a.id !== animId)
        };
      }
      return track;
    }));
  };

  const handleDownloadHtml = () => {
    const viewerData: ViewerData = {
      trackList,
      skinDocs,
      eventDocs,
      boneDocs,
      generalNotes,
      safetyBuffer,
      timestamp: new Date().toISOString(),
      skeletonName,
      totalImages,
      totalAnimations,
      resizedCount,
      optimizationReduction,
      projectedAtlasCount
    };

    const html = generateStandaloneHtml(viewerData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skeletonName.replace(/\s+/g, '_')}_documentation.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-gray-700 rounded-xl bg-spine-dark shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div>
            <h3 className="text-xl font-semibold text-white">Documentation Builder</h3>
            <p className="text-xs text-gray-400">Configure animation tracks and implementation notes.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-900/50">
          <button
            onClick={() => setActiveTab('tracks')}
            className={clsx(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'tracks' ? "border-spine-accent text-white bg-gray-800/50" : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            Animation Tracks
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={clsx(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'docs' ? "border-spine-accent text-white bg-gray-800/50" : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            Implementation Notes
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-900/30">
          {activeTab === 'tracks' ? (
            <div className="space-y-6">
              {trackList.map((track) => (
                <div key={track.id} className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-spine-accent"></div>
                       Track {track.trackIndex}
                    </span>
                    <button 
                       onClick={() => addAnimationToTrack(track.id)}
                       className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                       <Plus size={14} /> Add Animation
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    {track.animations.length === 0 ? (
                      <div className="text-center py-4 text-gray-600 italic text-sm">
                        No animations on this track.
                      </div>
                    ) : (
                      track.animations.map((anim, idx) => (
                        <div key={anim.id} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-3 bg-gray-900/50 border border-gray-700/50 rounded-lg hover:border-gray-600 transition-colors">
                            <div className="text-gray-500 cursor-move">
                               <GripVertical size={16} />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                               <select 
                                 value={anim.name} 
                                 onChange={(e) => updateAnimation(track.id, anim.id, { name: e.target.value })}
                                 className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:border-spine-accent outline-none"
                               >
                                 <option value="" disabled>Select Animation</option>
                                 {availableAnimations.map(name => (
                                     <option key={name} value={name}>{name}</option>
                                 ))}
                               </select>
                            </div>
                            <div className="flex items-center gap-2">
                               <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1 border border-gray-700" title="Mix Duration (seconds)">
                                  <Clock size={14} className="text-gray-500" />
                                  <input 
                                    type="number" 
                                    step="0.1" 
                                    min="0"
                                    value={anim.mixDuration}
                                    onChange={(e) => updateAnimation(track.id, anim.id, { mixDuration: parseFloat(e.target.value) })}
                                    className="w-12 bg-transparent text-sm text-right focus:outline-none"
                                  />
                                  <span className="text-xs text-gray-500">s</span>
                               </div>
                               <button 
                                 onClick={() => updateAnimation(track.id, anim.id, { loop: !anim.loop })}
                                 className={clsx(
                                    "p-1.5 rounded border transition-colors",
                                    anim.loop ? "bg-blue-900/30 border-blue-700 text-blue-400" : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
                                 )}
                                 title="Toggle Loop"
                               >
                                  <Repeat size={16} />
                               </button>
                            </div>
                            <div className="flex-[2] min-w-[200px]">
                               <input 
                                 type="text" 
                                 placeholder="Implementation notes..."
                                 value={anim.notes}
                                 onChange={(e) => updateAnimation(track.id, anim.id, { notes: e.target.value })}
                                 className="w-full bg-transparent border-b border-gray-700 focus:border-spine-accent text-sm py-1.5 px-2 outline-none text-gray-300 placeholder:text-gray-600"
                               />
                            </div>
                            <button 
                              onClick={() => removeAnimation(track.id, anim.id)}
                              className="text-gray-600 hover:text-red-400 transition-colors p-1"
                            >
                               <Trash2 size={16} />
                            </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
                
                {/* 1. Sections Toolbar */}
                <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Add Sections</h4>
                    <div className="flex flex-wrap gap-3">
                        {!visibleSections.has('events') && (
                            <button 
                                onClick={() => toggleSection('events')}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                            >
                                <Zap size={14} className="text-yellow-400" />
                                Add Events ({eventDocs.length > 0 ? eventDocs.length : masterEvents.length})
                            </button>
                        )}
                        {!visibleSections.has('skins') && (
                            <button 
                                onClick={() => toggleSection('skins')}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                            >
                                <Layers size={14} className="text-blue-400" />
                                Add Skins ({skinDocs.length > 0 ? skinDocs.length : masterSkins.length})
                            </button>
                        )}
                        {!visibleSections.has('bones') && (
                            <button 
                                onClick={() => toggleSection('bones')}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                            >
                                <Bone size={14} className="text-gray-400" />
                                Add Control Bones ({boneDocs.length > 0 ? boneDocs.length : masterBones.length})
                            </button>
                        )}
                        {!visibleSections.has('notes') && (
                            <button 
                                onClick={() => toggleSection('notes')}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                            >
                                <MessageSquare size={14} className="text-emerald-400" />
                                Add General Notes
                            </button>
                        )}
                    </div>
                </div>

                {/* General Notes */}
                {visibleSections.has('notes') && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <MessageSquare size={16} className="text-emerald-400" />
                                General Implementation Notes
                            </h4>
                            <button onClick={() => toggleSection('notes')} className="text-xs text-red-400 hover:underline">Remove</button>
                        </div>
                        <textarea 
                            value={generalNotes}
                            onChange={(e) => setGeneralNotes(e.target.value)}
                            placeholder="Add implementation details, state machine logic, or special instructions..."
                            className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-spine-accent outline-none"
                        />
                    </div>
                )}

                {/* Skins */}
                {visibleSections.has('skins') && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <Layers size={16} className="text-blue-400" />
                                Skins ({skinDocs.length})
                            </h4>
                            <button onClick={() => toggleSection('skins')} className="text-xs text-red-400 hover:underline">Remove Section</button>
                        </div>
                        {skinDocs.length === 0 ? (
                            <div className="text-sm text-gray-500 italic">No skins found.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {skinDocs.filter(d => d.name !== 'default').map((doc, i) => (
                                    <div key={doc.name} className="bg-gray-800/40 p-3 rounded border border-gray-700">
                                        <div className="font-mono text-xs text-blue-300 mb-2">{doc.name}</div>
                                        <input 
                                            type="text"
                                            placeholder="Description..."
                                            value={doc.description}
                                            onChange={(e) => {
                                                const newDocs = [...skinDocs];
                                                newDocs[i].description = e.target.value;
                                                setSkinDocs(newDocs);
                                            }}
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Events */}
                {visibleSections.has('events') && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <Zap size={16} className="text-yellow-400" />
                                Events ({eventDocs.length})
                            </h4>
                            <button onClick={() => toggleSection('events')} className="text-xs text-red-400 hover:underline">Remove Section</button>
                        </div>
                        {eventDocs.length === 0 ? (
                            <div className="text-sm text-gray-500 italic">No events found.</div>
                        ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {eventDocs.map((doc, i) => (
                                    <div key={doc.name} className="bg-gray-800/40 p-3 rounded border border-gray-700">
                                        <div className="font-mono text-xs text-yellow-500 mb-2">{doc.name}</div>
                                        <input 
                                            type="text"
                                            placeholder="Description / Payload..."
                                            value={doc.description}
                                            onChange={(e) => {
                                                const newDocs = [...eventDocs];
                                                newDocs[i].description = e.target.value;
                                                setEventDocs(newDocs);
                                            }}
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:border-yellow-500 outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                 {/* Bones */}
                 {visibleSections.has('bones') && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <Bone size={16} className="text-gray-400" />
                                Control Bones ({boneDocs.length})
                            </h4>
                            <button onClick={() => toggleSection('bones')} className="text-xs text-red-400 hover:underline">Remove Section</button>
                        </div>
                        {boneDocs.length === 0 ? (
                            <div className="text-sm text-gray-500 italic">No control bones (starting with 'ctrl_') found.</div>
                        ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {boneDocs.map((doc, i) => (
                                    <div key={doc.name} className="bg-gray-800/40 p-3 rounded border border-gray-700">
                                        <div className="font-mono text-xs text-gray-300 mb-2">{doc.name}</div>
                                        <input 
                                            type="text"
                                            placeholder="Description..."
                                            value={doc.description}
                                            onChange={(e) => {
                                                const newDocs = [...boneDocs];
                                                newDocs[i].description = e.target.value;
                                                setBoneDocs(newDocs);
                                            }}
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:border-white outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-gray-700 bg-gray-800/50 gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handleDownloadHtml}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-spine-accent rounded-lg hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
          >
            <Download size={18} />
            Export HTML Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
