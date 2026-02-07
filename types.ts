export interface SubtitleSegment {
  id: number;
  startMs: number;
  endMs: number;
  original: string;
  translation: string;
}

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'analyzing' | 'completed' | 'error';
  message?: string;
}

export enum TabView {
  TRANSCRIPT = 'TRANSCRIPT',
  SRT = 'SRT'
}
