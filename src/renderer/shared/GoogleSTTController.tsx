import React, { useState, useRef, useCallback } from 'react'
import { Play, Square } from 'lucide-react'
import { TranscriptSegment } from './audio/types'

interface GoogleSTTControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
}

export function GoogleSTTController({ onTranscriptUpdate }: GoogleSTTControllerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Verificar se a Web Speech API está disponível
  const isWebSpeechAvailable = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window

  const setupWebSpeechRecognition = useCallback(() => {
    if (!isWebSpeechAvailable) return null

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'pt-BR'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      console.log('🎤 Google STT: Reconhecimento iniciado')
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('🎤 Google STT: Resultado recebido')
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript.trim()
        const isFinal = result.isFinal
        
        if (transcript.length === 0) continue
        
        console.log('📝 Transcrição:', transcript, 'Final:', isFinal)
        
        const now = Date.now()
        
        // Procurar se já existe um segmento parcial recente
        let existingSegment = segmentsRef.current.find(seg => 
          seg.status === 'partial' && (now - seg.start) < 5000
        )
        
        if (existingSegment) {
          // Atualizar segmento existente
          existingSegment.text = transcript
          existingSegment.status = isFinal ? 'final' : 'partial'
          existingSegment.end = now
        } else {
          // Criar novo segmento
          const newSegment: TranscriptSegment = {
            start: now - 1000, // Estimar início
            end: now,
            speaker: 'TERAPEUTA',
            text: transcript,
            status: isFinal ? 'final' : 'partial'
          }
          
          segmentsRef.current.push(newSegment)
        }
        
        onTranscriptUpdate([...segmentsRef.current])
        
        if (isFinal) {
          console.log('✅ Segmento finalizado:', transcript)
        }
      }
    }

    recognition.onerror = (event) => {
      console.error('❌ Google STT Erro:', event.error)
      
      if (event.error === 'network') {
        console.log('🔄 Erro de rede - tentando reconectar...')
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              console.log('⚠️ Reconhecimento já ativo')
            }
          }
        }, 2000)
        return
      }
      
      if (event.error === 'not-allowed') {
        const errorSegment: TranscriptSegment = {
          start: Date.now(),
          end: Date.now(),
          speaker: 'TERAPEUTA',
          text: '[Erro: Permissão de microfone negada]',
          status: 'final'
        }
        segmentsRef.current.push(errorSegment)
        onTranscriptUpdate([...segmentsRef.current])
        return
      }
      
      // Outros erros
      const errorSegment: TranscriptSegment = {
        start: Date.now(),
        end: Date.now(),
        speaker: 'TERAPEUTA',
        text: `[Erro STT: ${event.error}]`,
        status: 'final'
      }
      segmentsRef.current.push(errorSegment)
      onTranscriptUpdate([...segmentsRef.current])
    }

    recognition.onend = () => {
      console.log('🎤 Google STT: Reconhecimento finalizado')
      setIsListening(false)
      
      if (isRecording) {
        console.log('🔄 Reiniciando reconhecimento...')
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              console.log('⚠️ Erro ao reiniciar:', e)
              setTimeout(() => {
                if (isRecording && recognitionRef.current) {
                  try {
                    recognitionRef.current.start()
                  } catch (e2) {
                    console.error('❌ Falha definitiva ao reiniciar STT')
                  }
                }
              }, 1000)
            }
          }
        }, 100)
      }
    }

    return recognition
  }, [isRecording, onTranscriptUpdate])

  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando Google STT...')
      setIsProcessing(true)
      
      if (!isWebSpeechAvailable) {
        throw new Error('Web Speech API não disponível neste navegador')
      }
      
      // Solicitar permissão de microfone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      })
      
      console.log('✅ Permissão de microfone concedida')
      
      // Configurar reconhecimento
      recognitionRef.current = setupWebSpeechRecognition()
      
      if (!recognitionRef.current) {
        throw new Error('Falha ao configurar reconhecimento de voz')
      }
      
      // Limpar segmentos anteriores
      segmentsRef.current = []
      audioChunksRef.current = []
      onTranscriptUpdate([])
      
      setIsRecording(true)
      setIsProcessing(false)
      
      // Iniciar reconhecimento
      recognitionRef.current.start()
      
      console.log('🎤 Google STT iniciado - fale agora!')
      
      // Adicionar segmento de instrução
      const instructionSegment: TranscriptSegment = {
        start: Date.now(),
        end: Date.now(),
        speaker: 'TERAPEUTA',
        text: '[Sistema pronto - fale no microfone]',
        status: 'final'
      }
      
      segmentsRef.current.push(instructionSegment)
      onTranscriptUpdate([instructionSegment])
      
    } catch (error) {
      console.error('❌ Erro ao iniciar Google STT:', error)
      setIsProcessing(false)
      
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
  }, [setupWebSpeechRecognition, onTranscriptUpdate])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando Google STT...')
      setIsProcessing(true)
      
      // Parar reconhecimento
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      
      setIsRecording(false)
      setIsProcessing(false)
      setIsListening(false)
      
      console.log('✅ Google STT finalizado. Total de segmentos:', segmentsRef.current.length)
      
      // Adicionar segmento de finalização
      const finalSegment: TranscriptSegment = {
        start: Date.now(),
        end: Date.now(),
        speaker: 'TERAPEUTA',
        text: `[Gravação finalizada - ${segmentsRef.current.length - 1} segmentos capturados]`,
        status: 'final'
      }
      
      segmentsRef.current.push(finalSegment)
      onTranscriptUpdate([...segmentsRef.current])
      
    } catch (error) {
      console.error('❌ Erro ao parar Google STT:', error)
      setIsProcessing(false)
    }
  }, [onTranscriptUpdate])

  if (!isWebSpeechAvailable) {
    return (
      <button
        disabled
        className="event-layer w-[32px] h-[32px] rounded-full bg-red-500/20 border border-red-500/30 text-red-300 flex items-center justify-center cursor-not-allowed"
        title="Web Speech API não disponível neste navegador. Use Chrome ou Edge."
      >
        <Square size={16} />
      </button>
    )
  }

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`event-layer w-[32px] h-[32px] rounded-full border text-white/90 flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 ${
        isRecording 
          ? isListening 
            ? 'bg-green-500/90 border-green-400 animate-pulse shadow-lg shadow-green-500/50 scale-110' 
            : 'bg-orange-500/80 border-orange-400 animate-pulse'
          : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed animate-spin' : ''}`}
      aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
      title={
        isRecording 
          ? isListening 
            ? 'Google STT ativo - falando detectado' 
            : 'Google STT ativo - aguardando fala'
          : 'Iniciar Google Speech-to-Text'
      }
    >
      {isRecording ? <Square size={16} /> : <Play size={16} />}
    </button>
  )
}

