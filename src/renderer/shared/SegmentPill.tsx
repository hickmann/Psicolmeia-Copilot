import { ReactNode } from 'react'
export function SegmentPill({children,className=''}:{children:ReactNode; className?:string}){
  return <div className={`event-layer h-[28px] rounded-[14px] border border-white/20 bg-white/10 text-white/85 flex items-center ${className}`}>{children}</div>
}
export const VDivider = ()=> <div className="h-[16px] w-px bg-white/18 mx-[6px]" />
