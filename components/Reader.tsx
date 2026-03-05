
import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, ChevronLeft, Bookmark, Volume2, User, X, VolumeX, ChevronDown, Check } from 'lucide-react';
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
  onSegmentClick 
}) => {
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [playback.currentSegmentIndex]);

  const handleVolumeInteraction = (v: number) => {
    onVolumeChange(v);
    // Reset auto-hide timer whenever user interacts with slider
    if (volumeTimeoutRef.current) window.clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = window.setTimeout(() => {
      setShowVolumeSlider(false);
    }, 2000);
  };

  const selectedVoice = voices.find(v => v.voiceURI === playback.voiceURI);
  const voiceDisplayName = selectedVoice ? selectedVoice.name.split(' ')[0] : 'Default';

  return (
    <div className="h-full flex flex-col bg-[#FDFCFB] max-w-lg mx-auto w-full overflow-hidden safe-pb">
      {/* Top Progress Bar */}
      <div className="pt-6 px-6 flex items-center gap-3">
        <div className="h-1 flex-1 bg-stone-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-700 ease-out" 
            style={{ width: `${((playback.currentSegmentIndex + 1) / story.segments.length) * 100}%` }}
          />
        </div>
        <span className="text-[9px] font-black text-stone-400 tabular-nums uppercase tracking-widest">
          {playback.currentSegmentIndex + 1} / {story.segments.length}
        </span>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 px-6 pt-8 pb-32 overflow-y-auto hide-scrollbar">
        <h1 className="serif text-2xl font-bold text-stone-900 mb-6 leading-tight opacity-90">{story.title}</h1>
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

      {/* Compact Smartphone Control Bar */}
      <div className="fixed bottom-6 left-0 right-0 px-4 z-50 flex justify-center">
        <div className="bg-white/90 backdrop-blur-2xl rounded-full p-2 flex items-center gap-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-white/50 w-full max-w-sm">
          
          {/* Back Button */}
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-50 active:scale-90 transition-all shrink-0"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Play/Pause Button - Main Focus */}
          <button 
              onClick={onTogglePlay}
              className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 active:scale-95 transition-all shrink-0"
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
          >
            <span className="text-[11px] font-bold truncate pr-1">{voiceDisplayName}</span>
            <ChevronDown size={12} className="opacity-40 shrink-0" />
          </button>

          {/* Bookmark */}
          <button 
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 active:scale-90 transition-all shrink-0"
          >
             <Bookmark size={16} />
          </button>
        </div>
      </div>

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
