import Hud from './hud/AppHud'
import Panel from './panel/AppPanel'

export default function App() {
  return (
    <div className="flex flex-col items-center p-0 m-0 w-full h-full" style={{ background: 'transparent' }}>
      {/* Quadrado 1 - HUD no topo */}
      <div className="flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
        <Hud />
      </div>
      
      {/* Espaço transparente de 20px */}
      <div style={{ height: '20px', width: '100%', background: 'transparent' }}></div>
      
      {/* Quadrado 2 - Panel embaixo */}
      <div className="flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
        <Panel />
      </div>
    </div>
  )
}