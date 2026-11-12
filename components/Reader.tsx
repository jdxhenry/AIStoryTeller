import React, { useRef, useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  Bookmark, 
  Volume2, 
  User, 
  X, 
  VolumeX, 
  ChevronDown, 
  Check, 
  Pencil,
  ClipboardPaste,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Story, PlaybackState } from '../types';

interface ReaderProps {
  story: Story;
  playback: PlaybackState;
  voices: SpeechSynthesisVoice[];
  volume: number;
  onVolumeChange: (v: number) => void;
  onBack: () => void;
  onTogglePlay: () => void;
  onSkip: (direction: 'prev' | 'next') => void;
  onVoiceChange: (voiceURI: string) => void;
  onPreviewVoice: (voiceURI: string) => void;
  onSpeedChange: (speed: number) => void;
  onSegmentClick: (index: number) => void;
  onStopAudio?: () => void;
  onReplaceContent?: (newContent: string) => void;
}

const Reader: React.FC<ReaderProps> = ({ 
  story, 
  playback, 
  voices,
  volume,
  onVolumeChange,
  onBack,
  onTogglePlay, 
  onVoiceChange,
  onSegmentClick,
  onStopAudio,
  onReplaceContent 
}) => {
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeTimeoutRef = useRef<number | null>(null);

  // Quick Content Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [editorError, setEditorError] = useState<string | null>(null);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [clipboardMessage, setClipboardMessage] = useState<string | null>(null);
  const [pendingClipboardText, setPendingClipboardText] = useState('');
  const [showPasteChoice, setShowPasteChoice] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Scroll active segment into view when index or story changes
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [playback.currentSegmentIndex, story.id]);

  const handleVolumeInteraction = (v: number) => {
    onVolumeChange(v);
    if (volumeTimeoutRef.current) window.clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = window.setTimeout(() => {
      setShowVolumeSlider(false);
    }, 2000);
  };

  // Quick Content Editor Handlers
  const handleOpenEditor = () => {
    setEditorText(story.content || story.segments.map(s => s.text).join('\n\n'));
    setEditorError(null);
    setClipboardError(null);
    setClipboardMessage(null);
    setShowPasteChoice(false);
    setShowClearConfirm(false);
    setIsEditorOpen(true);
  };

  const handleCancelEditor = () => {
    setIsEditorOpen(false);
    setEditorText('');
    setEditorError(null);
    setClipboardError(null);
    setClipboardMessage(null);
    setShowPasteChoice(false);
    setShowClearConfirm(false);
  };

  const handlePasteFromClipboard = async () => {
    setClipboardError(null);
    setClipboardMessage(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error("Clipboard API is unavailable in this environment. You can paste using keyboard shortcuts (Ctrl+V / Cmd+V).");
      }
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        setClipboardMessage("Clipboard is empty or contains no readable text.");
        setTimeout(() => setClipboardMessage(null), 3500);
        return;
      }

      // If the editor is empty, insert directly without asking
      if (!editorText.trim()) {
        setEditorText(clipText);
        setClipboardMessage(`Pasted ${clipText.length.toLocaleString()} characters.`);
        setTimeout(() => setClipboardMessage(null), 3000);
        return;
      }

      // If editor already has content, prompt user to choose Append or Replace
      setPendingClipboardText(clipText);
      setShowPasteChoice(true);
    } catch (err: unknown) {
      console.warn("Clipboard access error:", err);
      setClipboardError((err as Error).message || "Clipboard access denied. Please paste text directly into the editor.");
      setTimeout(() => setClipboardError(null), 5000);
    }
  };

  const handleClearClick = () => {
    if (!editorText.trim()) return;
    // Ask for confirmation if there is substantial existing content (>50 chars)
    if (editorText.trim().length > 50) {
      setShowClearConfirm(true);
    } else {
      setEditorText('');
    }
  };

  const handleSaveAndStartReading = () => {
    const trimmed = editorText.trim();
    if (!trimmed) {
      setEditorError("Please type or paste some text before saving.");
      return;
    }

    if (onStopAudio) {
      onStopAudio();
    }
    if (onReplaceContent) {
      onReplaceContent(trimmed);
    }
    setIsEditorOpen(false);
    setEditorText('');
    setEditorError(null);
  };

  const selectedVoice = voices.find(v => v.voiceURI === playback.voiceURI);
  const voiceDisplayName = selectedVoice ? selectedVoice.name.split(' ')[0] : 'Default';
  const charCount = editorText.length;
  const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;

  return (
    <div className="h-full flex flex-col bg-[#FDFCFB] max-w-lg mx-auto w-full overflow-hidden safe-pb relative">
      {/* Top Progress Bar */}
      <div className="pt-6 px-6 flex items-center gap-3">
        <div className="h-1 flex-1 bg-stone-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-700 ease-out" 
            style={{ width: `${((playback.currentSegmentIndex + 1) / story.segments.length) * 100}%` }}
          />
        </div>
        <span className="text-[9px] font-black text-stone-400 tabular-nums uppercase tracking-widest shrink-0">
          {playback.currentSegmentIndex + 1} / {story.segments.length}
        </span>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 px-6 pt-6 pb-32 overflow-y-auto hide-scrollbar">
        {/* Document Title with subtle Edit Content action */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <h1 className="serif text-2xl font-bold text-stone-900 leading-tight opacity-90 flex-1 min-w-0 break-words">
            {story.title}
          </h1>
          <button
            onClick={handleOpenEditor}
            className="mt-0.5 p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:scale-90 transition-all shrink-0 flex items-center gap-1.5 border border-transparent hover:border-stone-200/60"
            title="Edit Content"
            aria-label="Edit reading content"
          >
            <Pencil size={16} />
            <span className="text-[11px] font-bold text-stone-500 hidden sm:inline">Edit</span>
          </button>
        </div>

        <div className="space-y-6">
          {story.segments.map((segment, idx) => {
            const isActive = idx === playback.currentSegmentIndex;
            return (
              <div 
                key={idx}
                ref={isActive ? activeSegmentRef : null}
                onClick={() => onSegmentClick(idx)}
                className={`transition-all duration-500 cursor-pointer text-lg md:text-xl font-medium leading-relaxed tracking-tight ${
                  isActive ? 'text-stone-900 opacity-100' : 'text-stone-200 opacity-40 hover:opacity-60'
                }`}
              >
                {segment.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Audio Player Control Bar */}
      <div className="fixed bottom-6 left-0 right-0 px-4 z-50 flex justify-center">
        <div className="bg-white/90 backdrop-blur-2xl rounded-full p-2 flex items-center gap-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-white/50 w-full max-w-sm">
          
          {/* Back Button (Retained in bottom audio player) */}
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-50 active:scale-90 transition-all shrink-0"
            title="Back to library"
            aria-label="Back to library"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Play/Pause Button - Main Focus */}
          <button 
            onClick={onTogglePlay}
            className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 active:scale-95 transition-all shrink-0"
            title={playback.isPlaying ? "Pause" : "Play"}
            aria-label={playback.isPlaying ? "Pause" : "Play"}
          >
            {playback.isPlaying ? (
              <Pause size={22} fill="white" />
            ) : (
              <Play size={22} fill="white" className="ml-0.5" />
            )}
          </button>

          {/* Volume Expansion Logic */}
          <div className="flex items-center gap-1 relative">
            <button 
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${showVolumeSlider ? 'bg-blue-50 text-blue-600' : 'text-stone-500 hover:bg-stone-50'}`}
              title="Volume"
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            
            {showVolumeSlider && (
              <div className="flex items-center gap-2 bg-blue-50/50 rounded-full px-3 py-1.5 animate-in slide-in-from-left-2 fade-in duration-200">
                <input 
                  type="range" min="0" max="1" step="0.01" value={volume} 
                  onChange={e => handleVolumeInteraction(parseFloat(e.target.value))}
                  className="w-16 h-1 accent-blue-600 bg-stone-200 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, #2563eb ${volume * 100}%, #d6d3d1 ${volume * 100}%)` }}
                />
              </div>
            )}
          </div>

          {/* Voice Selector - Smaller UI */}
          <button 
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex-1 min-w-0 h-10 rounded-full bg-stone-50 px-3 flex items-center justify-between text-stone-600 hover:bg-stone-100 active:scale-95 transition-all"
            title="Narrator voice"
          >
            <span className="text-[11px] font-bold truncate pr-1">{voiceDisplayName}</span>
            <ChevronDown size={12} className="opacity-40 shrink-0" />
          </button>

          {/* Bookmark */}
          <button 
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 active:scale-90 transition-all shrink-0"
            title="Bookmark"
          >
            <Bookmark size={16} />
          </button>
        </div>
      </div>

      {/* Quick Content Editor (Mobile Bottom Sheet & Desktop Modal) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" 
            onClick={handleCancelEditor} 
          />
          <div className="relative w-full sm:max-w-xl md:max-w-2xl bg-[#FDFCFB] rounded-t-[2.25rem] sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden border border-stone-200/60 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            
            {/* Editor Header */}
            <div className="p-5 sm:p-6 pb-3 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center shrink-0">
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 leading-tight">Edit Reading Content</h3>
                  <p className="text-[11px] text-stone-400 font-medium tabular-nums mt-0.5">
                    {charCount.toLocaleString()} characters • {wordCount.toLocaleString()} words
                  </p>
                </div>
              </div>
              <button 
                onClick={handleCancelEditor} 
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors"
                title="Cancel & close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Actions Bar (Paste & Clear) */}
            <div className="px-5 sm:px-6 py-2.5 bg-stone-50/70 border-b border-stone-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-700 hover:bg-stone-100 active:scale-95 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  title="Paste from system clipboard"
                >
                  <ClipboardPaste size={14} className="text-blue-600" />
                  <span>Paste Clipboard</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearClick}
                  disabled={!editorText}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-600 hover:text-red-600 hover:bg-red-50 hover:border-red-100 active:scale-95 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                  title="Clear text"
                >
                  <Trash2 size={14} />
                  <span>Clear</span>
                </button>
              </div>

              {clipboardMessage && (
                <span className="text-[11px] font-semibold text-emerald-600 animate-in fade-in truncate max-w-[200px]">
                  {clipboardMessage}
                </span>
              )}
            </div>

            {/* Notification & Error Banners */}
            {clipboardError && (
              <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                <span className="flex-1 leading-tight">{clipboardError}</span>
                <button onClick={() => setClipboardError(null)} className="text-amber-500 hover:text-amber-800">
                  <X size={14} />
                </button>
              </div>
            )}

            {editorError && (
              <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-red-600" />
                <span className="flex-1 leading-tight">{editorError}</span>
                <button onClick={() => setEditorError(null)} className="text-red-500 hover:text-red-800">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Textarea Workspace */}
            <div className="p-5 sm:p-6 flex-1 min-h-[220px] max-h-[50vh] sm:max-h-[55vh] flex flex-col">
              <textarea
                autoFocus
                value={editorText}
                onChange={e => {
                  setEditorText(e.target.value);
                  if (editorError) setEditorError(null);
                }}
                placeholder="Type, edit, or paste your reading material here..."
                className="w-full flex-1 p-4 bg-white border border-stone-200/90 rounded-2xl resize-none text-base sm:text-lg text-stone-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-stone-300 font-sans hide-scrollbar shadow-inner"
              />
            </div>

            {/* Editor Footer Actions */}
            <div className="p-4 sm:p-5 pt-3 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between gap-3 safe-pb">
              <button 
                type="button"
                onClick={handleCancelEditor}
                className="py-3 px-5 rounded-2xl bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95 text-xs font-bold transition-all shrink-0"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSaveAndStartReading}
                className="flex-1 py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                <Play size={15} fill="white" />
                <span>Save & Start Reading</span>
              </button>
            </div>

            {/* Confirmation: Append vs Replace for Non-Empty Clipboard Paste */}
            {showPasteChoice && (
              <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm z-30 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <ClipboardPaste size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Paste into existing text?</h4>
                      <p className="text-[11px] text-stone-400">
                        Editor already contains {charCount.toLocaleString()} chars.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-stone-50 p-3 rounded-2xl border border-stone-100 text-xs text-stone-600 max-h-24 overflow-y-auto hide-scrollbar italic">
                    "{pendingClipboardText.slice(0, 180)}..."
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditorText(prev => prev ? prev + '\n\n' + pendingClipboardText : pendingClipboardText);
                        setShowPasteChoice(false);
                        setPendingClipboardText('');
                        setClipboardMessage("Appended clipboard text to end.");
                        setTimeout(() => setClipboardMessage(null), 3000);
                      }}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors flex items-center justify-between"
                    >
                      <span>Append to End</span>
                      <span className="text-[10px] opacity-70 uppercase tracking-wider font-semibold">Keep both</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => {
                        setEditorText(pendingClipboardText);
                        setShowPasteChoice(false);
                        setPendingClipboardText('');
                        setClipboardMessage("Replaced editor text with clipboard.");
                        setTimeout(() => setClipboardMessage(null), 3000);
                      }}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition-colors flex items-center justify-between shadow-sm"
                    >
                      <span>Replace All Existing Text</span>
                      <span className="text-[10px] opacity-70 uppercase tracking-wider font-semibold">Overwrite</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => {
                        setShowPasteChoice(false);
                        setPendingClipboardText('');
                      }}
                      className="w-full py-2 text-stone-400 hover:text-stone-600 text-xs font-semibold text-center mt-1"
                    >
                      Cancel Paste
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation: Clear Substantial Text */}
            {showClearConfirm && (
              <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm z-30 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
                    <Trash2 size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-base">Clear editor text?</h4>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      This will erase all content in the editor. Your active audio playback will not be affected unless you save.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50 transition-colors"
                    >
                      Keep Text
                    </button>
                    <button 
                      type="button"
                      onClick={() => { 
                        setEditorText(''); 
                        setShowClearConfirm(false); 
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors shadow-sm"
                    >
                      Yes, Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Refined Voice Selection Modal - Smaller & Cleaner */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm" onClick={() => setIsVoiceModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-6 duration-300 overflow-hidden">
             <div className="p-6 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">Narrator</h3>
                  <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Select Voice</p>
                </div>
                <button 
                  onClick={() => setIsVoiceModalOpen(false)} 
                  className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-400"
                >
                  <X size={16} />
                </button>
             </div>
             
             <div className="max-h-[50vh] overflow-y-auto hide-scrollbar p-4 space-y-1.5 pb-8">
               {voices.map(v => (
                 <div 
                   key={v.voiceURI}
                   onClick={() => { onVoiceChange(v.voiceURI); setIsVoiceModalOpen(false); }}
                   className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all border ${
                     playback.voiceURI === v.voiceURI 
                       ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                       : 'bg-white border-stone-50 hover:border-stone-100 text-stone-600'
                   }`}
                 >
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${playback.voiceURI === v.voiceURI ? 'bg-white/20' : 'bg-stone-50'}`}>
                      <User size={14} className={playback.voiceURI === v.voiceURI ? 'text-white' : 'text-stone-400'} />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="font-bold text-xs truncate leading-none mb-1">{v.name}</p>
                     <p className={`text-[9px] font-medium uppercase tracking-tight opacity-70`}>{v.lang}</p>
                   </div>
                   {playback.voiceURI === v.voiceURI && <Check size={14} className="text-white shrink-0" />}
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reader;
