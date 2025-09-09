import { useMicVAD } from '@ricky0123/vad-react'
import { useEffect, useRef } from 'react'
import { AudioSegment } from './types'

interface UseMicSegmentsProps {
  onSegmentDetected: (segment: AudioSegment) => void
  enabled: boolean
}

export function useMicSegments({ onSegmentDetected, enabled }: UseMicSegmentsProps) {
  const segmentStartRef = useRef<number | null>(null)
  const isProcessingRef = useRef(false)

  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechStart: (timestamp: number) => {
      if (!enabled || isProcessingRef.current) return
      
      console.log('🎤 MIC VAD: Início de fala detectado em', timestamp)
      segmentStartRef.current = timestamp
    },
    onSpeechEnd: async (timestamp: number) => {
      if (!enabled || !segmentStartRef.current || isProcessingRef.current) return
      
      isProcessingRef.current = true
      
      const startTime = segmentStartRef.current
      const endTime = timestamp
      
      console.log('🎤 MIC VAD: Fim de fala detectado em', timestamp, 'duração:', endTime - startTime)
      
      // Criar segmento de áudio
      const segment: AudioSegment = {
        start: startTime,
        end: endTime,
        speaker: 'TERAPEUTA',
        source: 'MIC'
      }
      
      // Notificar sobre o segmento detectado
      onSegmentDetected(segment)
      
      // Reset para próximo segmento
      segmentStartRef.current = null
      isProcessingRef.current = false
    },
    onVADMisfire: () => {
      console.log('🎤 MIC VAD: Misfire detectado')
    },
    onError: (error) => {
      console.error('🎤 MIC VAD: Erro:', error)
    }
  })

  useEffect(() => {
    if (enabled) {
      console.log('🎤 MIC VAD: Iniciando...')
      vad.start()
    } else {
      console.log('🎤 MIC VAD: Parando...')
      vad.pause()
    }
  }, [enabled, vad])

  return {
    vad,
    isListening: vad.listening,
    isSpeechDetected: vad.userSpeaking,
    error: vad.error
  }
}
