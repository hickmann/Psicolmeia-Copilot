import HudBar from '../shared/HudBar'
import { useEffect } from 'react'

export default function AppHud() {
  // Ativa click-through global; desativa ao passar o mouse na barra
  useEffect(() => { window.overlay?.setIgnore(true) }, [])
  return (
    <div className="overlay-root flex items-start justify-center"
         onMouseEnter={() => window.overlay?.setIgnore(false)}
         onMouseLeave={() => window.overlay?.setIgnore(true)}>
      <HudBar />
    </div>
  )
}
