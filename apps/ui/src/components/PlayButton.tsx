import { Play, Pause } from 'lucide-react'
import { useUi } from '../lib/store'

export default function PlayButton() {
  const { recording, setRecording } = useUi()
  return (
    <button
      aria-label={recording ? 'Pausar' : 'Gravar'}
      className="event-layer w-[28px] h-[28px] rounded-full border border-white/20 bg-white/10 text-white/90 flex items-center justify-center hover:bg-white/15 active:bg-white/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30"
      onClick={() => setRecording(!recording)}
    >
      {recording ? <Pause size={14}/> : <Play size={14}/> }
    </button>
  )
}
