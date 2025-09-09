import Hud from './hud/AppHud'
import Panel from './panel/AppPanel'

export default function App() {
  const kind = window.overlay?.which?.() ?? (location.hash === '#panel' ? 'panel' : 'hud')
  return kind === 'panel' ? <Panel /> : <Hud />
}