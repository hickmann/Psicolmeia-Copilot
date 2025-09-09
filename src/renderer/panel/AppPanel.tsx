import InsightsPanel from '../shared/InsightsPanel'
import { useEffect } from 'react'

export default function AppPanel() {
  useEffect(() => { window.overlay?.setIgnore(true) }, [])
  return (
    <div className="overlay-root"
         onMouseEnter={() => window.overlay?.setIgnore(false)}
         onMouseLeave={() => window.overlay?.setIgnore(true)}>
      <InsightsPanel />
    </div>
  )
}
