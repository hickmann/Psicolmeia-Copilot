import Hud from './hud/AppHud'
import Panel from './panel/AppPanel'

export default function App() {
  return (
    <div className="flex flex-col items-center p-0 m-0 w-full h-full">
      {/* Quadrado 1 - HUD no topo */}
      <div className="flex items-center justify-center rounded-[20px] mb-5" style={{ pointerEvents: 'auto' }}>
        <Hud />
      </div>
      
      {/* Espaço transparente de 20px */}
      <div className="w-full h-5"></div>
      
      {/* Quadrado 2 - Panel embaixo */}
      <div className="flex items-center justify-center rounded-[20px]" style={{ pointerEvents: 'auto' }}>
        <Panel />
      </div>
    </div>
  )
}