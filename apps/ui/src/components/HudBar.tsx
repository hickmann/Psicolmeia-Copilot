import { Eye, Minus, Maximize2, Stars } from 'lucide-react'
import PlayButton from './PlayButton'
import { SegmentPill, VDivider } from './SegmentPill'
import { useUi } from '../lib/store'
import { fmtTime } from '../lib/utils'
import { invoke } from '@tauri-apps/api/core'

export default function HudBar() {
  const { elapsed, togglePanel } = useUi()

  const setIgnore = (ignore: boolean) => {
    invoke('set_ignore_cursor', { payload: { ignore } }).catch(() => {})
  }

  return (
    <div 
      className="overlay-root fixed top-[16px] left-1/2 transform -translate-x-1/2 z-50" 
      onMouseEnter={() => setIgnore(false)} 
      onMouseLeave={() => setIgnore(true)}
    >
      <div
        className="event-layer w-[860px] h-[44px] rounded-2xl border text-white/90 flex items-center justify-center gap-[12px]"
        style={{
          background: 'var(--glass)',
          borderColor: 'var(--border-1)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
          paddingInline: '10px',
        }}
      >
        <a
          href="#"
          onClick={() => window.open('https://psicolmeia.com.br', '_blank')}
          className="event-layer absolute left-[14px] text-white/85 text-[12px] hover:text-white"
          aria-label="Psicolmeia"
        >
          🧠
        </a>

        <PlayButton />

        <div className="text-[13px] font-medium min-w-[44px] text-center">{fmtTime(elapsed)}</div>

        <SegmentPill className="px-[10px] gap-[6px]">
          <Stars size={14} className="mr-[6px]" />
          <span className="text-[12px]">Ask AI</span>
        </SegmentPill>

        <SegmentPill className="px-[8px]">
          <div className="flex items-center px-[4px]">
            <Eye size={14} className="mr-[6px]" />
            <span className="text-[12px] mr-[6px]">Show/Hide</span>
          </div>
          <VDivider />
          <button className="event-layer w-[22px] h-[22px] rounded-md bg-white/10 flex items-center justify-center">
            <Minus size={12}/>
          </button>
          <VDivider />
          <button onClick={togglePanel} className="event-layer w-[22px] h-[22px] rounded-md bg-white/10 flex items-center justify-center" title="Toggle panel">
            <Maximize2 size={12}/>
          </button>
        </SegmentPill>
      </div>
    </div>
  )
}
