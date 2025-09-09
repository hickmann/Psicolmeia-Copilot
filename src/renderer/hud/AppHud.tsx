import HudBar from '../shared/HudBar'
import { useEffect } from 'react'

export default function AppHud() {
  // Click-through removido - janela sempre clicável
  return (
    <div className="overlay-root flex items-start justify-center rounded-[20px]" style={{ pointerEvents: 'auto' }}>
      <HudBar />
    </div>
  )
}
