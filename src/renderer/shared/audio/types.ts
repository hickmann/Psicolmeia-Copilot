export type Speaker = 'TERAPEUTA' | 'PACIENTE' | 'DESCONHECIDO'

export type SegmentStatus = 'partial' | 'final'

export interface AudioSegment {
  start: number
  end: number
  speaker: Speaker
  source: 'MIC' | 'SYSTEM'
  audioData?: ArrayBuffer
}

export interface TranscriptSegment {
  start: number
  end: number
  speaker: Speaker
  text: string
  status: SegmentStatus
}

export interface AudioStreams {
  mic: MediaStream | null
  system: MediaStream | null
  mixed: MediaStream | null
}

export interface RecordingState {
  isRecording: boolean
  isProcessing: boolean
  systemAudioAvailable: boolean
  systemAudioError?: string
}

export interface GeminiConfig {
  apiKey: string
  model?: string
  language?: string
}
