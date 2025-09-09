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
  // Estados
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  
  // Refs
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const segmentCounterRef = useRef(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const currentChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Função para adicionar segmento
  const addSegment = useCallback((text: string, speaker: 'TERAPEUTA' | 'PACIENTE' | 'DESCONHECIDO' = 'TERAPEUTA', status: 'partial' | 'final' = 'final') => {
    const newSegment: TranscriptSegment = {
      start: Date.now(),
      end: Date.now() + 1000,
      speaker,
      text,
      status
    }
    
    // Se é um segmento partial "(transcrevendo...)", substitui o último se também for partial
    if (status === 'partial' && segmentsRef.current.length > 0) {
      const lastSegment = segmentsRef.current[segmentsRef.current.length - 1]
      if (lastSegment.status === 'partial') {
        segmentsRef.current[segmentsRef.current.length - 1] = newSegment
      } else {
        segmentsRef.current.push(newSegment)
      }
    } else if (status === 'final' && segmentsRef.current.length > 0) {
      // Se é final, substitui o último partial se existir
      const lastSegment = segmentsRef.current[segmentsRef.current.length - 1]
      if (lastSegment.status === 'partial' && lastSegment.text === '(transcrevendo...)') {
        segmentsRef.current[segmentsRef.current.length - 1] = newSegment
      } else {
        segmentsRef.current.push(newSegment)
      }
    } else {
      segmentsRef.current.push(newSegment)
    }
    
    console.log('📝 Novo segmento adicionado:', text)
    onTranscriptUpdate([...segmentsRef.current])
  }, [onTranscriptUpdate])
  
  // Função para transcrever áudio
  const transcribeAudioSegment = useCallback(async (audioBlob: Blob, segmentNumber: number) => {
    try {
      console.log(`☁️ Enviando segmento ${segmentNumber} para Google Cloud STT (${audioBlob.size} bytes)`)
      
      // Converter blob para base64
      const arrayBuffer = await audioBlob.arrayBuffer()
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      
      const requestBody = {
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'pt-BR',
          model: 'latest_long',
          useEnhanced: true,
          maxAlternatives: 1,
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false
        },
        audio: {
          content: base64Audio
        }
      }
      
      const response = await fetch(`${GOOGLE_STT_ENDPOINT}?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log(`📝 Resposta do Google STT para segmento ${segmentNumber}:`, result)
      
      if (result.results && result.results.length > 0) {
        // Processar todos os resultados
        for (const resultItem of result.results) {
          if (resultItem.alternatives && resultItem.alternatives.length > 0) {
            const transcript = resultItem.alternatives[0].transcript
            const confidence = resultItem.alternatives[0].confidence || 0
            
            if (transcript && transcript.trim()) {
              console.log(`✅ Transcrição do segmento ${segmentNumber}: "${transcript}" (confiança: ${confidence})`)
              addSegment(transcript.trim(), 'TERAPEUTA', 'final')
            }
          }
        }
      } else {
        console.log(`⚠️ Nenhuma transcrição encontrada para segmento ${segmentNumber}`)
        addSegment('[Sem transcrição detectada]', 'TERAPEUTA', 'final')
      }
      
    } catch (error) {
      console.error(`❌ Erro ao transcrever segmento ${segmentNumber}:`, error)
      addSegment(`[Erro na transcrição: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`, 'TERAPEUTA', 'final')
    }
  }, [addSegment])
  
  // Função para processar chunk gravado
  const processRecordedChunk = useCallback(async () => {
    if (currentChunksRef.current.length > 0) {
      const segmentNumber = ++segmentCounterRef.current
      const audioBlob = new Blob(currentChunksRef.current, { type: 'audio/webm;codecs=opus' })
      console.log(`🎯 Processando segmento ${segmentNumber}: ${audioBlob.size} bytes`)
      
      // Limpar chunks
      currentChunksRef.current = []
      
      // Adicionar indicador de processamento
      addSegment('(transcrevendo...)', 'TERAPEUTA', 'partial')
      
      // Transcrever
      await transcribeAudioSegment(audioBlob, segmentNumber)
    }
  }, [transcribeAudioSegment, addSegment])
  
  // Função para iniciar gravação
  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando gravação com detecção de voz...')
      setIsProcessing(true)
      
      if (!GOOGLE_API_KEY) {
        throw new Error('Chave de API do Google Cloud não configurada')
      }
      
      // Obter stream do microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      })
      
      console.log('🎤 Microfone acessado com sucesso')
      
      // Criar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      
      // Configurar eventos
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('📼 Chunk gravado:', event.data.size, 'bytes')
          currentChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        console.log('📼 Gravação parou, processando chunk...')
        processRecordedChunk()
      }
      
      // Iniciar gravação contínua em chunks de 3 segundos
      const startChunk = () => {
        if (mediaRecorder.state === 'inactive') {
          currentChunksRef.current = []
          mediaRecorder.start()
          console.log('🔴 Iniciando chunk de gravação')
          
          // Parar após 3 segundos e processar
          recordingTimerRef.current = setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop()
            }
          }, 3000)
        }
      }
      
      // Função para continuar gravando
      const continueRecording = () => {
        if (isRecording) {
          setTimeout(() => {
            if (isRecording && mediaRecorder.state === 'inactive') {
              startChunk()
              continueRecording()
            }
          }, 500) // Pequena pausa entre chunks
        }
      }
      
      setIsRecording(true)
      setIsListening(true)
      setIsProcessing(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: true,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      // Adicionar separador
      if (segmentsRef.current.length > 0) {
        addSegment('--- Nova Sessão ---', 'TERAPEUTA')
      } else {
        addSegment('[Gravação iniciada - fale no microfone]', 'TERAPEUTA')
      }
      
      // Iniciar primeiro chunk
      startChunk()
      continueRecording()
      
      console.log('✅ Sistema de gravação ativo - fale no microfone!')
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error)
      setIsProcessing(false)
      addSegment(`[Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`, 'TERAPEUTA')
    }
  }, [isRecording, onRecordingStateChange, addSegment, processRecordedChunk])
  
  // Função para parar gravação
  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando gravação...')
      setIsProcessing(true)
      setIsRecording(false)
      setIsListening(false)
      
      // Limpar timer
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      
      // Parar MediaRecorder se estiver gravando
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      
      // Parar stream
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
      
      setIsProcessing(false)
      
      // Notificar mudança de estado
      onRecordingStateChange?.({
        isRecording: false,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      const totalSegments = segmentCounterRef.current
      console.log(`✅ Gravação finalizada. Total de segmentos processados: ${totalSegments}`)
      addSegment(`[Sessão finalizada - ${totalSegments} segmentos transcritos]`, 'TERAPEUTA')
      
    } catch (error) {
      console.error('❌ Erro ao parar gravação:', error)
      setIsProcessing(false)
      addSegment(`[Erro ao parar: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`, 'TERAPEUTA')
    }
  }, [onRecordingStateChange, addSegment])
  
  // Cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 Limpando controller...')
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current)
      }
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])
  
  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`event-layer w-[32px] h-[32px] rounded-full border text-white/90 flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 ${
        isRecording 
          ? isListening 
            ? 'bg-green-500/90 border-green-400 animate-pulse shadow-lg shadow-green-500/50 scale-110' 
            : 'bg-red-500/90 border-red-400 animate-pulse shadow-lg shadow-red-500/50'
          : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed animate-spin' : ''}`}
      aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
      title={
        isRecording 
          ? isListening 
            ? 'Gravando em chunks de 3s - clique para parar' 
            : 'Processando áudio...'
          : 'Iniciar gravação com chunks automáticos'
      }
    >
      {isProcessing ? (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : isRecording ? (
        <Square size={16} />
      ) : (
        <Mic size={16} />
      )}
    </button>
  )
}