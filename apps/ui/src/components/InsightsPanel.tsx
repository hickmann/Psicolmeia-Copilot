import BulletedList from './BulletedList'
import ActionItem from './ActionItem'
import { CaseSensitive, Plus } from 'lucide-react'

export default function InsightsPanel() {
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 top-[72px] z-[9999] w-[520px] rounded-2xl border border-[rgba(255,255,255,0.18)]"
      style={{
        background: 'var(--glass-2)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
        padding: '14px',
      }}
    >
      <div className="flex items-center justify-between h-[32px]">
        <div className="flex items-center text-white/90">
          <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center mr-[8px]" style={{ backgroundColor: 'rgba(45,212,191,0.6)' }}>
            <Plus size={12}/>
          </div>
          <span className="text-[13px] font-semibold">Live insights</span>
        </div>
        <button className="event-layer flex items-center text-[12px] text-white/80 hover:text-white">
          <CaseSensitive size={12} className="mr-[6px]" />
          Show transcript
        </button>
      </div>

      <div className="h-px bg-white/10 my-[10px]" />

      <div className="text-white/85 text-[12.5px] font-medium mb-[6px]">Recent date</div>
      <BulletedList items={[
        'You asked Neel about his recent date',
        'Neel says he went to Japantown for dinner',
        'Date was good, but he talked too much about prompt engineering',
      ]} />

      <div className="text-white/85 text-[12.5px] font-medium mt-[12px] mb-[6px]">Actions</div>
      <div className="space-y-[6px]">
        <ActionItem color="#3b82f6" label="Tell me about Japantown" />
        <ActionItem color="#facc15" label="Define prompt engineering" />
        <ActionItem color="#fb923c" label="Suggest follow-up questions" />
        <ActionItem color="#22c55e" label="Give me helpful information" />
      </div>
    </div>
  )
}
