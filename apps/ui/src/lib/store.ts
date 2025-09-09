import { create } from 'zustand'

type UiState = {
  recording: boolean
  elapsed: number
  showPanel: boolean
  setRecording: (v: boolean) => void
  setElapsed: (s: number) => void
  togglePanel: () => void
}

export const useUi = create<UiState>((set) => ({
  recording: false,
  elapsed: 0,
  showPanel: true,
  setRecording: (v) => set({ recording: v }),
  setElapsed: (s) => set({ elapsed: s }),
  togglePanel: () => set((s) => ({ showPanel: !s.showPanel })),
}))
