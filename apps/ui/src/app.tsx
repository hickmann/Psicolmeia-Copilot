import { useEffect } from 'react'
import HudBar from './components/HudBar'
import InsightsPanel from './components/InsightsPanel'
import { useUi } from './lib/store'

export default function App() {
  const { setElapsed, showPanel } = useUi()

  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(() => {
      const secs = (Date.now() - start) / 1000
      setElapsed(secs)
    }, 250) as unknown as number
    return () => clearInterval(id)
  }, [setElapsed])

  return (
    <>
      <HudBar />
      {showPanel && <InsightsPanel />}
    </>
  )
}
