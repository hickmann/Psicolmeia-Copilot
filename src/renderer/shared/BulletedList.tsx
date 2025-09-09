export default function BulletedList({items}:{items:string[]}) {
  return (
    <ul className="space-y-[6px]">
      {items.map((t,i)=>(
        <li key={i} className="text-[13px] leading-[19px] text-white/90">
          <span className="pr-[8px]">•</span>{t}
        </li>
      ))}
    </ul>
  )
}
