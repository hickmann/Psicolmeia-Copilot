import { useEffect, useRef, useState } from 'react'
import { AudioSegment } from './types'

interface UseSystemSegmentsProps {
  stream: MediaStream | null
  onSegmentDetected: (segment: AudioSegment) => void
  enabled: boolean
}

export function useSystemSegments({ stream, onSegmentDetected, enabled }: UseSystemSegmentsProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeechDetected, setIsSpeechDetected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  
  const segmentStartRef = useRef<number | null>(null)
  const isProcessingRef = useRef(false)
  
  // Configurações do VAD
  const SPEECH_THRESHOLD = 30 // Limiar para detectar fala
  const SILENCE_DURATION = 1000 // ms de silêncio para considerar fim de fala
  const MIN_SPEECH_DURATION = 200 // ms mínimos de fala

  useEffect(() => {
    if (!stream || !enabled) {
      stopListening()
      return
    }

    startListening()
    
    return () => {
      stopListening()
    }
  }, [stream, enabled])

  const startListening = async () => {
    try {
      console.log('🔊 SYSTEM VAD: Iniciando...')
      
      // Criar contexto de áudio
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream!)
      
      // Criar analisador
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      analyserRef.current.smoothingTimeConstant = 0.8
      
      source.connect(analyserRef.current)
      
      // Criar array de dados
      const bufferLength = analyserRef.current.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)
      
      setIsListening(true)
      setError(null)
      
      // Iniciar loop de análise
      analyzeAudio()
      
    } catch (err) {
      console.error('🔊 SYSTEM VAD: Erro ao iniciar:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  const stopListening = () => {
    console.log('🔊 SYSTEM VAD: Parando...')
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    analyserRef.current = null
    dataArrayRef.current = null
    segmentStartRef.current = null
    isProcessingRef.current = false
    
    setIsListening(false)
    setIsSpeechDetected(false)
  }

  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    
    // Calcular energia média
    let sum = 0
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i]
    }
    const average = sum / dataArrayRef.current.length
    
    const currentTime = Date.now()
    const isSpeech = average > SPEECH_THRESHOLD
    
    setIsSpeechDetected(isSpeech)
    
    if (isSpeech && !segmentStartRef.current) {
      // Início de fala detectado
      console.log('🔊 SYSTEM VAD: Início de fala detectado em', currentTime)
      segmentStartRef.current = currentTime
      
    } else if (!isSpeech && segmentStartRef.current && !isProcessingRef.current) {
      // Verificar se é realmente fim de fala (não apenas pausa)
      const speechDuration = currentTime - segmentStartRef.current
      
      if (speechDuration >= MIN_SPEECH_DURATION) {
        // Fim de fala detectado
        isProcessingRef.current = true
        
        const startTime = segmentStartRef.current
        const endTime = currentTime
        
        console.log('🔊 SYSTEM VAD: Fim de fala detectado em', currentTime, 'duração:', speechDuration)
        
        // Criar segmento de áudio
        const segment: AudioSegment = {
          start: startTime,
          end: endTime,
          speaker: 'PACIENTE',
          source: 'SYSTEM'
        }
        
        // Notificar sobre o segmento detectado
        onSegmentDetected(segment)
        
        // Reset para próximo segmento
        segmentStartRef.current = null
        isProcessingRef.current = false
      } else {
        // Fala muito curta, ignorar
        segmentStartRef.current = null
      }
    }
    
    // Continuar análise
    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }

  return {
    isListening,
    isSpeechDetected,
    error
  }
}
