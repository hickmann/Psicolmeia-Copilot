import React, { useState, useRef, useCallback } from 'react'
import { Play, Square } from 'lucide-react'
import { TranscriptSegment } from './audio/types'

interface SimpleRecordControllerProps {
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void
}

export function SimpleRecordController({ onTranscriptUpdate }: SimpleRecordControllerProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const intervalRef = useRef<number | null>(null)

  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Iniciando gravação simples...')
      setIsProcessing(true)
      
      // Limpar segmentos anteriores
      segmentsRef.current = []
      onTranscriptUpdate([])
      
      setIsRecording(true)
      setIsProcessing(false)
      
      console.log('✅ Gravação iniciada - começando simulação de transcrições')
      
      // Simular detecção de fala e transcrição a cada 3-5 segundos
      let segmentCount = 0
      intervalRef.current = window.setInterval(() => {
        segmentCount++
        const now = Date.now()
        
        // Criar segmento parcial
        const partialSegment: TranscriptSegment = {
          start: now,
          end: now + 2000,
          speaker: segmentCount % 2 === 1 ? 'TERAPEUTA' : 'PACIENTE',
          text: '(transcrevendo...)',
          status: 'partial'
        }
        
        segmentsRef.current.push(partialSegment)
        onTranscriptUpdate([...segmentsRef.current])
        
        console.log('🎯 Segmento parcial adicionado:', partialSegment)
        
        // Depois de 1.5s, transformar em final
        setTimeout(() => {
          const mockTexts = [
            'Como você está se sentindo hoje?',
            'Estou me sentindo um pouco ansioso.',
            'Pode me contar mais sobre isso?',
            'Tenho dificuldade para dormir ultimamente.',
            'O que você acha que está causando essa ansiedade?',
            'Acho que o trabalho está me estressando muito.',
            'Vamos trabalhar juntos nessa questão.',
            'Preciso de ajuda para organizar meus pensamentos.'
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
            console.log('✅ Segmento finalizado:', segmentsRef.current[lastIndex])
          }
        }, 1500)
        
      }, Math.random() * 2000 + 3000) // 3-5 segundos
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error)
      setIsProcessing(false)
    }
  }, [onTranscriptUpdate])

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Parando gravação...')
      setIsProcessing(true)
      
      // Parar interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      
      setIsRecording(false)
      setIsProcessing(false)
      
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
      className="event-layer w-[32px] h-[32px] rounded-full bg-white/10 border border-white/20 text-white/90 flex items-center justify-center hover:bg-white/15 active:bg-white/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30"
      aria-label={isRecording ? 'Parar' : 'Gravar'}
    >
      {isRecording ? <Square size={16} /> : <Play size={16} />}
    </button>
  )
}

