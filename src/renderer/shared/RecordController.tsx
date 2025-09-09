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
    
    // Usar detector de falantes desconhecidos
    const finalSpeaker = unknownDetectorRef.current.getSpeakerAt(segment.start)
    segment.speaker = finalSpeaker
    
    // Enviar para STT
    sttProviderRef.current.pushChunk({
      audioData: segment.audioData || new ArrayBuffer(0),
      start: segment.start,
      end: segment.end,
      speaker: segment.speaker
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
      if (!systemAudioAvailable) {
        console.log('⚠️ Áudio do sistema indisponível — gravando apenas microfone')
      }
      
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
    <div className="flex flex-col gap-4">
      {/* Controles de gravação */}
      <div className="flex items-center gap-3">
        <button
          onClick={recordingState.isRecording ? stopRecording : startRecording}
          disabled={recordingState.isProcessing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            recordingState.isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          } ${recordingState.isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {recordingState.isRecording ? (
            <>
              <Square className="w-4 h-4" />
              Parar
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Gravar
            </>
          )}
        </button>
      </div>
      
      {/* Status de áudio */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          {micVad.isListening ? (
            <Mic className="w-4 h-4 text-green-500" />
          ) : (
            <MicOff className="w-4 h-4 text-gray-400" />
          )}
          <span>MIC</span>
        </div>
        
        <div className="flex items-center gap-2">
          {recordingState.systemAudioAvailable ? (
            <Volume2 className="w-4 h-4 text-green-500" />
          ) : (
            <VolumeX className="w-4 h-4 text-gray-400" />
          )}
          <span>SYSTEM</span>
        </div>
        
        {recordingState.systemAudioError && (
          <span className="text-orange-600 text-xs">
            {recordingState.systemAudioError}
          </span>
        )}
      </div>
    </div>
  )
}
