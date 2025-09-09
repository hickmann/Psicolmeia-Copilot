import { TranscriptSegment } from '../audio/types'

export interface GoogleCloudSttProvider {
  start(): Promise<void>
  pushChunk(segment: { audioData: ArrayBuffer; start: number; end: number; speaker: string }): Promise<void>
  stopAndGetTranscript(): Promise<TranscriptSegment[]>
}

export interface GoogleCloudConfig {
  apiKey: string
  languageCode?: string
  model?: string
}

export class GoogleCloudSttProvider implements GoogleCloudSttProvider {
  private segments: TranscriptSegment[] = []
  private processingSegments = new Set<string>()
  private config: GoogleCloudConfig
  private segmentCounter = 0

  constructor(config: GoogleCloudConfig) {
    this.config = {
      languageCode: 'pt-BR',
      model: 'latest_short',
      ...config
    }
  }

  async start(): Promise<void> {
    console.log('☁️ Google Cloud STT Provider iniciado')
    this.segments = []
    this.processingSegments.clear()
    this.segmentCounter = 0
  }

  async pushChunk(segment: { audioData: ArrayBuffer; start: number; end: number; speaker: string }): Promise<void> {
    const segmentId = `segment-${this.segmentCounter + 1}-${Date.now()}`
    
    if (this.processingSegments.has(segmentId)) {
      return
    }

    this.processingSegments.add(segmentId)
    this.segmentCounter++
    
    // Usar timestamps reais em segundos desde epoch
    const startTime = segment.start
    const endTime = segment.end
    
    // Criar segmento parcial com ID único
    const partialSegment: TranscriptSegment = {
      start: startTime,
      end: endTime,
      speaker: segment.speaker as any,
      text: `[Transcrevendo via Google Cloud... ${this.segmentCounter}]`,
      status: 'partial',
      id: segmentId // Adicionar ID único para identificação
    }

    this.segments.push(partialSegment)
    
    // Notificar sobre o segmento parcial
    window.dispatchEvent(new CustomEvent('transcript-update', { 
      detail: { segment: partialSegment, allSegments: [...this.segments] }
    }))

    try {
      // Converter ArrayBuffer para base64
      const audioBase64 = await this.arrayBufferToBase64(segment.audioData)
      
      // Chamar API do Google Cloud Speech-to-Text
      const transcription = await this.transcribeWithGoogleCloud(audioBase64)
      
      if (transcription === null) {
        // Sem transcrição detectada - remover segmento parcial
        console.log('⚠️ Sem transcrição detectada, removendo segmento')
        
        const index = this.segments.findIndex(seg => seg.id === segmentId)
        if (index >= 0) {
          this.segments.splice(index, 1)
        }
        
        // Notificar sobre a remoção
        window.dispatchEvent(new CustomEvent('transcript-update', { 
          detail: { segment: null, allSegments: [...this.segments] }
        }))
        
        return // Sair sem criar segmento final
      }
      
      // Atualizar segmento com resultado final
      const finalSegment: TranscriptSegment = {
        start: startTime,
        end: endTime,
        speaker: segment.speaker as any,
        text: transcription,
        status: 'final',
        id: segmentId
      }

      // Substituir segmento parcial pelo final usando ID
      const index = this.segments.findIndex(seg => 
        seg.id === segmentId
      )
      
      if (index >= 0) {
        this.segments[index] = finalSegment
      }

      // Notificar sobre o segmento final com todos os segmentos
      window.dispatchEvent(new CustomEvent('transcript-update', { 
        detail: { segment: finalSegment, allSegments: [...this.segments] }
      }))

    } catch (error) {
      console.error('❌ Erro no Google Cloud STT:', error)
      
      // Em caso de erro, tentar novamente mantendo o segmento parcial
      console.log('🔄 Tentando novamente em 2 segundos...')
      
      // Aguardar 2 segundos e tentar novamente
      setTimeout(async () => {
        try {
          console.log('🔄 Tentativa de reprocessamento do segmento')
          const retryTranscription = await this.transcribeWithGoogleCloud(audioBase64)
          
          if (retryTranscription === null) {
            // Ainda sem transcrição, remover segmento
            const index = this.segments.findIndex(seg => seg.id === segmentId)
            if (index >= 0) {
              this.segments.splice(index, 1)
            }
            
            window.dispatchEvent(new CustomEvent('transcript-update', { 
              detail: { segment: null, allSegments: [...this.segments] }
            }))
          } else {
            // Sucesso na segunda tentativa
            const finalSegment: TranscriptSegment = {
              start: startTime,
              end: endTime,
              speaker: segment.speaker as any,
              text: retryTranscription,
              status: 'final',
              id: segmentId
            }

            const index = this.segments.findIndex(seg => seg.id === segmentId)
            if (index >= 0) {
              this.segments[index] = finalSegment
            }

            window.dispatchEvent(new CustomEvent('transcript-update', { 
              detail: { segment: finalSegment, allSegments: [...this.segments] }
            }))
          }
        } catch (retryError) {
          console.error('❌ Erro na segunda tentativa:', retryError)
          
          // Após falhar duas vezes, marcar como erro mas manter histórico
          const errorSegment: TranscriptSegment = {
            start: startTime,
            end: endTime,
            speaker: segment.speaker as any,
            text: '[Erro na transcrição - tentativas esgotadas]',
            status: 'final',
            id: segmentId
          }

          const index = this.segments.findIndex(seg => seg.id === segmentId)
          if (index >= 0) {
            this.segments[index] = errorSegment
          }

          window.dispatchEvent(new CustomEvent('transcript-update', { 
            detail: { segment: errorSegment, allSegments: [...this.segments] }
          }))
        } finally {
          this.processingSegments.delete(segmentId)
        }
      }, 2000)
      
      return // Não remover da fila ainda, aguardar retry
    } finally {
      // Só remover da fila se não houver erro (retry vai gerenciar)
      if (!this.processingSegments.has(segmentId)) {
        this.processingSegments.delete(segmentId)
      }
    }
  }

  async stopAndGetTranscript(): Promise<TranscriptSegment[]> {
    // Aguardar todos os segmentos serem processados
    while (this.processingSegments.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return [...this.segments].sort((a, b) => a.start - b.start)
  }

  private async arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer], { type: 'audio/webm;codecs=opus' })
      const reader = new FileReader()
      
      reader.onloadend = () => {
        if (reader.result) {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        } else {
          reject(new Error('Falha ao converter áudio para base64'))
        }
      }
      
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  private async transcribeWithGoogleCloud(audioBase64: string): Promise<string | null> {
    const GOOGLE_STT_ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize'
    
    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: this.config.languageCode,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: this.config.model,
        useEnhanced: true,
        maxAlternatives: 1,
        profanityFilter: false
      },
      audio: {
        content: audioBase64
      }
    }

    console.log('☁️ Enviando áudio para Google Cloud STT...')

    const response = await fetch(`${GOOGLE_STT_ENDPOINT}?key=${this.config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Google STT API Error: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`)
    }

    const result = await response.json()
    console.log('☁️ Resposta do Google Cloud STT:', result)

    if (result.results && result.results.length > 0) {
      const alternative = result.results[0].alternatives?.[0]
      if (alternative?.transcript) {
        return alternative.transcript.trim()
      }
    }

    // Retornar null quando não há transcrição para não criar segmento
    return null
  }
}

// Função para criar o provider com sua API key
export function createGoogleCloudSttProvider(): GoogleCloudSttProvider {
  const apiKey = 'AIzaSyBfeqhkjNyXjmqI5OPoYb3CosyxwfyA8zY'
  
  if (!apiKey) {
    throw new Error('API key do Google Cloud não configurada')
  }

  return new GoogleCloudSttProvider({ apiKey })
}
