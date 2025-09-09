import InsightsPanel from '../shared/InsightsPanel'
import { useEffect } from 'react'

export default function AppPanel() {
  // Click-through removido - janela sempre clicável
  return (
    <div className="overlay-root rounded-[20px]" style={{ pointerEvents: 'auto' }}>
      <InsightsPanel />
    </div>
  )
}
