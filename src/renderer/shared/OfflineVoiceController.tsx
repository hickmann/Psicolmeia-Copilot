import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Square, Mic } from 'lucide-react'
import { TranscriptSegment } from './audio/types'

interface OfflineVoiceControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
}

export function OfflineVoiceController({ onTranscriptUpdate }: OfflineVoiceControllerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const speechTimeoutRef = useRef<number | null>(null)
  const isSpeakingRef = useRef(false)
  const speechStartTimeRef = useRef<number | null>(null)

  // Configurações de detecção de voz
  const SILENCE_THRESHOLD = 30 // Limiar de energia para detectar silêncio
  const SPEECH_TIMEOUT = 2000 // ms de silêncio para considerar fim de fala
  const MIN_SPEECH_DURATION = 500 // ms mínimos de fala

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calcular energia média
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i]
    }
    const average = sum / bufferLength
    setAudioLevel(average)

    const isSpeaking = average > SILENCE_THRESHOLD
    const now = Date.now()

    if (isSpeaking && !isSpeakingRef.current) {
      // Início de fala detectado
      console.log('🎤 Início de fala detectado! Energia:', average)
      isSpeakingRef.current = true
      speechStartTimeRef.current = now
      setIsListening(true)
      
      // Limpar timeout de silêncio
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current)
        speechTimeoutRef.current = null
      }
      
    } else if (!isSpeaking && isSpeakingRef.current) {
      // Possível fim de fala - aguardar timeout
      if (!speechTimeoutRef.current) {
        speechTimeoutRef.current = window.setTimeout(() => {
          const speechDuration = now - (speechStartTimeRef.current || now)
          
          if (speechDuration >= MIN_SPEECH_DURATION) {
            console.log('🎤 Fim de fala detectado! Duração:', speechDuration, 'ms')
            
            // Criar segmento de transcrição
            const segment: TranscriptSegment = {
              start: speechStartTimeRef.current || now,
              end: now,
              speaker: 'TERAPEUTA',
              text: '(transcrevendo...)',
              status: 'partial'
            }
            
            segmentsRef.current.push(segment)
            onTranscriptUpdate([...segmentsRef.current])
            
            // Simular transcrição após um delay
            setTimeout(() => {
              const mockTexts = [
                'Como você está se sentindo hoje?',
                'Pode me contar mais sobre essa situação?',
                'O que você acha que está causando isso?',
                'Vamos trabalhar juntos para encontrar uma solução.',
                'Que estratégias você já tentou usar?',
                'Como isso te faz sentir?',
                'Você já passou por algo parecido antes?',
                'O que você gostaria de mudar nessa situação?',
                'Como posso te ajudar melhor?',
                'Vamos explorar essa questão mais profundamente.',
                'Estou me sentindo um pouco ansioso.',
                'Tenho dificuldade para dormir ultimamente.',
                'O trabalho está me estressando muito.',
                'Não sei bem como lidar com essa questão.',
                'Preciso de ajuda para organizar meus pensamentos.',
                'Às vezes me sinto sobrecarregado.',
                'Tenho medo de não conseguir resolver isso.',
                'Sinto que estou perdendo o controle.',
                'Preciso aprender a lidar melhor com a pressão.',
                'Quero me sentir mais confiante.'
              ]
              
              const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)]
              
              // Atualizar o último segmento
              const lastIndex = segmentsRef.current.length - 1
              if (lastIndex >= 0) {
                segmentsRef.current[lastIndex] = {
                  ...segmentsRef.current[lastIndex],
                  text: randomText,
                  status: 'final'
                }
                
                onTranscriptUpdate([...segmentsRef.current])
                console.log('✅ Transcrição finalizada:', randomText)
              }
            }, Math.random() * 1000 + 1000) // 1-2 segundos de delay
          }
          
          isSpeakingRef.current = false
          speechStartTimeRef.current = null
          speechTimeoutRef.current = null
          setIsListening(false)
        }, SPEECH_TIMEOUT)
      }
    }

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio)
    }
  }, [isRecording, onTranscriptUpdate])

  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando gravação com detecção offline...')
      setIsProcessing(true)
      
      // Solicitar permissão de microfone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // Manter ruído para melhor detecção
          autoGainControl: true
        }
      })
      
      mediaStreamRef.current = stream
      console.log('✅ Permissão de microfone concedida')
      
      // Configurar análise de áudio
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.8
      
      source.connect(analyserRef.current)
      
      // Limpar segmentos anteriores
      segmentsRef.current = []
      onTranscriptUpdate([])
      
      setIsRecording(true)
      setIsProcessing(false)
      
      // Iniciar análise
      analyzeAudio()
      
      console.log('🎤 Sistema de detecção offline iniciado - fale no microfone!')
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error)
      setIsProcessing(false)
      
      // Mostrar erro na interface
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
  }, [analyzeAudio, onTranscriptUpdate])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando gravação...')
      setIsProcessing(true)
      
      // Parar análise
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      
      // Limpar timeouts
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current)
        speechTimeoutRef.current = null
      }
      
      // Parar stream de áudio
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
      }
      
      // Fechar contexto de áudio
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      
      // Reset estados
      isSpeakingRef.current = false
      speechStartTimeRef.current = null
      
      setIsRecording(false)
      setIsProcessing(false)
      setIsListening(false)
      setAudioLevel(0)
      
      console.log('✅ Gravação finalizada. Total de segmentos:', segmentsRef.current.length)
      
    } catch (error) {
      console.error('❌ Erro ao parar gravação:', error)
      setIsProcessing(false)
    }
  }, [])

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`event-layer w-[32px] h-[32px] rounded-full border text-white/90 flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all ${
        isRecording 
          ? isListening 
            ? 'bg-green-500/80 border-green-400 animate-pulse shadow-lg shadow-green-500/30' 
            : audioLevel > 10
              ? 'bg-blue-500/80 border-blue-400 animate-pulse'
              : 'bg-red-500/80 border-red-400'
          : 'bg-white/10 border-white/20 hover:bg-white/15'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
      title={
        isRecording 
          ? isListening 
            ? 'Detectando fala...' 
            : audioLevel > 10
              ? 'Ouvindo áudio...'
              : 'Aguardando fala...'
          : 'Iniciar gravação'
      }
    >
      {isRecording ? <Square size={16} /> : <Play size={16} />}
    </button>
  )
}

