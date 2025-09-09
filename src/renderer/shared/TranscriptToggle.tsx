import React from 'react'
import { CaseSensitive } from 'lucide-react'

interface TranscriptToggleProps {
  isActive: boolean
  onToggle: () => void
}

export function TranscriptToggle({ isActive, onToggle }: TranscriptToggleProps) {
  return (
    <button 
      className={`event-layer flex items-center text-[12px] transition-colors ${
        isActive 
          ? 'text-blue-300 hover:text-blue-200' 
          : 'text-white/80 hover:text-white'
      }`}
      onClick={onToggle}
    >
      <CaseSensitive size={12} className="mr-[6px]" />
      Mostrar transcrição
    </button>
  )
}
