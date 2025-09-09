export {}

declare global {
  interface Window {
    overlay: {
      setIgnore(ignore: boolean): Promise<void>
      openExternal(url: string): Promise<void>
      which(): string
    }
  }
}