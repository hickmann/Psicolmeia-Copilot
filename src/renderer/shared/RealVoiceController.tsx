import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Square } from 'lucide-react'
import { TranscriptSegment } from './audio/types'

interface RealVoiceControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
}

export function RealVoiceController({ onTranscriptUpdate }: RealVoiceControllerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const currentSegmentRef = useRef<TranscriptSegment | null>(null)

  // Verificar se a Web Speech API está disponível
  const isWebSpeechAvailable = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window

  useEffect(() => {
    if (!isWebSpeechAvailable) {
      console.warn('⚠️ Web Speech API não disponível neste navegador')
      return
    }

    // Configurar reconhecimento de fala
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    recognitionRef.current = new SpeechRecognition()
    
    const recognition = recognitionRef.current
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'pt-BR'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      console.log('🎤 Reconhecimento de voz iniciado')
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('🎤 Resultado recebido:', event)
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        const confidence = result[0].confidence
        const isFinal = result.isFinal
        
        console.log('📝 Transcrição:', transcript, 'Final:', isFinal, 'Confiança:', confidence)
        
        const now = Date.now()
        
        if (!currentSegmentRef.current) {
          // Criar novo segmento
          currentSegmentRef.current = {
            start: now,
            end: now,
            speaker: 'TERAPEUTA', // Por enquanto, assumir que é o terapeuta falando
            text: transcript,
            status: isFinal ? 'final' : 'partial'
          }
          
          segmentsRef.current.push(currentSegmentRef.current)
        } else {
          // Atualizar segmento existente
          currentSegmentRef.current.text = transcript
          currentSegmentRef.current.status = isFinal ? 'final' : 'partial'
          currentSegmentRef.current.end = now
        }
        
        // Notificar sobre a atualização
        onTranscriptUpdate([...segmentsRef.current])
        
        if (isFinal) {
          console.log('✅ Segmento finalizado:', currentSegmentRef.current)
          currentSegmentRef.current = null
        }
      }
    }

    recognition.onerror = (event) => {
      console.error('❌ Erro no reconhecimento de voz:', event.error)
      
      // Se for erro de rede, tentar novamente
      if (event.error === 'network') {
        console.log('🔄 Erro de rede - tentando novamente em 2 segundos...')
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              console.log('⚠️ Já está rodando, continuando...')
            }
          }
        }, 2000)
        return
      }
      
      // Para outros erros, mostrar na interface
      const errorSegment: TranscriptSegment = {
        start: Date.now(),
        end: Date.now(),
        speaker: 'TERAPEUTA',
        text: `[Erro: ${event.error}]`,
        status: 'final'
      }
      
      segmentsRef.current.push(errorSegment)
      onTranscriptUpdate([...segmentsRef.current])
    }

    recognition.onend = () => {
      console.log('🎤 Reconhecimento de voz finalizado')
      setIsListening(false)
      
      // Se ainda estamos gravando, reiniciar o reconhecimento
      if (isRecording) {
        console.log('🔄 Reiniciando reconhecimento...')
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              console.log('⚠️ Erro ao reiniciar, tentando novamente em 1 segundo...')
              setTimeout(() => {
                if (isRecording && recognitionRef.current) {
                  try {
                    recognitionRef.current.start()
                  } catch (e2) {
                    console.error('❌ Falha ao reiniciar reconhecimento:', e2)
                  }
                }
              }, 1000)
            }
          }
        }, 500)
      }
    }

    return () => {
      if (recognition) {
        recognition.stop()
      }
    }
  }, [isRecording, onTranscriptUpdate])

  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando gravação com voz real...')
      
      if (!isWebSpeechAvailable) {
        console.error('❌ Web Speech API não disponível')
        return
      }
      
      setIsProcessing(true)
      
      // Solicitar permissão de microfone
      await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('✅ Permissão de microfone concedida')
      
      // Limpar segmentos anteriores
      segmentsRef.current = []
      currentSegmentRef.current = null
      onTranscriptUpdate([])
      
      setIsRecording(true)
      setIsProcessing(false)
      
      // Iniciar reconhecimento
      if (recognitionRef.current) {
        recognitionRef.current.start()
        console.log('🎤 Reconhecimento de voz iniciado - fale no microfone!')
      }
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error)
      setIsProcessing(false)
      
      // Mostrar erro na interface
      const errorSegment: TranscriptSegment = {
        start: Date.now(),
        end: Date.now(),
        speaker: 'TERAPEUTA',
        text: `[Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`,
        status: 'final'
      }
      
      segmentsRef.current = [errorSegment]
      onTranscriptUpdate([errorSegment])
    }
  }, [onTranscriptUpdate])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando gravação...')
      setIsProcessing(true)
      
      // Parar reconhecimento
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      
      setIsRecording(false)
      setIsProcessing(false)
      
      console.log('✅ Gravação finalizada. Total de segmentos:', segmentsRef.current.length)
      
    } catch (error) {
      console.error('❌ Erro ao parar gravação:', error)
      setIsProcessing(false)
    }
  }, [])

  if (!isWebSpeechAvailable) {
    return (
      <button
        disabled
        className="event-layer w-[32px] h-[32px] rounded-full bg-red-500/20 border border-red-500/30 text-red-300 flex items-center justify-center cursor-not-allowed"
        title="Web Speech API não disponível neste navegador"
      >
        <Square size={16} />
      </button>
    )
  }

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`event-layer w-[32px] h-[32px] rounded-full border text-white/90 flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all ${
        isRecording 
          ? isListening 
            ? 'bg-green-500/80 border-green-400 animate-pulse shadow-lg shadow-green-500/30' 
            : 'bg-red-500/80 border-red-400 animate-pulse'
          : 'bg-white/10 border-white/20 hover:bg-white/15'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
    >
      {isRecording ? <Square size={16} /> : <Play size={16} />}
    </button>
  )
}
