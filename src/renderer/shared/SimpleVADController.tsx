import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square } from 'lucide-react'
import { TranscriptSegment, RecordingState } from './audio/types'

interface SimpleVADControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
  onRecordingStateChange?: (state: RecordingState) => void
}

export function SimpleVADController({ onTranscriptUpdate, onRecordingStateChange }: SimpleVADControllerProps) {
  // Estados
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  
  // Refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const segmentCounterRef = useRef(0)
  const speechStartTimeRef = useRef<number>(0)
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Configurações VAD
  const SILENCE_THRESHOLD = 0.05 // Threshold para detectar silêncio
  const SPEECH_THRESHOLD = 0.08  // Threshold para detectar fala
  const MIN_SPEECH_DURATION = 500 // Mínimo de 500ms de fala
  const MAX_SILENCE_DURATION = 1000 // Máximo de 1s de silêncio para parar
  
  const silenceCounterRef = useRef(0)
  const speechCounterRef = useRef(0)
  
  // Função para analisar áudio e detectar fala
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return
    
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    // Calcular RMS (Root Mean Square) para detectar volume
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += (dataArray[i] / 255) * (dataArray[i] / 255)
    }
    const rms = Math.sqrt(sum / bufferLength)
    
    // Log periódico para debug (a cada 100 ciclos = ~2s)
    if (Math.random() < 0.01) {
      console.log(`📊 VAD Debug: RMS=${rms.toFixed(4)}, isSpeaking=${isSpeaking}, speech=${speechCounterRef.current}, silence=${silenceCounterRef.current}`)
    }
    
    // Detectar fala ou silêncio
    if (rms > SPEECH_THRESHOLD) {
      speechCounterRef.current++
      silenceCounterRef.current = 0
      
      // Iniciar gravação se não estiver falando ainda
      if (!isSpeaking && speechCounterRef.current > 5) { // ~100ms de fala consistente
        console.log('🎤 VAD: Início da fala detectado (RMS:', rms.toFixed(4), ')')
        setIsSpeaking(true)
        startSpeechRecording()
      }
    } else if (rms < SILENCE_THRESHOLD) {
      silenceCounterRef.current++
      speechCounterRef.current = 0
      
      // Parar gravação se estiver falando e houver silêncio suficiente
      if (isSpeaking && silenceCounterRef.current > 25) { // ~500ms de silêncio
        console.log('🎤 VAD: Fim da fala detectado (RMS:', rms.toFixed(4), ', silêncio:', silenceCounterRef.current, ')')
        setIsSpeaking(false)
        stopSpeechRecording()
      }
    } else {
      // Zona intermediária - reduzir contadores gradualmente
      if (isSpeaking) {
        silenceCounterRef.current++
        speechCounterRef.current = Math.max(0, speechCounterRef.current - 1)
        
        // Se estiver na zona intermediária por muito tempo, considerar como silêncio
        if (silenceCounterRef.current > 25) { // ~500ms de zona intermediária
          console.log('🎤 VAD: Fim da fala detectado (zona intermediária, RMS:', rms.toFixed(4), ')')
          setIsSpeaking(false)
          stopSpeechRecording()
        }
      } else {
        speechCounterRef.current = Math.max(0, speechCounterRef.current - 1)
        silenceCounterRef.current = Math.max(0, silenceCounterRef.current - 1)
      }
    }
  }, [isSpeaking])
  
  // Iniciar gravação de um segmento de fala
  const startSpeechRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'inactive') return
    
    speechStartTimeRef.current = Date.now()
    audioChunksRef.current = []
    
    try {
      mediaRecorderRef.current.start()
      console.log('🔴 Iniciando gravação do segmento de fala')
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação do segmento:', error)
    }
  }, [])
  
  // Parar gravação de um segmento de fala
  const stopSpeechRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return
    
    try {
      mediaRecorderRef.current.stop()
      console.log('⏹️ Parando gravação do segmento de fala')
    } catch (error) {
      console.error('❌ Erro ao parar gravação do segmento:', error)
    }
  }, [])
  
  // Processar segmento de áudio gravado
  const processAudioSegment = useCallback(async (audioBlob: Blob) => {
    const segmentId = `segment-${++segmentCounterRef.current}`
    const speechEndTime = Date.now()
    const duration = speechEndTime - speechStartTimeRef.current
    
    // Só processar se tiver duração mínima
    if (duration < MIN_SPEECH_DURATION) {
      console.log(`⚠️ Segmento ${segmentId} muito curto (${duration}ms), ignorando`)
      return
    }
    
    console.log(`🎯 Processando segmento ${segmentId}: ${audioBlob.size} bytes, ${duration}ms`)
    
    // Adicionar segmento partial
    const partialSegment: TranscriptSegment = {
      start: speechStartTimeRef.current / 1000,
      end: speechEndTime / 1000,
      speaker: 'TERAPEUTA',
      text: '(transcrevendo...)',
      status: 'partial'
    }
    
    setSegments(prev => {
      const updated = [...prev, partialSegment]
      setTimeout(() => onTranscriptUpdate(updated), 0)
      return updated
    })
    
    // Simular STT (substitua por integração real)
    setTimeout(() => {
      const finalSegment: TranscriptSegment = {
        start: speechStartTimeRef.current / 1000,
        end: speechEndTime / 1000,
        speaker: 'TERAPEUTA',
        text: `Segmento ${segmentCounterRef.current} - ${duration}ms de fala detectada`,
        status: 'final'
      }
      
      setSegments(prev => {
        const updated = prev.map(seg => 
          seg.start === partialSegment.start && seg.status === 'partial'
            ? finalSegment
            : seg
        )
        setTimeout(() => onTranscriptUpdate(updated), 0)
        return updated
      })
    }, 2000)
    
  }, [onTranscriptUpdate])
  
  // Iniciar sistema VAD
  const startVAD = useCallback(async () => {
    try {
      console.log('🔴 Iniciando sistema VAD...')
      setIsProcessing(true)
      
      // Obter stream do microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // Desabilitar para melhor detecção VAD
          autoGainControl: true,
          sampleRate: 44100
        }
      })
      
      mediaStreamRef.current = stream
      console.log('🎤 Microfone acessado com sucesso')
      
      // Criar contexto de áudio
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      
      // Criar analisador
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.8
      source.connect(analyserRef.current)
      
      // Criar MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      // Configurar eventos do MediaRecorder
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorderRef.current.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
          processAudioSegment(audioBlob)
        }
      }
      
      // Iniciar análise VAD
      vadIntervalRef.current = setInterval(analyzeAudio, 20) // 50 FPS
      
      setIsRecording(true)
      setIsProcessing(false)
      
      // Notificar estado
      onRecordingStateChange?.({
        isRecording: true,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      // Adicionar segmento inicial
      const startSegment: TranscriptSegment = {
        start: Date.now() / 1000,
        end: Date.now() / 1000,
        speaker: 'TERAPEUTA',
        text: '[🔴 VAD ativo - fale para começar a gravar]',
        status: 'final'
      }
      
      setSegments([startSegment])
      setTimeout(() => onTranscriptUpdate([startSegment]), 0)
      
      console.log('✅ Sistema VAD ativo!')
      
    } catch (error) {
      console.error('❌ Erro ao iniciar VAD:', error)
      setIsProcessing(false)
    }
  }, [analyzeAudio, processAudioSegment, onRecordingStateChange, onTranscriptUpdate])
  
  // Parar sistema VAD
  const stopVAD = useCallback(async () => {
    try {
      console.log('⏹️ Parando sistema VAD...')
      setIsProcessing(true)
      
      // Parar análise VAD
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current)
        vadIntervalRef.current = null
      }
      
      // Parar gravação se estiver ativa
      if (isSpeaking) {
        stopSpeechRecording()
      }
      
      // Fechar contexto de áudio
      if (audioContextRef.current) {
        await audioContextRef.current.close()
        audioContextRef.current = null
      }
      
      // Parar stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
      }
      
      setIsRecording(false)
      setIsSpeaking(false)
      setIsProcessing(false)
      
      // Notificar estado
      onRecordingStateChange?.({
        isRecording: false,
        isProcessing: false,
        systemAudioAvailable: false
      })
      
      // Adicionar segmento final
      const endSegment: TranscriptSegment = {
        start: Date.now() / 1000,
        end: Date.now() / 1000,
        speaker: 'TERAPEUTA',
        text: `[⏹️ VAD parado - ${segmentCounterRef.current} segmentos processados]`,
        status: 'final'
      }
      
      setSegments(prev => {
        const updated = [...prev, endSegment]
        setTimeout(() => onTranscriptUpdate(updated), 0)
        return updated
      })
      
      console.log(`✅ VAD parado. Total: ${segmentCounterRef.current} segmentos`)
      
    } catch (error) {
      console.error('❌ Erro ao parar VAD:', error)
      setIsProcessing(false)
    }
  }, [isSpeaking, stopSpeechRecording, onRecordingStateChange, onTranscriptUpdate])
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])
  
  return (
    <button
      onClick={isRecording ? stopVAD : startVAD}
      disabled={isProcessing}
      className={`event-layer w-[32px] h-[32px] rounded-full border text-white/90 flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 ${
        isRecording 
          ? isSpeaking
            ? 'bg-green-500/90 border-green-400 animate-pulse shadow-lg shadow-green-500/50 scale-110' 
            : 'bg-blue-500/90 border-blue-400 shadow-lg shadow-blue-500/30'
          : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={isRecording ? 'Parar VAD' : 'Iniciar VAD'}
      title={
        isRecording 
          ? isSpeaking 
            ? 'Gravando fala - clique para parar' 
            : 'Aguardando fala - clique para parar'
          : 'Iniciar detecção de voz (VAD)'
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
