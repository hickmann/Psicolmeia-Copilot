import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export interface WhisperConfig {
  binaryPath: string
  modelPath: string
  threads: number
  language: string
  format: string
}

export interface WhisperResult {
  success: boolean
  text?: string
  segments?: Array<{
    start: number
    end: number
    text: string
  }>
  error?: string
}

export class WhisperProvider {
  private config: WhisperConfig
  private currentProcess: ChildProcess | null = null
  private isProcessing = false

  constructor(config: Partial<WhisperConfig> = {}) {
    this.config = {
      binaryPath: config.binaryPath || this.getDefaultBinaryPath(),
      modelPath: config.modelPath || this.getDefaultModelPath(),
      threads: config.threads || os.cpus().length,
      language: config.language || 'auto',
      format: config.format || 'wav',
      ...config
    }
  }

  private getDefaultBinaryPath(): string {
    const platform = process.platform
    const binaryName = platform === 'win32' ? 'whisper.exe' : 'whisper'
    return path.join(process.cwd(), 'bin', binaryName)
  }

  private getDefaultModelPath(): string {
    return path.join(process.cwd(), 'models', 'whisper', 'small.en-q5_1.gguf')
  }

  async checkAvailability(): Promise<{ success: boolean; binaryExists: boolean; modelExists: boolean; errors?: string[] }> {
    const errors: string[] = []

    try {
      await fs.access(this.config.binaryPath)
      console.log('✅ Whisper binary found:', this.config.binaryPath)
    } catch {
      errors.push(`Binary not found: ${this.config.binaryPath}`)
    }

    try {
      await fs.access(this.config.modelPath)
      console.log('✅ Whisper model found:', this.config.modelPath)
    } catch {
      errors.push(`Model not found: ${this.config.modelPath}`)
    }

    return {
      success: errors.length === 0,
      binaryExists: errors.length === 0 || !errors.some(e => e.includes('Binary')),
      modelExists: errors.length === 0 || !errors.some(e => e.includes('Model')),
      errors: errors.length > 0 ? errors : undefined
    }
  }

  async startSession(): Promise<{ success: boolean; error?: string }> {
    if (this.isProcessing) {
      return { success: false, error: 'Whisper is already processing' }
    }

    try {
      console.log('🎤 Starting Whisper session...')
      this.isProcessing = true
      return { success: true }
    } catch (error) {
      this.isProcessing = false
      return { success: false, error: `Failed to start session: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  async stopSession(): Promise<{ success: boolean; segments?: any[]; error?: string }> {
    try {
      console.log('⏹️ Stopping Whisper session...')
      this.isProcessing = false
      
      if (this.currentProcess) {
        this.currentProcess.kill('SIGTERM')
        this.currentProcess = null
      }

      return { success: true, segments: [] }
    } catch (error) {
      console.error('❌ Error stopping session:', error)
      return { success: false, error: `Failed to stop session: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  async transcribeAudio(wavBuffer: ArrayBuffer, segmentId: string, startTime: number, endTime: number, speaker: string): Promise<WhisperResult> {
    if (!this.isProcessing) {
      return { success: false, error: 'Whisper session not started' }
    }

    try {
      // Criar arquivo temporário
      const tempDir = os.tmpdir()
      const tempFile = path.join(tempDir, `whisper-${segmentId}-${Date.now()}.wav`)
      
      await fs.writeFile(tempFile, Buffer.from(wavBuffer))

      console.log(`🎯 Transcribing segment ${segmentId} (${wavBuffer.byteLength} bytes)`)

      // Executar whisper.cpp
      const result = await this.runWhisper(tempFile, segmentId, startTime, endTime, speaker)

      // Limpar arquivo temporário
      try {
        await fs.unlink(tempFile)
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError)
      }

      return result
    } catch (error) {
      console.error('❌ Transcription error:', error)
      return { success: false, error: `Transcription failed: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  private async runWhisper(audioFile: string, segmentId: string, startTime: number, endTime: number, speaker: string): Promise<WhisperResult> {
    return new Promise((resolve) => {
      const args = [
        '-m', this.config.modelPath,
        '-f', audioFile,
        '-l', this.config.language,
        '--threads', this.config.threads.toString(),
        '--output-format', 'json',
        '--print-progress', 'false',
        '--no-timestamps'
      ]

      console.log(`🚀 Running whisper: ${this.config.binaryPath} ${args.join(' ')}`)

      const process = spawn(this.config.binaryPath, args)
      this.currentProcess = process

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        this.currentProcess = null

        if (code === 0) {
          try {
            // Parse whisper output
            const lines = stdout.trim().split('\n')
            const text = lines.filter(line => line.trim() && !line.startsWith('[')).join(' ').trim()
            
            if (text) {
              console.log(`✅ Whisper result for ${segmentId}:`, text)
              
              // Simular evento de transcrição
              const result = {
                segmentId,
                text,
                start: startTime,
                end: endTime,
                speaker,
                type: 'final',
                confidence: 0.95
              }

              // Emitir evento para o renderer
              setTimeout(() => {
                const mainWindow = require('electron').BrowserWindow.getAllWindows()[0]
                if (mainWindow) {
                  mainWindow.webContents.send('whisper:transcription', result)
                }
              }, 100)

              resolve({ success: true, text, segments: [{ start: startTime, end: endTime, text }] })
            } else {
              resolve({ success: false, error: 'No transcription result' })
            }
          } catch (parseError) {
            console.error('❌ Parse error:', parseError)
            resolve({ success: false, error: `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}` })
          }
        } else {
          console.error('❌ Whisper process failed:', stderr)
          resolve({ success: false, error: `Process failed with code ${code}: ${stderr}` })
        }
      })

      process.on('error', (error) => {
        this.currentProcess = null
        console.error('❌ Whisper process error:', error)
        resolve({ success: false, error: `Process error: ${error.message}` })
      })

      // Timeout após 30 segundos
      setTimeout(() => {
        if (process && !process.killed) {
          process.kill('SIGTERM')
          resolve({ success: false, error: 'Transcription timeout' })
        }
      }, 30000)
    })
  }
}

// Singleton instance
let whisperProvider: WhisperProvider | null = null

export function getWhisperProvider(): WhisperProvider {
  if (!whisperProvider) {
    whisperProvider = new WhisperProvider()
  }
  return whisperProvider
}

// IPC Handlers
export function setupWhisperIPC() {
  const provider = getWhisperProvider()

  ipcMain.handle('stt:whisper:check', async () => {
    return await provider.checkAvailability()
  })

  ipcMain.handle('stt:whisper:start', async () => {
    return await provider.startSession()
  })

  ipcMain.handle('stt:whisper:stop', async () => {
    return await provider.stopSession()
  })

  ipcMain.handle('stt:whisper:push', async (event: IpcMainInvokeEvent, data: {
    segmentId: string
    wav: ArrayBuffer
    start: number
    end: number
    speaker: string
  }) => {
    return await provider.transcribeAudio(
      data.wav,
      data.segmentId,
      data.start,
      data.end,
      data.speaker
    )
  })

  console.log('✅ Whisper IPC handlers registered')
}
