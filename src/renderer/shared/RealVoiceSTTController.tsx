import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Square, Mic, MicOff } from 'lucide-react'
import { TranscriptSegment, RecordingState } from './audio/types'

interface RealVoiceSTTControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
  onRecordingStateChange?: (state: RecordingState) => void
}

export function RealVoiceSTTController({ onTranscriptUpdate, onRecordingStateChange }: RealVoiceSTTControllerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const startTimeRef = useRef<number>(0)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Verificar se a Web Speech API está disponível
  const isWebSpeechAvailable = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window

  const addSegment = useCallback((text: string, speaker: 'TERAPEUTA' | 'PACIENTE' | 'DESCONHECIDO' = 'TERAPEUTA', status: 'partial' | 'final' = 'final') => {
    const now = Date.now()
    const newSegment: TranscriptSegment = {
      start: now,
      end: now + (text.length * 50), // Estimar duração baseada no comprimento
      speaker,
      text,
      status
    }
    
    // Se for parcial, substituir o último segmento parcial ou adicionar novo
    if (status === 'partial') {
      const lastSegmentIndex = segmentsRef.current.findIndex(seg => seg.status === 'partial')
      if (lastSegmentIndex >= 0) {
        segmentsRef.current[lastSegmentIndex] = newSegment
      } else {
        segmentsRef.current.push(newSegment)
      }
    } else {
      // Se for final, remover parciais e adicionar final
      segmentsRef.current = segmentsRef.current.filter(seg => seg.status === 'final')
      segmentsRef.current.push(newSegment)
    }
    
    onTranscriptUpdate([...segmentsRef.current])
    console.log('🎤 Voz capturada:', text, '- Status:', status)
  }, [onTranscriptUpdate])

  const setupSpeechRecognition = useCallback(() => {
    if (!isWebSpeechAvailable) return null

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    // Configurações otimizadas
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'pt-BR'
    recognition.maxAlternatives = 1
    
    recognition.onstart = () => {
      console.log('🎤 Reconhecimento de voz iniciado')
      setIsListening(true)
      addSegment('[Microfone ativo - fale agora]', 'TERAPEUTA')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('🎤 Resultado recebido, processando...')
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript.trim()
        const isFinal = result.isFinal
        const confidence = result[0].confidence
        
        if (transcript.length === 0) continue
        
        console.log('📝 Transcrição:', transcript, '- Final:', isFinal, '- Confiança:', confidence)
        
        // Adicionar segmento (parcial ou final)
        addSegment(transcript, 'TERAPEUTA', isFinal ? 'final' : 'partial')
      }
    }

    recognition.onerror = (event) => {
      console.error('❌ Erro de reconhecimento:', event.error)
      
      switch (event.error) {
        case 'network':
          addSegment('[Erro de rede - tentando reconectar...]', 'TERAPEUTA')
          // Tentar reconectar após 2 segundos
          if (isRecording) {
            restartTimeoutRef.current = setTimeout(() => {
              if (recognitionRef.current && isRecording) {
                try {
                  recognitionRef.current.start()
                } catch (e) {
                  console.log('⚠️ Reconhecimento já ativo ou erro ao reiniciar')
                }
              }
            }, 2000)
          }
          break
          
        case 'not-allowed':
          addSegment('[Erro: Permissão de microfone negada]', 'TERAPEUTA')
          setHasPermission(false)
          break
          
        case 'no-speech':
          addSegment('[Nenhuma fala detectada - continue falando]', 'TERAPEUTA')
          break
          
        case 'audio-capture':
          addSegment('[Erro de captura de áudio - verifique o microfone]', 'TERAPEUTA')
          break
          
        default:
          addSegment(`[Erro: ${event.error}]`, 'TERAPEUTA')
      }
    }

    recognition.onend = () => {
      console.log('🎤 Reconhecimento finalizado')
      setIsListening(false)
      
      // Reiniciar automaticamente se ainda estiver gravando
      if (isRecording && recognitionRef.current) {
        console.log('🔄 Reiniciando reconhecimento automático...')
        restartTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current && isRecording) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              console.log('⚠️ Erro ao reiniciar reconhecimento:', e)
            }
          }
        }, 100)
      }
    }

    return recognition
  }, [isRecording, addSegment])

  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando captura de voz real...')
      setIsProcessing(true)
      
      if (!isWebSpeechAvailable) {
        throw new Error('Web Speech API não disponível neste navegador')
      }
      
      // Solicitar permissão de microfone primeiro
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop()) // Parar o stream, só queríamos testar a permissão
        setHasPermission(true)
        console.log('✅ Permissão de microfone concedida')
      } catch (permError) {
        console.error('❌ Permissão de microfone negada:', permError)
        setHasPermission(false)
        throw new Error('Permissão de microfone necessária')
      }
      
      // Limpar segmentos anteriores
      segmentsRef.current = []
      onTranscriptUpdate([])
      
      // Configurar reconhecimento
      recognitionRef.current = setupSpeechRecognition()
      
      if (!recognitionRef.current) {
        throw new Error('Falha ao configurar reconhecimento de voz')
      }
      
      startTimeRef.current = Date.now()
      setIsRecording(true)
      setIsProcessing(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: true,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      // Iniciar reconhecimento
      recognitionRef.current.start()
      
      console.log('🎤 Captura de voz iniciada - fale no microfone!')
      
    } catch (error) {
      console.error('❌ Erro ao iniciar captura de voz:', error)
      setIsProcessing(false)
      
      addSegment(`[Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`)
    }
  }, [setupSpeechRecognition, onRecordingStateChange, addSegment])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando captura de voz...')
      setIsProcessing(true)
      
      // Limpar timeouts
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
        restartTimeoutRef.current = null
      }
      
      // Parar reconhecimento
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      
      setIsRecording(false)
      setIsProcessing(false)
      setIsListening(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: false,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      const duration = Date.now() - startTimeRef.current
      const durationSeconds = Math.round(duration / 1000)
      
      console.log('✅ Captura de voz finalizada. Duração:', durationSeconds, 'segundos')
      
      // Remover segmentos parciais finais
      segmentsRef.current = segmentsRef.current.filter(seg => seg.status === 'final')
      
      // Adicionar segmento de finalização
      addSegment(`[Gravação finalizada - ${segmentsRef.current.length} segmentos em ${durationSeconds}s]`)
      
      // Tentar salvar
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
      console.error('❌ Erro ao parar captura de voz:', error)
      setIsProcessing(false)
    }
  }, [addSegment, onRecordingStateChange])

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 Limpando RealVoiceSTTController...')
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  // Verificar permissão inicial
  useEffect(() => {
    if (isWebSpeechAvailable && hasPermission === null) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach(track => track.stop())
          setHasPermission(true)
        })
        .catch(() => {
          setHasPermission(false)
        })
    }
  }, [isWebSpeechAvailable])

  if (!isWebSpeechAvailable) {
    return (
      <button
        disabled
        className="event-layer w-[32px] h-[32px] rounded-full bg-gray-500/20 border border-gray-500/30 text-gray-400 flex items-center justify-center cursor-not-allowed"
        title="Web Speech API não disponível neste navegador"
      >
        <MicOff size={16} />
      </button>
    )
  }

  if (hasPermission === false) {
    return (
      <button
        onClick={() => window.location.reload()}
        className="event-layer w-[32px] h-[32px] rounded-full bg-red-500/20 border border-red-500/30 text-red-300 flex items-center justify-center hover:scale-105"
        title="Permissão de microfone negada - clique para recarregar"
      >
        <MicOff size={16} />
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
            ? 'Ouvindo sua voz - fale no microfone' 
            : 'Reconhecimento ativo - aguardando fala'
          : 'Iniciar captura de voz real'
      }
    >
      {isRecording ? <Square size={16} /> : <Mic size={16} />}
    </button>
  )
}
