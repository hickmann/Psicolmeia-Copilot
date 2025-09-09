import React from 'react'
import { TranscriptSegment } from './audio/types'

interface TranscriptViewProps {
  segments: TranscriptSegment[]
  isRecording: boolean
}

export function TranscriptView({ segments, isRecording }: TranscriptViewProps) {
  console.log('🖥️ TranscriptView: Renderizando com', segments.length, 'segmentos', segments)
  const formatTime = (ms: number) => {
    const date = new Date(ms)
    return date.toLocaleTimeString('pt-BR', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'TERAPEUTA':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'PACIENTE':
        return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'DESCONHECIDO':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-white/60 text-sm">
        {isRecording ? 'Aguardando fala...' : 'Nenhuma transcrição disponível'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-white/85 text-[12.5px] font-medium mb-[6px]">
        Transcript {isRecording && <span className="text-green-400">(ao vivo)</span>}
      </div>
      <div className="max-h-48 overflow-y-auto space-y-2">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-start gap-2 text-[12px]">
            <span className="text-white/60 font-mono text-[10px] min-w-[60px]">
              {formatTime(segment.start)}
            </span>
            <span className={`px-2 py-1 rounded text-[10px] font-medium border ${getSpeakerColor(segment.speaker)}`}>
              {segment.speaker}
            </span>
            <span className={`flex-1 ${
              segment.status === 'partial' 
                ? 'text-white/60 italic' 
                : 'text-white/90'
            }`}>
              {segment.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
