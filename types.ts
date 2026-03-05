
export interface StorySegment {
  text: string;
  status: 'idle' | 'ready' | 'error';
  id: string;
}

export interface Story {
  id: string;
  title: string;
  content: string;
  segments: StorySegment[];
}

export interface PlaybackState {
  currentSegmentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  voiceURI: string;
  speed: number;
}
