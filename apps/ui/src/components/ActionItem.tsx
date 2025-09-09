export default function ActionItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="h-[28px] flex items-center px-[6px] rounded-md hover:bg-white/5 transition">
      <div className="w-[14px] h-[14px] rounded-[3px] mr-[8px]" style={{ backgroundColor: color }} />
      <span className="text-[13px] text-white/92">{label}</span>
    </div>
  )
}
