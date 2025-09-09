import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Square, Mic, MicOff } from 'lucide-react'
import { TranscriptSegment, RecordingState } from './audio/types'

interface VADSTTControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
  onRecordingStateChange?: (state: RecordingState) => void
}

// Configuração da API do Google Cloud
const GOOGLE_API_KEY = 'AIzaSyBfeqhkjNyXjmqI5OPoYb3CosyxwfyA8zY'
const GOOGLE_STT_ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize'

export function VADSTTController({ onTranscriptUpdate, onRecordingStateChange }: VADSTTControllerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const segmentCounterRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const currentChunksRef = useRef<Blob[]>([])

  const addSegment = useCallback((text: string, speaker: 'TERAPEUTA' | 'PACIENTE' | 'DESCONHECIDO' = 'TERAPEUTA', status: 'partial' | 'final' = 'final') => {
    const now = Date.now()
    const newSegment: TranscriptSegment = {
      start: now,
      end: now + (text.length * 50),
      speaker,
      text,
      status
    }
    
    segmentsRef.current.push(newSegment)
    onTranscriptUpdate([...segmentsRef.current])
    console.log('🎤 VAD STT:', text, '- Status:', status)
  }, [onTranscriptUpdate])

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        } else {
          reject(new Error('Falha ao converter áudio para base64'))
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const transcribeAudioSegment = useCallback(async (audioBlob: Blob, segmentNumber: number) => {
    try {
      console.log(`🎯 Transcrevendo segmento ${segmentNumber} (${audioBlob.size} bytes)`)
      
      // Adicionar segmento temporário
      const tempSegment: TranscriptSegment = {
        start: Date.now(),
        end: Date.now(),
        speaker: 'TERAPEUTA',
        text: `[Transcrevendo segmento ${segmentNumber}...]`,
        status: 'partial'
      }
      
      segmentsRef.current.push(tempSegment)
      onTranscriptUpdate([...segmentsRef.current])
      
      // Converter para base64
      const audioBase64 = await convertBlobToBase64(audioBlob)
      
      const requestBody = {
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'pt-BR',
          enableAutomaticPunctuation: true,
          model: 'latest_short',
          useEnhanced: true,
          maxAlternatives: 1
        },
        audio: {
          content: audioBase64
        }
      }
      
      console.log(`☁️ Enviando segmento ${segmentNumber} para Google Cloud STT...`)
      
      const response = await fetch(`${GOOGLE_STT_ENDPOINT}?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`)
      }
      
      const result = await response.json()
      console.log(`☁️ Resposta do segmento ${segmentNumber}:`, result)
      
      // Remover segmento temporário
      segmentsRef.current = segmentsRef.current.filter(seg => !seg.text.includes(`[Transcrevendo segmento ${segmentNumber}`))
      
      if (result.results && result.results.length > 0) {
        result.results.forEach((resultItem: any) => {
          if (resultItem.alternatives && resultItem.alternatives.length > 0) {
            const transcript = resultItem.alternatives[0].transcript
            const confidence = resultItem.alternatives[0].confidence || 0
            
            if (transcript && transcript.trim()) {
              const confidencePercent = Math.round(confidence * 100)
              const segmentText = `${transcript.trim()} (${confidencePercent}%)`
              
              console.log(`📝 Segmento ${segmentNumber} transcrito:`, segmentText)
              addSegment(segmentText, 'TERAPEUTA', 'final')
            }
          }
        })
      } else {
        console.log(`⚠️ Segmento ${segmentNumber} sem resultados`)
        addSegment(`[Segmento ${segmentNumber} - sem fala detectada]`, 'TERAPEUTA', 'final')
      }
      
    } catch (error) {
      console.error(`❌ Erro na transcrição do segmento ${segmentNumber}:`, error)
      
      // Remover segmento temporário
      segmentsRef.current = segmentsRef.current.filter(seg => !seg.text.includes(`[Transcrevendo segmento ${segmentNumber}`))
      
      addSegment(`[Erro no segmento ${segmentNumber}: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`, 'TERAPEUTA', 'final')
    }
  }, [addSegment, onTranscriptUpdate])

  // Estados para simulação simples de VAD
  const [isListening, setIsListening] = useState(false)
  const [vadLoading, setVadLoading] = useState(false)
  const [vadErrored, setVadErrored] = useState<string | false>(false)
  
  // Timer para segmentos automáticos (simulação)
  const segmentTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Simular VAD com gravação contínua em chunks
  const startVADSimulation = useCallback(() => {
    if (!mediaRecorderRef.current || isListening) return
    
    console.log('🎤 Iniciando simulação VAD - gravação contínua')
    setIsListening(true)
    
    // Gravar em chunks de 3 segundos
    const recordChunk = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
        currentChunksRef.current = []
        mediaRecorderRef.current.start(3000) // 3 segundos
        console.log('🔴 Iniciando chunk de 3 segundos')
      }
    }
    
    // Iniciar primeiro chunk
    recordChunk()
    
    // Continuar gravando chunks
    segmentTimerRef.current = setInterval(recordChunk, 3500) // 3.5s para dar tempo do stop
  }, [isListening])
  
  const stopVADSimulation = useCallback(() => {
    console.log('⏹️ Parando simulação VAD')
    setIsListening(false)
    
    if (segmentTimerRef.current) {
      clearInterval(segmentTimerRef.current)
      segmentTimerRef.current = null
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando VAD STT Controller...')
      setIsProcessing(true)
      
      if (!GOOGLE_API_KEY) {
        throw new Error('Chave de API do Google Cloud não configurada')
      }
      
      // Inicializar contexto de áudio
      audioContextRef.current = new AudioContext()
      
      // Configurar MediaRecorder para capturar segmentos
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      })
      
      console.log('🎤 Microfone acessado com sucesso')
      console.log('📊 Stream info:', {
        active: stream.active,
        id: stream.id,
        tracks: stream.getTracks().length
      })
      
      // Teste básico de áudio
      const audioTrack = stream.getTracks()[0]
      console.log('🎵 Audio track:', {
        enabled: audioTrack.enabled,
        kind: audioTrack.kind,
        label: audioTrack.label,
        readyState: audioTrack.readyState,
        settings: audioTrack.getSettings()
      })
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('📼 Chunk gravado:', event.data.size, 'bytes')
          currentChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        console.log('📼 MediaRecorder parou, processando chunks:', currentChunksRef.current.length)
        
        if (currentChunksRef.current.length > 0) {
          const segmentNumber = ++segmentCounterRef.current
          const audioBlob = new Blob(currentChunksRef.current, { type: 'audio/webm;codecs=opus' })
          console.log(`🎯 Processando segmento ${segmentNumber}: ${audioBlob.size} bytes`)
          
          // Limpar chunks
          currentChunksRef.current = []
          
          // Transcrever este segmento
          transcribeAudioSegment(audioBlob, segmentNumber).catch(error => {
            console.error(`❌ Erro ao processar segmento ${segmentNumber}:`, error)
          })
        } else {
          console.log('⚠️ MediaRecorder parou mas não há chunks para processar')
        }
      }
      
      setIsRecording(true)
      setIsProcessing(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: true,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      console.log('🎤 VAD STT Controller iniciado - gravação em chunks de 3s!')
      
      // Iniciar simulação VAD
      startVADSimulation()
      
      // Verificar status após iniciar
      setTimeout(() => {
        if (vadErrored) {
          console.error('❌ VAD com erro:', vadErrored)
          addSegment(`[Erro no VAD: ${vadErrored}]`, 'TERAPEUTA')
        } else if (!isListening) {
          console.warn('⚠️ VAD não está ouvindo!')
          addSegment('[VAD não está ouvindo - verifique microfone]', 'TERAPEUTA')
        } else {
          console.log('✅ VAD funcionando corretamente!')
          addSegment('[VAD ativo - gravação contínua iniciada]', 'TERAPEUTA')
        }
      }, 1000)
      
      // Adicionar separador se já houver segmentos
      if (segmentsRef.current.length > 0) {
        addSegment('--- Nova Sessão VAD ---', 'TERAPEUTA')
      } else {
        addSegment('[VAD STT iniciado - aguardando fala]', 'TERAPEUTA')
      }
      
    } catch (error) {
      console.error('❌ Erro ao iniciar VAD STT:', error)
      setIsProcessing(false)
      addSegment(`[Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`, 'TERAPEUTA')
    }
  }, [startVADSimulation, transcribeAudioSegment, onRecordingStateChange, addSegment, vadErrored, isListening])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando VAD STT Controller...')
      setIsProcessing(true)
      
      // Parar simulação VAD
      stopVADSimulation()
      
      // Parar MediaRecorder se estiver gravando
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      
      // Parar stream
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
      
      // Fechar contexto de áudio
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(error => {
          console.log('⚠️ AudioContext já estava fechado:', error)
        })
        audioContextRef.current = null
      }
      
      setIsRecording(false)
      setIsProcessing(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: false,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      const transcriptSegments = segmentsRef.current.filter(s => !s.text.includes('[') && s.status === 'final')
      addSegment(`[Sessão VAD finalizada - ${transcriptSegments.length} segmentos transcritos]`, 'TERAPEUTA')
      
      console.log(`✅ VAD STT Controller finalizado com ${transcriptSegments.length} segmentos`)
      
    } catch (error) {
      console.error('❌ Erro ao parar VAD STT:', error)
      setIsProcessing(false)
    }
  }, [stopVADSimulation, addSegment, onRecordingStateChange])

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 Limpando VADSTTController...')
      stopVADSimulation()
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(error => {
          console.log('⚠️ AudioContext já estava fechado:', error)
        })
        audioContextRef.current = null
      }
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
        mediaRecorderRef.current = null
      }
    }
  }, [stopVADSimulation])

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing || vadLoading}
      className={`event-layer w-[32px] h-[32px] rounded-full border text-white/90 flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 ${
        isRecording 
          ? isListening 
            ? 'bg-green-500/90 border-green-400 animate-pulse shadow-lg shadow-green-500/50 scale-110' 
            : 'bg-red-500/90 border-red-400 animate-pulse shadow-lg shadow-red-500/50'
          : vadLoading
            ? 'bg-yellow-500/90 border-yellow-400 animate-pulse'
            : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed animate-spin' : ''}`}
      aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
      title={
        vadLoading 
          ? 'Carregando modelo VAD...'
          : isRecording 
            ? isListening 
              ? 'VAD detectou fala - gravando segmento' 
              : 'VAD ativo - aguardando fala'
            : 'Iniciar VAD Speech-to-Text'
      }
    >
      {vadLoading ? (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : isRecording ? (
        <Square size={16} />
      ) : (
        <Mic size={16} />
      )}
    </button>
  )
}
