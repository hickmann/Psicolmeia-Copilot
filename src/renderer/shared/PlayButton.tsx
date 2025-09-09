import { Play, Pause } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useElapsed } from './useElapsed'

export default function PlayButton(){
  const [rec, setRec] = useState(false)
  const { reset, start, stop } = useElapsed.actions()
  const t = useRef<number|undefined>()

  useEffect(()=>{
    if(rec){ start() } else { stop(); reset() }
    return ()=>{ stop() }
  },[rec, start, stop, reset])

  return (
    <button
      className="event-layer w-[32px] h-[32px] rounded-full border border-white/20 bg-white/10 text-white/90 flex items-center justify-center hover:bg-white/15 active:bg-white/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30"
      onClick={()=>setRec(v=>!v)}
      aria-label={rec?'Pausar':'Gravar'}
    >
      {rec ? <Pause size={16}/> : <Play size={16}/>}
    </button>
  )
}
