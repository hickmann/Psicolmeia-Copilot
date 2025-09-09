import { create } from 'zustand'

type Store = {
  elapsed: number
  _timer?: number
  actions: {
    start(): void; stop(): void; reset(): void
  }
}
export const useElapsedBase = create<Store>((set,get)=>({
  elapsed: 0,
  actions: {
    start() {
      get().actions.stop()
      const start = Date.now()
      const id = window.setInterval(()=>set({ elapsed: (Date.now()-start)/1000 }), 250) as unknown as number
      set({ _timer: id as unknown as number })
    },
    stop() {
      const id = get()._timer
      if(id) { clearInterval(id); set({ _timer: undefined }) }
    },
    reset() { set({ elapsed: 0 }) }
  }
}))
export const useElapsed = Object.assign(
  () => useElapsedBase(s=>s.elapsed),
  { actions: () => useElapsedBase(s=>s.actions) }
)
