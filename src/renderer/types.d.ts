export {}

declare global {
  interface Window {
    overlay: {
      setIgnore(ignore: boolean): Promise<void>
      openExternal(url: string): Promise<void>
      which(): string
      closeApp(): Promise<void>
      forceInteractive(): Promise<void>
    }
  }
}