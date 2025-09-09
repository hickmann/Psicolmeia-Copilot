import { AudioStreams } from './types'

export async function captureSystemAudio(): Promise<MediaStream | null> {
  try {
    console.log('🔊 SYSTEM: Iniciando captura via Electron...')
    
    // Primeiro, obter as fontes disponíveis via IPC
    const result = await window.overlay.captureSystemAudio()
    
    if (!result.success || !result.sources || result.sources.length === 0) {
      console.log('🔊 SYSTEM: Nenhuma fonte de áudio do sistema encontrada')
      return null
    }

    // Encontrar a fonte da tela principal
    const screenSource = result.sources.find(source => 
      source.name.includes('Screen') || 
      source.name.includes('Desktop') ||
      source.display_id
    )

    if (!screenSource) {
      console.log('🔊 SYSTEM: Fonte de tela não encontrada')
      return null
    }

    console.log('🔊 SYSTEM: Usando fonte:', screenSource.name)

    // Usar getUserMedia com chromeMediaSourceId para capturar áudio do sistema
    const constraints: MediaStreamConstraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id,
        }
      } as any,
      video: false
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    console.log('🔊 SYSTEM: Stream capturado com sucesso')
    
    return stream

  } catch (error) {
    console.error('🔊 SYSTEM: Erro ao capturar áudio:', error)
    return null
  }
}

export async function captureMicAudio(): Promise<MediaStream | null> {
  try {
    console.log('🎤 MIC: Iniciando captura do microfone...')
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    
    console.log('🎤 MIC: Stream capturado com sucesso')
    return stream

  } catch (error) {
    console.error('🎤 MIC: Erro ao capturar microfone:', error)
    return null
  }
}

export function createMixedStream(streams: AudioStreams): MediaStream | null {
  if (!streams.mic) {
    return null
  }

  try {
    console.log('🎵 MIX: Criando stream misturado...')
    
    const audioContext = new AudioContext()
    const destination = audioContext.createMediaStreamDestination()
    
    // Conectar microfone
    const micSource = audioContext.createMediaStreamSource(streams.mic)
    micSource.connect(destination)
    
    // Conectar áudio do sistema se disponível
    if (streams.system) {
      const systemSource = audioContext.createMediaStreamSource(streams.system)
      systemSource.connect(destination)
    }
    
    console.log('🎵 MIX: Stream misturado criado com sucesso')
    return destination.stream

  } catch (error) {
    console.error('🎵 MIX: Erro ao criar stream misturado:', error)
    return null
  }
}

export class ContinuousRecorder {
  private micRecorder: MediaRecorder | null = null
  private systemRecorder: MediaRecorder | null = null
  private mixedRecorder: MediaRecorder | null = null
  
  private micChunks: Blob[] = []
  private systemChunks: Blob[] = []
  private mixedChunks: Blob[] = []

  start(streams: AudioStreams): void {
    console.log('🔴 Iniciando gravação contínua...')
    
    // Gravar microfone
    if (streams.mic) {
      this.micRecorder = new MediaRecorder(streams.mic, { mimeType: 'audio/webm' })
      this.micRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.micChunks.push(event.data)
        }
      }
      this.micRecorder.start(100) // Coletar dados a cada 100ms
    }

    // Gravar áudio do sistema
    if (streams.system) {
      this.systemRecorder = new MediaRecorder(streams.system, { mimeType: 'audio/webm' })
      this.systemRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.systemChunks.push(event.data)
        }
      }
      this.systemRecorder.start(100)
    }

    // Gravar stream misturado
    if (streams.mixed) {
      this.mixedRecorder = new MediaRecorder(streams.mixed, { mimeType: 'audio/webm' })
      this.mixedRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.mixedChunks.push(event.data)
        }
      }
      this.mixedRecorder.start(100)
    }

    console.log('🔴 Gravação contínua iniciada')
  }

  async stop(): Promise<{ mic: Blob | null; system: Blob | null; mixed: Blob | null }> {
    console.log('⏹️ Parando gravação contínua...')
    
    const results = { mic: null as Blob | null, system: null as Blob | null, mixed: null as Blob | null }

    // Parar e finalizar microfone
    if (this.micRecorder && this.micRecorder.state === 'recording') {
      this.micRecorder.stop()
      await new Promise<void>((resolve) => {
        this.micRecorder!.onstop = () => {
          results.mic = new Blob(this.micChunks, { type: 'audio/webm' })
          resolve()
        }
      })
    }

    // Parar e finalizar áudio do sistema
    if (this.systemRecorder && this.systemRecorder.state === 'recording') {
      this.systemRecorder.stop()
      await new Promise<void>((resolve) => {
        this.systemRecorder!.onstop = () => {
          results.system = new Blob(this.systemChunks, { type: 'audio/webm' })
          resolve()
        }
      })
    }

    // Parar e finalizar stream misturado
    if (this.mixedRecorder && this.mixedRecorder.state === 'recording') {
      this.mixedRecorder.stop()
      await new Promise<void>((resolve) => {
        this.mixedRecorder!.onstop = () => {
          results.mixed = new Blob(this.mixedChunks, { type: 'audio/webm' })
          resolve()
        }
      })
    }

    console.log('⏹️ Gravação contínua finalizada')
    return results
  }

  extractAudioSegment(stream: MediaStream, startTime: number, endTime: number): Promise<ArrayBuffer> {
    // TODO: Implementar extração de segmento de áudio
    // Por enquanto, retornar um buffer vazio
    return Promise.resolve(new ArrayBuffer(0))
  }
}
