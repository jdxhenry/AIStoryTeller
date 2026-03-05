
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, X, AlertCircle, Sparkles, FileText, Loader2, Globe, Headphones, Mic, ShieldAlert } from 'lucide-react';
import { Story, PlaybackState } from './types';
import { parseFile, segmentText } from './utils/fileParsers';
import Reader from './components/Reader';
import { GoogleGenAI } from "@google/genai";
import { initNativeApp } from './utils/nativeBridge';
import { transcribeAudio } from './services/geminiService';

const App: React.FC = () => {
  const [story, setStory] = useState<Story | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [volume, setVolume] = useState(1.0);
  const [playback, setPlayback] = useState<PlaybackState>({
    currentSegmentIndex: 0,
    isPlaying: false,
    isLoading: false,
    voiceURI: '',
    speed: 1.0
  });
  const [error, setError] = useState<{ message: string; type?: 'tts' | 'file' | 'web' } | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [activeInput, setActiveInput] = useState<'url' | 'paste' | 'audio' | null>(null);
  
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  // Initialize Native Android Structure
  useEffect(() => {
    initNativeApp();
  }, []);

  const getFilteredVoices = (allVoices: SpeechSynthesisVoice[]) => {
    const allowedLocales = ['en-us', 'en-gb', 'en-in', 'es-es'];
    const femaleKeywords = ['female', 'woman', 'girl', 'lady', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'kathy', 'zira', 'maria', 'hazel', 'monica', 'helena', 'laura', 'susan', 'linda', 'heather', 'alice', 'veena'];
    const maleKeywords = ['male', 'man', 'boy', 'david', 'mark', 'daniel', 'paul', 'george', 'james', 'richard'];

    return allVoices.filter(v => {
      const locale = v.lang.toLowerCase().replace('_', '-');
      const isAllowedLocale = allowedLocales.some(al => locale.startsWith(al));
      if (!isAllowedLocale) return false;
      const nameLower = v.name.toLowerCase();
      if (maleKeywords.some(kw => nameLower.includes(kw))) return false;
      const hasFemaleKeyword = femaleKeywords.some(kw => nameLower.includes(kw));
      const isGoogleFemaleDefault = v.name.includes('Google') && (v.lang.startsWith('en') || v.lang.startsWith('es'));
      return hasFemaleKeyword || isGoogleFemaleDefault;
    });
  };

  const updateVoices = useCallback(() => {
    if (!synthRef.current) return;
    const allVoices = synthRef.current.getVoices();
    const filtered = getFilteredVoices(allVoices);
    if (filtered.length > 0) {
      setVoices(filtered);
      setPlayback(p => {
        if (!p.voiceURI) {
          const preferred = filtered.find(v => v.name.includes('Google') && v.lang.startsWith('en-US')) || filtered.find(v => v.lang.startsWith('en')) || filtered[0];
          return { ...p, voiceURI: preferred.voiceURI };
        }
        return p;
      });
    }
  }, []);

  useEffect(() => {
    if (!synthRef.current) {
      setError({ message: "Your browser does not support Speech Synthesis. Please try a modern browser like Chrome.", type: 'tts' });
      return;
    }

    updateVoices();
    if (typeof synthRef.current.onvoiceschanged !== 'undefined') {
      synthRef.current.onvoiceschanged = updateVoices;
    }
    
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (voices.length === 0) {
        updateVoices();
      } else {
        clearInterval(interval);
      }
      if (attempts > 10 && voices.length === 0) {
        clearInterval(interval);
        setError({ message: "Could not load system voices. Check your device's accessibility settings.", type: 'tts' });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [updateVoices, voices.length]);

  const stopAudio = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setPlayback(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const handlePreviewVoice = useCallback((voiceURI: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (!voice) {
      setError({ message: "Selected voice is no longer available.", type: 'tts' });
      return;
    }
    const utter = new SpeechSynthesisUtterance("I am ready to read your story.");
    utter.voice = voice;
    utter.rate = playback.speed;
    utter.volume = volume;
    utter.onerror = (e) => {
      setError({ message: `Voice preview failed: ${e.error}`, type: 'tts' });
    };
    synthRef.current.speak(utter);
  }, [voices, playback.speed, volume]);

  const createStory = (title: string, text: string) => {
    if (!text.trim()) {
      setError({ message: "The story content is empty.", type: 'file' });
      return;
    }
    const segments = segmentText(text);
    if (segments.length === 0) {
      setError({ message: "Could not find any readable text in this document.", type: 'file' });
      return;
    }
    const storyId = btoa(encodeURIComponent(title + text.slice(0, 20))).slice(0, 32);
    setStory({
      id: storyId,
      title,
      content: text,
      segments: segments.map((s, idx) => ({ id: `${storyId}-${idx}`, text: s, status: 'idle' }))
    });
    setPlayback(p => ({ ...p, currentSegmentIndex: 0, isPlaying: false }));
    setError(null);
  };

  const fetchFromUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract the main story text content from: ${urlInput}. Return ONLY the core text, no metadata.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      const extractedText = response.text;
      if (!extractedText || extractedText.length < 50) throw new Error("Could not extract a meaningful story from this link.");
      const titleMatch = urlInput.match(/([^/]+)(?=\/?$)/);
      createStory(titleMatch ? titleMatch[0].replace(/-/g, ' ') : "Web Story", extractedText);
    } catch (err: unknown) {
      setError({ message: (err as Error).message || "Unable to process URL.", type: 'web' });
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleAudioTranscription = async (file: File) => {
    setIsTranscribing(true);
    setError(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Audio = await base64Promise;
      
      const text = await transcribeAudio(base64Audio, file.type);
      if (!text || text.length < 10) throw new Error("Transcription failed or result too short.");
      
      createStory(file.name.split('.')[0], text);
    } catch (err: unknown) {
      setError({ message: (err as Error).message || "Unable to transcribe audio.", type: 'file' });
    } finally {
      setIsTranscribing(false);
    }
  };

  const playSegment = useCallback((index: number) => {
    if (!story || !synthRef.current) return;
    
    stopAudio();
    
    const segment = story.segments[index];
    if (!segment) return;

    const utter = new SpeechSynthesisUtterance(segment.text);
    const selectedVoice = voices.find(v => v.voiceURI === playback.voiceURI);
    
    if (selectedVoice) {
      utter.voice = selectedVoice;
    } else if (voices.length > 0) {
      utter.voice = voices[0];
    }
    
    utter.rate = playback.speed;
    utter.volume = volume;
    
    utter.onend = () => {
      setPlayback(prev => {
        if (prev.isPlaying && index + 1 < story.segments.length) {
          return { ...prev, currentSegmentIndex: index + 1 };
        }
        return { ...prev, isPlaying: false };
      });
    };

    utter.onerror = (event) => {
      console.error('SpeechSynthesisUtterance error', event);
      if (event.error === 'interrupted') return; 
      
      setPlayback(prev => ({ ...prev, isPlaying: false }));
      
      let msg = "Narrator encountered an error.";
      if (event.error === 'voice-unavailable') msg = "Selected voice is currently unavailable.";
      if (event.error === 'not-allowed') msg = "Playback not allowed. Please interact with the page first.";
      
      setError({ message: msg, type: 'tts' });
    };

    try {
      synthRef.current.speak(utter);
      setPlayback(p => ({ ...p, currentSegmentIndex: index, isPlaying: true }));
    } catch {
      setError({ message: "Failed to start speech synthesis.", type: 'tts' });
    }
  }, [story, voices, playback.voiceURI, playback.speed, volume, stopAudio]);

  useEffect(() => {
    if (playback.isPlaying && story) {
      playSegment(playback.currentSegmentIndex);
    }
  }, [playback.currentSegmentIndex, playback.isPlaying, playSegment, story]);

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#FDFCFB] overflow-hidden safe-pb">
      {!story ? (
        <div className="flex-1 min-h-0 flex flex-col px-8 pt-12 pb-8 max-w-lg mx-auto w-full relative">
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
            <h2 className="serif text-5xl font-bold text-stone-900 leading-[1.1] tracking-tight">
              Quiet moments, <br/><span className="italic font-normal text-stone-400">narrated.</span>
            </h2>
          </div>

          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto hide-scrollbar pb-10">
            <label className="bg-white rounded-[2rem] p-5 flex items-center gap-6 shadow-xl shadow-stone-200/40 border border-stone-50 group hover:scale-[1.01] transition-all cursor-pointer">
              <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={async (e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   try { 
                     const text = await parseFile(file);
                     createStory(file.name.split('.')[0], text); 
                   } catch (err: unknown) { 
                     setError({ message: (err as Error).message || "Failed to read file.", type: 'file' }); 
                   }
                 }
              }} />
              <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                 <Upload size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-stone-900 text-lg leading-tight">Read Document</p>
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest mt-0.5">PDF, Word, or TXT</p>
              </div>
            </label>

            <div 
              onClick={() => setActiveInput(activeInput === 'url' ? null : 'url')}
              className="bg-white rounded-[2rem] p-5 flex flex-col gap-4 shadow-xl shadow-stone-200/40 border border-stone-50 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500">
                   <Globe size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-stone-900 text-lg leading-tight">Web Article</p>
                  <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest mt-0.5">Narrate from Link</p>
                </div>
              </div>
              {activeInput === 'url' && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                  <input autoFocus placeholder="https://..." className="w-full text-sm p-3 bg-stone-50 border border-stone-100 rounded-xl outline-none" value={urlInput} onChange={e => setUrlInput(e.target.value)} />
                  <button onClick={fetchFromUrl} className="w-full py-3 bg-pink-500 text-white text-xs font-bold rounded-xl uppercase tracking-widest">
                    {isFetchingUrl ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Fetch Story'}
                  </button>
                </div>
              )}
            </div>

            <div 
              onClick={() => setActiveInput(activeInput === 'paste' ? null : 'paste')}
              className="bg-white rounded-[2rem] p-5 flex flex-col gap-4 shadow-xl shadow-stone-200/40 border border-stone-50 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
                   <FileText size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-stone-900 text-lg leading-tight">Paste & Play</p>
                  <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest mt-0.5">Narrate Text Now</p>
                </div>
              </div>
              {activeInput === 'paste' && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                  <textarea autoFocus placeholder="Your text here..." className="w-full h-32 text-sm p-3 bg-stone-50 border border-stone-100 rounded-xl outline-none resize-none" value={pastedText} onChange={e => setPastedText(e.target.value)} />
                  <button onClick={() => createStory("Quick Note", pastedText)} className="w-full py-3 bg-stone-900 text-white text-xs font-bold rounded-xl uppercase tracking-widest">
                    Start Reading
                  </button>
                </div>
              )}
            </div>

            <div 
              onClick={() => setActiveInput(activeInput === 'audio' ? null : 'audio')}
              className="bg-white rounded-[2rem] p-5 flex flex-col gap-4 shadow-xl shadow-stone-200/40 border border-stone-50 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                   <Mic size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-stone-900 text-lg leading-tight">Audio to Text</p>
                  <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest mt-0.5">Transcribe MP3</p>
                </div>
              </div>
              {activeInput === 'audio' && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                  <label className="w-full py-4 border-2 border-dashed border-emerald-100 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-emerald-50/50 transition-colors cursor-pointer">
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="audio/mp3,audio/mpeg,audio/wav" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAudioTranscription(file);
                      }} 
                    />
                    {isTranscribing ? (
                      <Loader2 size={24} className="animate-spin text-emerald-500" />
                    ) : (
                      <Upload size={24} className="text-emerald-400" />
                    )}
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                      {isTranscribing ? 'Transcribing...' : 'Upload Audio File'}
                    </span>
                  </label>
                  <p className="text-[10px] text-center text-stone-400 font-medium">Supports MP3, WAV up to 20MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-around text-stone-300 pt-6">
             <button className="p-3"><Sparkles size={20} /></button>
             <button className="p-3"><Mic size={20} /></button>
             <button className="p-3 relative">
               <div className="w-1.5 h-1.5 bg-pink-500 rounded-full absolute top-3 right-3 border border-[#FDFCFB]" />
               <Headphones size={20} className="text-stone-900" />
             </button>
             <button className="p-3"><X size={20} /></button>
          </div>
        </div>
      ) : (
        <Reader 
          story={story} 
          playback={playback} 
          voices={voices}
          volume={volume}
          onVolumeChange={setVolume}
          onBack={() => { stopAudio(); setStory(null); }}
          onTogglePlay={() => {
            if (playback.isPlaying) stopAudio();
            else playSegment(playback.currentSegmentIndex);
          }}
          onSkip={(dir) => {
            const newIdx = dir === 'next' ? Math.min(playback.currentSegmentIndex + 1, story.segments.length - 1) : Math.max(playback.currentSegmentIndex - 1, 0);
            setPlayback(p => ({ ...p, currentSegmentIndex: newIdx, isPlaying: true }));
          }}
          onVoiceChange={(vURI) => { 
            stopAudio(); 
            setPlayback(p => ({ ...p, voiceURI: vURI, isPlaying: false })); 
          }}
          onPreviewVoice={handlePreviewVoice}
          onSpeedChange={(s) => setPlayback(p => ({ ...p, speed: s }))}
          onSegmentClick={(idx) => {
            setPlayback(p => ({ ...p, currentSegmentIndex: idx, isPlaying: true }));
          }}
        />
      )}

      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4 animate-in slide-in-from-bottom-4">
           <div className={`bg-white border p-4 rounded-3xl flex items-center gap-3 shadow-2xl ${error.type === 'tts' ? 'border-red-100' : 'border-stone-100'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${error.type === 'tts' ? 'bg-red-50 text-red-500' : 'bg-stone-50 text-stone-500'}`}>
                {error.type === 'tts' ? <ShieldAlert size={20} /> : <AlertCircle size={20} />}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-0.5">{error.type || 'Error'}</p>
                <p className="text-xs font-bold text-stone-700 leading-tight">{error.message}</p>
              </div>
              <button onClick={() => setError(null)} className="p-2 text-stone-300 hover:text-stone-500 transition-colors">
                <X size={18} />
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
