import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Square, Mic, MicOff, Cloud } from 'lucide-react'
import { TranscriptSegment, RecordingState } from './audio/types'

interface GoogleCloudSTTControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
  onRecordingStateChange?: (state: RecordingState) => void
}

// Configuração da API do Google Cloud
const GOOGLE_API_KEY = 'AIzaSyBfeqhkjNyXjmqI5OPoYb3CosyxwfyA8zY' // Sua chave de API
const GOOGLE_STT_ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize'

export function GoogleCloudSTTController({ onTranscriptUpdate, onRecordingStateChange }: GoogleCloudSTTControllerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const segmentStartTimeRef = useRef<number>(0)
  const transcriptionQueueRef = useRef<number>(0)

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
    console.log('☁️ Google Cloud STT:', text, '- Status:', status)
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

  const transcribeSegment = useCallback(async (audioBlob: Blob, segmentNumber: number) => {
    try {
      const queueNumber = ++transcriptionQueueRef.current
      console.log(`☁️ Iniciando transcrição do segmento ${segmentNumber} (fila: ${queueNumber})`)
      
      // Adicionar segmento temporário
      const tempSegment: TranscriptSegment = {
        start: segmentStartTimeRef.current,
        end: Date.now(),
        speaker: 'TERAPEUTA',
        text: `[Transcrevendo segmento ${segmentNumber}...]`,
        status: 'partial'
      }
      
      segmentsRef.current.push(tempSegment)
      onTranscriptUpdate([...segmentsRef.current])
      
      console.log('☁️ Convertendo áudio para base64...')
      const audioBase64 = await convertBlobToBase64(audioBlob)
      
      const requestBody = {
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'pt-BR',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
          model: 'latest_short', // Usar modelo curto para segmentos pequenos
          useEnhanced: true,
          maxAlternatives: 1,
          profanityFilter: false
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
        throw new Error(`Google STT API Error: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`)
      }
      
      const result = await response.json()
      console.log(`☁️ Resposta do segmento ${segmentNumber}:`, result)
      
      // Remover segmento temporário
      segmentsRef.current = segmentsRef.current.filter(seg => !seg.text.includes(`[Transcrevendo segmento ${segmentNumber}`))
      
      if (result.results && result.results.length > 0) {
        // Processar todos os resultados do segmento
        result.results.forEach((resultItem: any, index: number) => {
          if (resultItem.alternatives && resultItem.alternatives.length > 0) {
            const transcript = resultItem.alternatives[0].transcript
            const confidence = resultItem.alternatives[0].confidence || 0
            
            if (transcript && transcript.trim()) {
              const confidencePercent = Math.round(confidence * 100)
              const segmentText = `${transcript.trim()} (${confidencePercent}%)`
              
              console.log(`📝 Segmento ${segmentNumber}.${index + 1}:`, segmentText)
              
              const finalSegment: TranscriptSegment = {
                start: segmentStartTimeRef.current,
                end: Date.now(),
                speaker: 'TERAPEUTA',
                text: segmentText,
                status: 'final'
              }
              
              segmentsRef.current.push(finalSegment)
            }
          }
        })
      } else {
        console.log(`⚠️ Segmento ${segmentNumber} sem resultados`)
      }
      
      onTranscriptUpdate([...segmentsRef.current])
      
    } catch (error) {
      console.error(`❌ Erro na transcrição do segmento ${segmentNumber}:`, error)
      
      // Remover segmento temporário
      segmentsRef.current = segmentsRef.current.filter(seg => !seg.text.includes(`[Transcrevendo segmento ${segmentNumber}`))
      
      const errorSegment: TranscriptSegment = {
        start: segmentStartTimeRef.current,
        end: Date.now(),
        speaker: 'TERAPEUTA',
        text: `[Erro no segmento ${segmentNumber}: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`,
        status: 'final'
      }
      
      segmentsRef.current.push(errorSegment)
      onTranscriptUpdate([...segmentsRef.current])
    }
  }, [addSegment, onTranscriptUpdate])

  const startRecording = useCallback(async () => {
    try {
      console.log('☁️ Iniciando Google Cloud STT...')
      setIsProcessing(true)
      
      if (!GOOGLE_API_KEY) {
        throw new Error('Chave de API do Google Cloud não configurada')
      }
      
      // Reutilizar stream existente ou criar novo
      let stream = streamRef.current
      
      if (!stream || stream.getTracks().some(track => track.readyState === 'ended')) {
        console.log('🎤 Solicitando novo acesso ao microfone...')
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          }
        })
        streamRef.current = stream
        console.log('✅ Nova permissão de microfone concedida')
      } else {
        console.log('✅ Reutilizando stream de microfone existente')
      }
      
      setHasPermission(true)
      
      // Configurar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      let segmentNumber = 0
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log('📼 Chunk de áudio capturado:', event.data.size, 'bytes')
          
          // Processar este chunk automaticamente
          if (event.data.size > 1000) { // Só processar se tiver conteúdo significativo
            segmentNumber++
            segmentStartTimeRef.current = Date.now() - 3000 // Estimar início do segmento
            
            console.log(`🚀 Processando segmento ${segmentNumber} automaticamente...`)
            
            // Transcrever este segmento em paralelo
            transcribeSegment(event.data, segmentNumber).catch(error => {
              console.error(`❌ Erro ao processar segmento ${segmentNumber}:`, error)
            })
          }
          
          // Manter chunks para gravação final (se necessário no futuro)
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        console.log('📼 Gravação finalizada')
        console.log('📼 Total de chunks processados:', audioChunksRef.current.length)
        
        // Não fazer transcrição aqui - já foi feita em tempo real
        addSegment(`[Gravação finalizada - ${segmentNumber} segmentos processados]`, 'TERAPEUTA')
      }
      
      mediaRecorder.onerror = (event) => {
        console.error('❌ Erro no MediaRecorder:', event)
        addSegment('[Erro na gravação de áudio]', 'TERAPEUTA')
      }
      
      // Não limpar segmentos anteriores - manter histórico
      // segmentsRef.current = []
      // onTranscriptUpdate([])
      
      startTimeRef.current = Date.now()
      setIsRecording(true)
      setIsProcessing(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: true,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      // Iniciar gravação com timeslice para transcrição em tempo real
      mediaRecorder.start(3000) // Captura dados a cada 3 segundos para transcrição
      
      console.log('🎤 Google Cloud STT iniciado - fale no microfone!')
      
      // Adicionar separador se já houver segmentos
      if (segmentsRef.current.length > 0) {
        addSegment('--- Nova Gravação ---', 'TERAPEUTA')
      } else {
        addSegment('[Primeira gravação iniciada]', 'TERAPEUTA')
      }
      
    } catch (error) {
      console.error('❌ Erro ao iniciar Google Cloud STT:', error)
      setIsProcessing(false)
      setHasPermission(false)
      
      addSegment(`[Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`, 'TERAPEUTA')
    }
  }, [transcribeSegment, onRecordingStateChange, addSegment])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando Google Cloud STT...')
      setIsProcessing(true)
      
      // Parar gravação
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      
      setIsRecording(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: false,
        isProcessing: true, // Manter como processando até finalizar
        systemAudioAvailable: false
      })
      
      const duration = Date.now() - startTimeRef.current
      const durationSeconds = Math.round(duration / 1000)
      
      console.log('✅ Google Cloud STT finalizado. Duração:', durationSeconds, 'segundos')
      
      // Finalizar imediatamente - transcrição já foi feita em tempo real
      setIsProcessing(false)
      
      // Não parar o stream aqui - mantê-lo para próximas gravações
      // if (streamRef.current) {
      //   streamRef.current.getTracks().forEach(track => track.stop())
      //   streamRef.current = null
      // }
      
      const transcriptSegments = segmentsRef.current.filter(s => !s.text.includes('[') && s.status === 'final')
      addSegment(`[Sessão finalizada - ${transcriptSegments.length} segmentos transcritos em ${durationSeconds}s]`, 'TERAPEUTA')
      
      console.log(`✅ Sessão finalizada com ${transcriptSegments.length} segmentos transcritos`)
      
      // Preparar para funcionalidade futura (salvar, processar, etc.)
      console.log('🔮 Botão parar pronto para funcionalidade futura...')
      
    } catch (error) {
      console.error('❌ Erro ao parar Google Cloud STT:', error)
      setIsProcessing(false)
    }
  }, [addSegment, onRecordingStateChange])

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 Limpando GoogleCloudSTTController...')
      if (streamRef.current) {
        console.log('🧹 Parando stream de microfone...')
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (mediaRecorderRef.current) {
        console.log('🧹 Parando MediaRecorder...')
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
        mediaRecorderRef.current = null
      }
    }
  }, [])

  // Verificar permissão inicial
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach(track => track.stop())
        setHasPermission(true)
      })
      .catch(() => {
        setHasPermission(false)
      })
  }, [])

  if (!GOOGLE_API_KEY) {
    return (
      <button
        disabled
        className="event-layer w-[32px] h-[32px] rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 flex items-center justify-center cursor-not-allowed"
        title="Chave de API do Google Cloud não configurada"
      >
        <Cloud size={16} />
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
          ? isTranscribing 
            ? 'bg-blue-500/90 border-blue-400 animate-pulse shadow-lg shadow-blue-500/50 scale-110' 
            : 'bg-red-500/90 border-red-400 animate-pulse shadow-lg shadow-red-500/50'
          : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed animate-spin' : ''}`}
      aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
      title={
        isRecording 
          ? isTranscribing 
            ? 'Google Cloud STT - transcrevendo...' 
            : 'Google Cloud STT - gravando'
          : 'Iniciar Google Cloud Speech-to-Text'
      }
    >
      {isRecording ? <Square size={16} /> : <Cloud size={16} />}
    </button>
  )
}
