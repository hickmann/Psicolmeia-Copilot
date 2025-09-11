import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, AlertCircle, Volume2 } from 'lucide-react'
import { TranscriptSegment, RecordingState } from './audio/types'

interface WhisperVADControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
  onRecordingStateChange?: (state: RecordingState) => void
}

export function WhisperVADController({ onTranscriptUpdate, onRecordingStateChange }: WhisperVADControllerProps) {
  // Estados
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [whisperStatus, setWhisperStatus] = useState<'checking' | 'ready' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)
  
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
  const SILENCE_THRESHOLD = 0.03
  const SPEECH_THRESHOLD = 0.10
  const MIN_SPEECH_DURATION = 500
  const MAX_SILENCE_DURATION = 1000
  
  const silenceCounterRef = useRef(0)
  const speechCounterRef = useRef(0)
  const isSpeakingRef = useRef(false)

  // Verificar disponibilidade do Whisper
  useEffect(() => {
    checkWhisperAvailability()
  }, [])

  const checkWhisperAvailability = async () => {
    try {
      if (!window.electronAPI?.invoke) {
        console.log('🎤 [WhisperVAD] Running in browser mode - using mock transcription')
        setWhisperStatus('ready')
        return
      }

      const result = await window.electronAPI.invoke('stt:whisper:check')
      if (result.success && result.binaryExists && result.modelExists) {
        setWhisperStatus('ready')
        setError(null)
      } else {
        setWhisperStatus('error')
        setError(`Whisper não disponível: ${result.errors?.join(', ') || 'Configuração incompleta'}`)
      }
    } catch (error) {
      console.error('🎤 [WhisperVAD] Failed to check whisper:', error)
      setWhisperStatus('error')
      setError(`Erro ao verificar whisper: ${error.message}`)
    }
  }

  const startWhisperSession = async () => {
    try {
      if (!window.electronAPI?.invoke) {
        console.log('🎤 [WhisperVAD] Running in browser mode - skipping whisper session start')
        return
      }

      const result = await window.electronAPI.invoke('stt:whisper:start')
      if (!result.success) {
        throw new Error(result.error || 'Failed to start whisper session')
      }
      
      console.log('🎤 [WhisperVAD] Whisper session started')
    } catch (error) {
      console.error('🎤 [WhisperVAD] Failed to start whisper session:', error)
      throw error
    }
  }

  const stopWhisperSession = async () => {
    try {
      if (!window.electronAPI?.invoke) {
        console.log('🎤 [WhisperVAD] Running in browser mode - skipping whisper session stop')
        return
      }

      const result = await window.electronAPI.invoke('stt:whisper:stop')
      if (!result.success) {
        console.warn('⚠️ Failed to stop whisper session:', result.error)
      }
      
      console.log('🎤 [WhisperVAD] Whisper session stopped')
    } catch (error) {
      console.error('🎤 [WhisperVAD] Failed to stop whisper session:', error)
    }
  }

  const processAudioSegment = async (audioData: Float32Array, startTime: number, endTime: number) => {
    try {
      const segmentId = `whisper-${segmentCounterRef.current++}-${Date.now()}`
      
      // Converter PCM para WAV (16kHz mono)
      const wavBuffer = pcmToWav(audioData, 16000, 16000)
      
      console.log(`🎤 [WhisperVAD] Processing segment ${segmentId} (${wavBuffer.byteLength} bytes)`)
      
      // Adicionar segmento partial
      const partialSegment: TranscriptSegment = {
        start: startTime,
        end: endTime,
        speaker: 'TERAPEUTA',
        text: '(transcrevendo...)',
        status: 'partial',
        id: segmentId
      }
      
      setSegments(prev => {
        const updated = [...prev, partialSegment]
        setTimeout(() => onTranscriptUpdate(updated), 0)
        return updated
      })

      if (window.electronAPI?.invoke) {
        // Enviar para whisper para processamento
        const result = await window.electronAPI.invoke('stt:whisper:push', {
          segmentId,
          wav: wavBuffer,
          start: startTime,
          end: endTime,
          speaker: 'TERAPEUTA'
        })
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to process audio segment')
        }
        
        // Atualizar segmento com resultado
        if (result.text) {
          const finalSegment: TranscriptSegment = {
            start: startTime,
            end: endTime,
            speaker: 'TERAPEUTA',
            text: result.text,
            status: 'final',
            id: segmentId
          }
          
          setSegments(prev => {
            const updated = prev.map(seg => seg.id === segmentId ? finalSegment : seg)
            setTimeout(() => onTranscriptUpdate(updated), 0)
            return updated
          })
        }
      } else {
        // Modo browser - simular transcrição
        setTimeout(() => {
          const mockText = `Segmento ${segmentCounterRef.current} - ${Math.round((endTime - startTime) * 1000)}ms de fala detectada (mock)`
          const finalSegment: TranscriptSegment = {
            start: startTime,
            end: endTime,
            speaker: 'TERAPEUTA',
            text: mockText,
            status: 'final',
            id: segmentId
          }
          
          setSegments(prev => {
            const updated = prev.map(seg => seg.id === segmentId ? finalSegment : seg)
            setTimeout(() => onTranscriptUpdate(updated), 0)
            return updated
          })
        }, 1000 + Math.random() * 2000)
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar áudio:', error)
    }
  }

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
    
    // Detectar fala ou silêncio
    if (rms > SPEECH_THRESHOLD) {
      speechCounterRef.current++
      silenceCounterRef.current = 0
      
      // Iniciar gravação se não estiver falando ainda
      if (!isSpeakingRef.current && speechCounterRef.current > 5) {
        console.log('🎤 VAD: Início da fala detectado (RMS:', rms.toFixed(4), ')')
        isSpeakingRef.current = true
        setIsSpeaking(true)
        startSpeechRecording()
      }
    } else if (rms < SILENCE_THRESHOLD) {
      silenceCounterRef.current++
      speechCounterRef.current = 0
      
      // Parar gravação se estiver falando e houver silêncio suficiente
      if (isSpeakingRef.current && silenceCounterRef.current > 25) {
        console.log('🎤 VAD: Fim da fala detectado (RMS:', rms.toFixed(4), ', silêncio:', silenceCounterRef.current, ')')
        isSpeakingRef.current = false
        setIsSpeaking(false)
        stopSpeechRecording()
      }
    }
  }, [])

  // Função para converter PCM para WAV
  const pcmToWav = (pcmData: Float32Array, sampleRate: number, targetSampleRate: number): ArrayBuffer => {
    // Converter Float32 para Int16
    const samples = new Int16Array(pcmData.length)
    for (let i = 0; i < pcmData.length; i++) {
      samples[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32767))
    }

    // Criar header WAV
    const bytesPerSample = 2
    const channels = 1
    const blockAlign = channels * bytesPerSample
    const byteRate = targetSampleRate * blockAlign
    const dataSize = samples.length * bytesPerSample
    const fileSize = 44 + dataSize - 8

    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    // RIFF header
    writeString(view, 0, 'RIFF')
    view.setUint32(4, fileSize, true)
    writeString(view, 8, 'WAVE')

    // fmt chunk
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, targetSampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true)

    // data chunk
    writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    // dados de áudio
    const dataView = new DataView(buffer, 44)
    for (let i = 0; i < samples.length; i++) {
      dataView.setInt16(i * 2, samples[i], true)
    }

    return buffer
  }

  const writeString = (view: DataView, offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // Iniciar gravação de um segmento de fala
  const startSpeechRecording = useCallback(() => {
    speechStartTimeRef.current = Date.now()
    console.log('🔴 Iniciando gravação do segmento de fala')
  }, [])

  // Parar gravação de um segmento de fala
  const stopSpeechRecording = useCallback(() => {
    const speechEndTime = Date.now()
    const duration = speechEndTime - speechStartTimeRef.current
    
    if (duration < MIN_SPEECH_DURATION) {
      console.log(`⚠️ Segmento muito curto (${duration}ms), ignorando`)
      return
    }

    // Simular dados de áudio para teste
    const mockAudioData = new Float32Array(16000) // 1 segundo de áudio
    for (let i = 0; i < mockAudioData.length; i++) {
      mockAudioData[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 0.1 // Tom de 440Hz
    }

    processAudioSegment(
      mockAudioData,
      speechStartTimeRef.current / 1000,
      speechEndTime / 1000
    )
    
    console.log('⏹️ Parando gravação do segmento de fala')
  }, [processAudioSegment])

  // Iniciar sistema VAD
  const startVAD = useCallback(async () => {
    try {
      console.log('🔴 Iniciando sistema VAD + Whisper...')
      setIsProcessing(true)
      
      // Iniciar sessão do Whisper
      await startWhisperSession()
      
      // Obter stream do microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
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
        text: '[🔴 VAD + Whisper ativo - fale para começar a transcrever]',
        status: 'final',
        id: `whisper-start-${Date.now()}`
      }
      
      setSegments(prev => {
        const updated = [...prev, startSegment]
        setTimeout(() => onTranscriptUpdate(updated), 0)
        return updated
      })
      
      console.log('✅ Sistema VAD + Whisper ativo!')
      
    } catch (error) {
      console.error('❌ Erro ao iniciar VAD + Whisper:', error)
      setIsProcessing(false)
    }
  }, [analyzeAudio, startWhisperSession, onRecordingStateChange, onTranscriptUpdate])

  // Parar sistema VAD
  const stopVAD = useCallback(async () => {
    try {
      console.log('⏹️ Parando sistema VAD + Whisper...')
      setIsProcessing(true)
      
      // Parar análise VAD
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current)
        vadIntervalRef.current = null
      }
      
      // Parar gravação se estiver ativa
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false
        stopSpeechRecording()
      }
      
      // Fechar contexto de áudio
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close()
        audioContextRef.current = null
      }
      
      // Parar stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          if (track.readyState !== 'ended') {
            track.stop()
          }
        })
        mediaStreamRef.current = null
      }
      
      // Parar sessão do Whisper
      await stopWhisperSession()
      
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
        text: `[⏹️ VAD + Whisper parado - ${segmentCounterRef.current} segmentos processados]`,
        status: 'final',
        id: `whisper-end-${Date.now()}`
      }
      
      setSegments(prev => {
        const updated = [...prev, endSegment]
        setTimeout(() => onTranscriptUpdate(updated), 0)
        return updated
      })
      
      console.log(`✅ VAD + Whisper parado. Total: ${segmentCounterRef.current} segmentos`)
      
    } catch (error) {
      console.error('❌ Erro ao parar VAD + Whisper:', error)
      setIsProcessing(false)
    }
  }, [stopSpeechRecording, stopWhisperSession, onRecordingStateChange, onTranscriptUpdate])

  // Cleanup
  useEffect(() => {
    return () => {
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current)
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          if (track.readyState !== 'ended') {
            track.stop()
          }
        })
      }
    }
  }, [])

  // Listener para transcrições do Whisper
  useEffect(() => {
    if (!window.electronAPI?.onWhisperTranscription) return

    const handleTranscription = (event: any, data: any) => {
      console.log('🎤 [WhisperVAD] Received transcription:', data)
      
      if (data.segmentId) {
        const finalSegment: TranscriptSegment = {
          start: data.start,
          end: data.end,
          speaker: data.speaker,
          text: data.text,
          status: 'final',
          id: data.segmentId
        }
        
        setSegments(prev => {
          const updated = prev.map(seg => seg.id === data.segmentId ? finalSegment : seg)
          setTimeout(() => onTranscriptUpdate(updated), 0)
          return updated
        })
      }
    }

    window.electronAPI.onWhisperTranscription(handleTranscription)

    return () => {
      if (window.electronAPI?.removeWhisperListener) {
        window.electronAPI.removeWhisperListener(handleTranscription)
      }
    }
  }, [onTranscriptUpdate])

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={isRecording ? stopVAD : startVAD}
        disabled={isProcessing || whisperStatus === 'error'}
        className={`event-layer w-[32px] h-[32px] rounded-full border text-white/90 flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 ${
          isRecording 
            ? isSpeaking
              ? 'bg-green-500/90 border-green-400 animate-pulse shadow-lg shadow-green-500/50 scale-110' 
              : 'bg-blue-500/90 border-blue-400 shadow-lg shadow-blue-500/30'
            : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30'
        } ${isProcessing || whisperStatus === 'error' ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={isRecording ? 'Parar Whisper VAD' : 'Iniciar Whisper VAD'}
        title={
          isRecording 
            ? isSpeaking 
              ? 'Transcrevendo fala - clique para parar' 
              : 'Aguardando fala - clique para parar'
            : whisperStatus === 'error'
              ? `Erro: ${error}`
              : 'Iniciar transcrição com Whisper'
        }
      >
        {isProcessing ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : isRecording ? (
          <Square size={16} />
        ) : whisperStatus === 'error' ? (
          <AlertCircle size={16} />
        ) : (
          <Mic size={16} />
        )}
      </button>
      
      {/* Status indicator */}
      <div className="flex items-center gap-1">
        {whisperStatus === 'ready' && !error && (
          <span className="text-green-600 text-xs">
            {isRecording ? 'Gravando...' : 
             isProcessing ? 'Processando...' : 
             'Whisper pronto'}
          </span>
        )}
        {whisperStatus === 'error' && error && (
          <span className="text-red-500 text-xs" title={error}>
            <AlertCircle size={12} />
          </span>
        )}
      </div>
    </div>
  )
}
