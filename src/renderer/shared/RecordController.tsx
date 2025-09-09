import React, { useState, useRef, useCallback } from 'react'
import { Play, Square, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { useMicSegments } from './audio/useMicSegments'
import { useSystemSegments } from './audio/useSystemSegments'
import { captureMicAudio, captureSystemAudio, createMixedStream, ContinuousRecorder } from './audio/audioCapture'
import { createWebSpeechSttProvider } from './stt/webSpeechProvider'
import { UnknownDetector } from './audio/unknownDetector'
import { AudioSegment, TranscriptSegment, AudioStreams, RecordingState } from './audio/types'

interface RecordControllerProps {
  onRecordingStateChange: (state: RecordingState) => void
  onTranscriptUpdate: (transcript: TranscriptSegment[]) => void
}

export function RecordController({ onRecordingStateChange, onTranscriptUpdate }: RecordControllerProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isProcessing: false,
    systemAudioAvailable: false,
    systemAudioError: undefined
  })
  
  const streamsRef = useRef<AudioStreams>({ mic: null, system: null, mixed: null })
  const recorderRef = useRef<ContinuousRecorder | null>(null)
  const sttProviderRef = useRef(createWebSpeechSttProvider())
  const unknownDetectorRef = useRef(new UnknownDetector())
  
  // Hooks de VAD
  const micVad = useMicSegments({
    onSegmentDetected: handleSegmentDetected,
    enabled: recordingState.isRecording
  })
  
  const systemVad = useSystemSegments({
    stream: streamsRef.current.system,
    onSegmentDetected: handleSegmentDetected,
    enabled: recordingState.isRecording
  })

  function handleSegmentDetected(segment: AudioSegment) {
    console.log('🎯 Segmento detectado:', segment)
    console.log('🎯 Duração do segmento:', segment.end - segment.start, 'ms')
    console.log('🎯 Fonte:', segment.source, 'Falante inicial:', segment.speaker)
    
    // Usar detector de falantes desconhecidos
    const finalSpeaker = unknownDetectorRef.current.getSpeakerAt(segment.start)
    segment.speaker = finalSpeaker
    
    console.log('🎯 Falante final:', finalSpeaker)
    
    // Enviar para STT
    console.log('🎯 Enviando para STT...')
    sttProviderRef.current.pushChunk({
      audioData: segment.audioData || new ArrayBuffer(0),
      start: segment.start,
      end: segment.end,
      speaker: segment.speaker
    }).then(() => {
      console.log('✅ Segmento enviado para STT com sucesso')
    }).catch((error) => {
      console.error('❌ Erro ao enviar para STT:', error)
    })
  }

  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando gravação...')
      
      setRecordingState(prev => ({ ...prev, isProcessing: true }))
      
      // Capturar áudio do microfone
      const micStream = await captureMicAudio()
      if (!micStream) {
        throw new Error('Não foi possível capturar áudio do microfone')
      }
      
      // Tentar capturar áudio do sistema
      let systemStream: MediaStream | null = null
      let systemAudioAvailable = false
      let systemAudioError: string | undefined
      
      try {
        systemStream = await captureSystemAudio()
        systemAudioAvailable = !!systemStream
      } catch (error) {
        console.warn('⚠️ Áudio do sistema indisponível:', error)
        systemAudioError = error instanceof Error ? error.message : 'Erro desconhecido'
      }
      
      // Criar streams
      const streams: AudioStreams = {
        mic: micStream,
        system: systemStream,
        mixed: null
      }
      
      // Criar stream misturado
      streams.mixed = createMixedStream(streams)
      streamsRef.current = streams
      
      // Iniciar gravador contínuo
      recorderRef.current = new ContinuousRecorder()
      recorderRef.current.start(streams)
      
      // Iniciar STT provider
      console.log('🎤 Iniciando STT provider...')
      await sttProviderRef.current.start()
      
      // Limpar detector de falantes desconhecidos
      unknownDetectorRef.current.clear()
      
      // Atualizar estado
      const newState: RecordingState = {
        isRecording: true,
        isProcessing: false,
        systemAudioAvailable,
        systemAudioError
      }
      
      setRecordingState(newState)
      onRecordingStateChange(newState)
      
      console.log('✅ Gravação iniciada com sucesso')
      console.log('🎤 VAD do MIC status:', micVad.isListening, 'Falando:', micVad.isSpeechDetected)
      console.log('🔊 VAD do SYSTEM status:', systemVad.isListening, 'Falando:', systemVad.isSpeechDetected)
      
      if (!systemAudioAvailable) {
        console.log('⚠️ Áudio do sistema indisponível — gravando apenas microfone')
      }
      
      // Aguardar um pouco para o VAD se inicializar
      setTimeout(() => {
        console.log('🔍 Status VAD após 2s:')
        console.log('🎤 MIC VAD:', micVad.isListening, 'Erro:', micVad.error)
        console.log('🔊 SYSTEM VAD:', systemVad.isListening, 'Erro:', systemVad.error)
      }, 2000)
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error)
      setRecordingState(prev => ({ 
        ...prev, 
        isProcessing: false,
        systemAudioError: error instanceof Error ? error.message : 'Erro desconhecido'
      }))
    }
  }, [onRecordingStateChange])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando gravação...')
      
      setRecordingState(prev => ({ ...prev, isProcessing: true }))
      
      // Parar gravador
      const recordings = await recorderRef.current?.stop()
      
      // Obter transcript final
      const finalTranscript = await sttProviderRef.current.stopAndGetTranscript()
      onTranscriptUpdate(finalTranscript)
      
      // Salvar gravações
      if (recordings) {
        await saveRecordings(recordings, finalTranscript)
      }
      
      // Limpar streams
      streamsRef.current.mic?.getTracks().forEach(track => track.stop())
      streamsRef.current.system?.getTracks().forEach(track => track.stop())
      streamsRef.current = { mic: null, system: null, mixed: null }
      
      // Atualizar estado
      const newState: RecordingState = {
        isRecording: false,
        isProcessing: false,
        systemAudioAvailable: false,
        systemAudioError: undefined
      }
      
      setRecordingState(newState)
      onRecordingStateChange(newState)
      
      console.log('✅ Gravação finalizada com sucesso')
      
    } catch (error) {
      console.error('❌ Erro ao parar gravação:', error)
      setRecordingState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [onRecordingStateChange, onTranscriptUpdate])

  const saveRecordings = async (recordings: { mic: Blob | null; system: Blob | null; mixed: Blob | null }, transcript: TranscriptSegment[]) => {
    try {
      console.log('💾 Salvando gravações...')
      
      const timestamp = Date.now()
      
      // Converter transcript para formato esperado pelo IPC
      const transcriptData = transcript.map(segment => ({
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker,
        text: segment.text
      }))
      
      // Salvar via IPC
      const result = await window.overlay.saveRecording({
        transcript: transcriptData,
        timestamp
      })
      
      if (result.success) {
        console.log('✅ Gravações salvas em:', result.path)
      } else {
        console.error('❌ Erro ao salvar gravações:', result.error)
      }
      
    } catch (error) {
      console.error('❌ Erro ao salvar gravações:', error)
    }
  }

  return (
    <button
      onClick={recordingState.isRecording ? stopRecording : startRecording}
      disabled={recordingState.isProcessing}
      className="event-layer w-[32px] h-[32px] rounded-full bg-white/10 border border-white/20 text-white/90 flex items-center justify-center hover:bg-white/15 active:bg-white/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30"
      aria-label={recordingState.isRecording ? 'Parar' : 'Gravar'}
    >
      {recordingState.isRecording ? <Square size={16} /> : <Play size={16} />}
    </button>
  )
}
