import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Square } from 'lucide-react'
import { TranscriptSegment, RecordingState } from './audio/types'

interface SimpleSTTControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
  onRecordingStateChange?: (state: RecordingState) => void
}

export function SimpleSTTController({ onTranscriptUpdate, onRecordingStateChange }: SimpleSTTControllerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const isActiveRef = useRef<boolean>(false)

  // Frases de exemplo para simular transcrição
  const samplePhrases = [
    "Olá, como você está se sentindo hoje?",
    "Entendo, pode me contar mais sobre isso?",
    "Isso deve ter sido muito difícil para você.",
    "Como você lidou com essa situação?",
    "Você gostaria de explorar esse sentimento?",
    "Isso é muito importante, obrigado por compartilhar.",
    "Vamos trabalhar juntos nessa questão.",
    "Como isso te fez sentir?",
    "Você tem alguma estratégia para lidar com isso?",
    "É normal se sentir assim nessa situação."
  ]

  const addSegment = useCallback((text: string, speaker: 'TERAPEUTA' | 'PACIENTE' | 'DESCONHECIDO' = 'TERAPEUTA') => {
    const now = Date.now()
    const newSegment: TranscriptSegment = {
      start: now,
      end: now + 2000, // 2 segundos de duração estimada
      speaker,
      text,
      status: 'final'
    }
    
    segmentsRef.current.push(newSegment)
    onTranscriptUpdate([...segmentsRef.current])
    
    console.log('📝 Novo segmento adicionado:', text)
  }, [onTranscriptUpdate])

  const simulateTranscription = useCallback(() => {
    // Verificar se ainda está ativo
    if (!isActiveRef.current) {
      console.log('⏹️ Simulação parada - não está mais ativo')
      return
    }
    
    console.log('🎯 Simulando nova transcrição...')
    
    // Alternar entre TERAPEUTA e PACIENTE
    const speakers: Array<'TERAPEUTA' | 'PACIENTE'> = ['TERAPEUTA', 'PACIENTE']
    const randomSpeaker = speakers[Math.floor(Math.random() * speakers.length)]
    
    // Selecionar frase aleatória
    const randomPhrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)]
    
    // Adicionar variação para PACIENTE
    const finalText = randomSpeaker === 'PACIENTE' 
      ? `Sim, ${randomPhrase.toLowerCase()}` 
      : randomPhrase
    
    addSegment(finalText, randomSpeaker)
    
    // Agendar próxima simulação (3-8 segundos)
    const nextInterval = 3000 + Math.random() * 5000
    console.log('⏰ Próxima simulação em:', nextInterval / 1000, 'segundos')
    intervalRef.current = setTimeout(simulateTranscription, nextInterval)
  }, [addSegment])

  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando Simple STT...')
      setIsProcessing(true)
      
      // Limpar segmentos anteriores
      segmentsRef.current = []
      onTranscriptUpdate([])
      
      startTimeRef.current = Date.now()
      isActiveRef.current = true
      setIsRecording(true)
      setIsProcessing(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: true,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      console.log('🎤 Simple STT iniciado!')
      
      // Adicionar segmento inicial
      addSegment('[Gravação iniciada - simulação ativa]')
      
      // Iniciar simulação após 2 segundos
      setTimeout(() => {
        console.log('🚀 Iniciando simulação automática...')
        simulateTranscription()
      }, 2000)
      
    } catch (error) {
      console.error('❌ Erro ao iniciar Simple STT:', error)
      setIsProcessing(false)
      
      addSegment(`[Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`)
    }
  }, [addSegment, simulateTranscription, onRecordingStateChange, isRecording])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando Simple STT...')
      setIsProcessing(true)
      
      // Parar simulação
      isActiveRef.current = false
      
      // Limpar intervalos
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
      
      setIsRecording(false)
      setIsProcessing(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: false,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      const duration = Date.now() - startTimeRef.current
      const durationSeconds = Math.round(duration / 1000)
      
      console.log('✅ Simple STT finalizado. Duração:', durationSeconds, 'segundos')
      
      // Adicionar segmento de finalização
      addSegment(`[Gravação finalizada - ${segmentsRef.current.length} segmentos em ${durationSeconds}s]`)
      
      // Simular salvamento
      setTimeout(async () => {
        try {
          const saveData = {
            timestamp: startTimeRef.current,
            transcript: segmentsRef.current
          }
          
          const result = await window.overlay?.saveRecording?.(saveData)
          
          if (result?.success) {
            addSegment(`[Arquivos salvos em: ${result.path}]`)
            console.log('💾 Arquivos salvos:', result.files)
          } else {
            addSegment('[Erro ao salvar arquivos]')
          }
        } catch (error) {
          console.error('❌ Erro ao salvar:', error)
          addSegment('[Erro ao salvar arquivos]')
        }
      }, 1000)
      
    } catch (error) {
      console.error('❌ Erro ao parar Simple STT:', error)
      setIsProcessing(false)
    }
  }, [addSegment, onRecordingStateChange])

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 Limpando SimpleSTTController...')
      isActiveRef.current = false
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`event-layer w-[32px] h-[32px] rounded-full border text-white/90 flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 ${
        isRecording 
          ? 'bg-red-500/90 border-red-400 animate-pulse shadow-lg shadow-red-500/50' 
          : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed animate-spin' : ''}`}
      aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
      title={
        isRecording 
          ? 'Simple STT ativo - clique para parar'
          : 'Iniciar Simple Speech-to-Text (simulação)'
      }
    >
      {isRecording ? <Square size={16} /> : <Play size={16} />}
    </button>
  )
}
