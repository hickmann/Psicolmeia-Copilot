import { Play, Pause, Stars, BarChart3, Volume2, X } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { fmt } from '../lib/utils'
import { useElapsed } from './useElapsed'

export default function HudBar() {
  const elapsed = useElapsed()
  const [isRecording, setIsRecording] = useState(false)
  const { reset, start, stop } = useElapsed.actions
  const timerRef = useRef<number | undefined>(undefined)

  // Janela sempre clicável - click-through removido
  useEffect(() => {
    // Garantir que a janela é sempre interativa
    window.overlay?.setIgnore(false)
  }, [])

  useEffect(() => {
    if (isRecording) { 
      start() 
    } else { 
      stop()
      reset() 
    }
    return () => { stop() }
  }, [isRecording, start, stop, reset])

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background: 'transparent',
        pointerEvents: 'auto'
      }}
    >
        {/* Container principal - cápsula única - PIXEL PERFECT - CSS FIXED */}
      <div
        className="relative event-layer w-[520px] h-[48px] flex items-center gap-[18px] justify-center px-[16px] py-[8px] rounded-[20px]"
        style={{
          background: 'rgba(12,12,14,0.6)',
          border: '1px solid rgba(255,255,255,0.25)',
          backdropFilter: 'blur(50px) saturate(250%)',
          WebkitBackdropFilter: 'blur(50px) saturate(250%)',
          boxShadow: 'none'
        }}
      >
        {/* Borda interna sutil (stroke duplo) - PIXEL PERFECT */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[1px] rounded-[20px]"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        />

        {/* 1. Botão Play/Pause circular - PIXEL PERFECT - CACHE CLEARED */}
        <button
          className="event-layer w-[32px] h-[32px] rounded-full bg-white/10 border border-white/20 text-white/90 flex items-center justify-center hover:bg-white/15 active:bg-white/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsRecording(v => !v)
          }}
          aria-label={isRecording ? 'Pausar' : 'Gravar'}
        >
          {isRecording ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* 2. Ícone de Ondas Sonoras */}
        <div className="w-[32px] h-[32px] flex items-center justify-center">
          <Volume2 size={20} className="text-white/90" />
        </div>

        {/* 3. Timer - PIXEL PERFECT */}
        <div className="w-[56px] h-[32px] flex items-center justify-center text-[14px] font-medium text-white/90">
          {fmt(elapsed)}
        </div>

        {/* 4. Botão "Ask AI" - PIXEL PERFECT */}
        <button
          className="event-layer h-[32px] rounded-[16px] bg-white/10 border border-white/18 text-white/90 flex items-center gap-[8px] px-[12px] hover:bg-white/14 active:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white/30"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // TODO: Implementar funcionalidade Ask AI
          }}
        >
          <Stars size={16} />
          <span className="text-[13px]">Ask AI</span>
        </button>

        {/* 5. Botão "Dashboard" - PIXEL PERFECT */}
        <button
          className="event-layer h-[32px] rounded-[16px] bg-white/10 border border-white/18 text-white/90 flex items-center gap-[8px] px-[12px] hover:bg-white/14 active:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white/30"
          onClick={(e) => {
            console.log('CLICK Dashboard - INICIANDO')
            e.preventDefault()
            e.stopPropagation()
            try {
              console.log('Tentando abrir URL...')
              window.overlay?.openExternal('http://copilot.psicolmeia.com.br/dashboard')
              console.log('URL enviada com sucesso')
            } catch (error) {
              console.error('Erro ao abrir URL:', error)
            }
          }}
          aria-label="Dashboard"
        >
          <BarChart3 size={16} />
          <span className="text-[13px]">Dashboard</span>
        </button>

        {/* 6. Botão Fechar - Vermelho com X */}
        <button
          className="event-layer w-[32px] h-[32px] text-white flex items-center justify-center active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-300"
          style={{
            backgroundColor: '#ef4444',
            border: '1px solid #dc2626',
            borderRadius: '12px',
            boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.3)',
            pointerEvents: 'auto',
            zIndex: 9999,
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            // Hover effect
            e.currentTarget.style.backgroundColor = '#dc2626'
          }}
          onMouseLeave={(e) => {
            // Reset hover effect
            e.currentTarget.style.backgroundColor = '#ef4444'
          }}
          onClick={async (e) => {
            console.log('CLICK Close button - FECHANDO APP')
            e.preventDefault()
            e.stopPropagation()
            
            try {
              console.log('Verificando se window.overlay existe:', !!window.overlay)
              console.log('Verificando se closeApp existe:', !!window.overlay?.closeApp)
              
              if (window.overlay?.closeApp) {
                console.log('Chamando window.overlay.closeApp()...')
                await window.overlay.closeApp()
                console.log('closeApp() executado com sucesso')
              } else {
                console.error('window.overlay.closeApp não está disponível')
                // Fallback: tentar fechar via window.close()
                console.log('Tentando window.close() como fallback...')
                window.close()
              }
            } catch (error) {
              console.error('Erro ao fechar app:', error)
              // Fallback: tentar fechar via window.close()
              console.log('Tentando window.close() como fallback...')
              window.close()
            }
          }}
          aria-label="Fechar aplicativo"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
