import { useState, useEffect } from 'react'
import Hud from './hud/AppHud'
import Panel from './panel/AppPanel'
import { TranscriptSegment, RecordingState } from './shared/audio/types'

export default function App() {
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([])
  const [isRecording, setIsRecording] = useState(false)

  const handleRecordingStateChange = (state: RecordingState) => {
    setIsRecording(state.isRecording)
  }

  const handleTranscriptUpdate = (newTranscript: TranscriptSegment[]) => {
    setTranscript(newTranscript)
  }

  // Escutar atualizações de transcript em tempo real
  useEffect(() => {
    const handleTranscriptUpdate = (event: CustomEvent) => {
      const updatedSegment = event.detail as TranscriptSegment
      
      setTranscript(prev => {
        const updated = [...prev]
        const index = updated.findIndex(seg => 
          seg.start === updatedSegment.start && seg.end === updatedSegment.end
        )
        
        if (index >= 0) {
          updated[index] = updatedSegment
        } else {
          updated.push(updatedSegment)
        }
        
        return updated.sort((a, b) => a.start - b.start)
      })
    }
    
    window.addEventListener('transcript-update', handleTranscriptUpdate as EventListener)
    
    return () => {
      window.removeEventListener('transcript-update', handleTranscriptUpdate as EventListener)
    }
  }, [])

  return (
    <div className="flex flex-col items-center p-0 m-0 w-full h-full" style={{ background: 'transparent' }}>
      {/* Quadrado 1 - HUD no topo */}
      <div className="flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
        <Hud 
          onRecordingStateChange={handleRecordingStateChange}
          onTranscriptUpdate={handleTranscriptUpdate}
        />
      </div>
      
      {/* Espaço transparente de 20px */}
      <div style={{ height: '20px', width: '100%', background: 'transparent' }}></div>
      
      {/* Quadrado 2 - Panel embaixo */}
      <div className="flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
        <Panel transcript={transcript} isRecording={isRecording} />
      </div>
    </div>
  )
}