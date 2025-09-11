import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export interface AudioConversionOptions {
  sampleRate?: number
  channels?: number
  bitDepth?: number
}

export class AudioConverter {
  /**
   * Converte PCM Float32 para WAV buffer
   */
  static pcmFloat32ToWav(pcmData: Float32Array, options: AudioConversionOptions = {}): ArrayBuffer {
    const sampleRate = options.sampleRate || 16000
    const channels = options.channels || 1
    const bitDepth = options.bitDepth || 16

    // Converter Float32 para Int16
    const samples = new Int16Array(pcmData.length)
    for (let i = 0; i < pcmData.length; i++) {
      samples[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32767))
    }

    // Criar header WAV
    const bytesPerSample = bitDepth / 8
    const blockAlign = channels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = samples.length * bytesPerSample
    const fileSize = 44 + dataSize - 8

    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    // RIFF header
    this.writeString(view, 0, 'RIFF')
    view.setUint32(4, fileSize, true)
    this.writeString(view, 8, 'WAVE')

    // fmt chunk
    this.writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // fmt chunk size
    view.setUint16(20, 1, true) // audio format (PCM)
    view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitDepth, true)

    // data chunk
    this.writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    // dados de áudio
    const dataView = new DataView(buffer, 44)
    for (let i = 0; i < samples.length; i++) {
      dataView.setInt16(i * 2, samples[i], true)
    }

    return buffer
  }

  /**
   * Converte WebM/Opus Blob para WAV usando MediaRecorder API
   */
  static async webmToWav(webmBlob: Blob, options: AudioConversionOptions = {}): Promise<ArrayBuffer> {
    const sampleRate = options.sampleRate || 16000
    const channels = options.channels || 1

    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const audioContext = new AudioContext({ sampleRate })
      const source = audioContext.createMediaElementSource(audio)

      const processor = audioContext.createScriptProcessor(4096, channels, channels)
      
      let audioData: Float32Array[] = []

      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer
        for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
          const channelData = inputBuffer.getChannelData(channel)
          audioData.push(new Float32Array(channelData))
        }
      }

      audio.onended = () => {
        processor.disconnect()
        audioContext.close()

        // Concatenar todos os dados de áudio
        const totalLength = audioData.reduce((sum, data) => sum + data.length, 0)
        const concatenated = new Float32Array(totalLength)
        let offset = 0

        for (const data of audioData) {
          concatenated.set(data, offset)
          offset += data.length
        }

        // Converter para WAV
        const wavBuffer = this.pcmFloat32ToWav(concatenated, { sampleRate, channels })
        resolve(wavBuffer)
      }

      audio.onerror = () => {
        processor.disconnect()
        audioContext.close()
        reject(new Error('Failed to process audio'))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      audio.src = URL.createObjectURL(webmBlob)
      audio.play()
    })
  }

  /**
   * Cria arquivo WAV temporário
   */
  static async createTempWavFile(audioBuffer: ArrayBuffer, filename?: string): Promise<string> {
    const tempDir = os.tmpdir()
    const tempFile = path.join(tempDir, filename || `whisper-temp-${Date.now()}.wav`)
    
    await fs.writeFile(tempFile, Buffer.from(audioBuffer))
    return tempFile
  }

  /**
   * Remove arquivo temporário
   */
  static async removeTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      console.warn('⚠️ Failed to remove temp file:', error)
    }
  }

  private static writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
}
