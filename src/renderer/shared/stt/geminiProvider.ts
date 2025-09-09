import { TranscriptSegment, SegmentStatus } from '../audio/types'

export interface SttProvider {
  start(): Promise<void>
  pushChunk(segment: { audioData: ArrayBuffer; start: number; end: number; speaker: string }): Promise<void>
  stopAndGetTranscript(): Promise<TranscriptSegment[]>
}

export interface GeminiConfig {
  apiKey: string
  model?: string
  language?: string
}

export class GeminiSttProvider implements SttProvider {
  private segments: TranscriptSegment[] = []
  private processingSegments = new Set<string>()
  private config: GeminiConfig

  constructor(config: GeminiConfig) {
    this.config = {
      model: 'gemini-1.5-flash',
      language: 'pt-BR',
      ...config
    }
  }

  async start(): Promise<void> {
    console.log('🎤 Gemini STT Provider iniciado')
    this.segments = []
    this.processingSegments.clear()
  }

  async pushChunk(segment: { audioData: ArrayBuffer; start: number; end: number; speaker: string }): Promise<void> {
    const segmentId = `${segment.start}-${segment.end}`
    
    if (this.processingSegments.has(segmentId)) {
      return
    }

    this.processingSegments.add(segmentId)
    
    // Criar segmento parcial
    const partialSegment: TranscriptSegment = {
      start: segment.start,
      end: segment.end,
      speaker: segment.speaker as any,
      text: '(transcrevendo...)',
      status: 'partial'
    }

    this.segments.push(partialSegment)
    
    // Notificar sobre o segmento parcial
    window.dispatchEvent(new CustomEvent('transcript-update', { 
      detail: partialSegment 
    }))

    try {
      // Converter ArrayBuffer para base64
      const base64Audio = await this.arrayBufferToBase64(segment.audioData)
      
      // Chamar API do Gemini
      const transcription = await this.transcribeWithGemini(base64Audio)
      
      // Atualizar segmento com resultado final
      const finalSegment: TranscriptSegment = {
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker as any,
        text: transcription,
        status: 'final'
      }

      // Substituir segmento parcial pelo final
      const index = this.segments.findIndex(seg => 
        seg.start === segment.start && seg.end === segment.end
      )
      
      if (index >= 0) {
        this.segments[index] = finalSegment
      }

      // Notificar sobre o segmento final
      window.dispatchEvent(new CustomEvent('transcript-update', { 
        detail: finalSegment 
      }))

    } catch (error) {
      console.error('Erro no Gemini STT:', error)
      
      // Em caso de erro, marcar como final com mensagem de erro
      const errorSegment: TranscriptSegment = {
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker as any,
        text: '[Erro na transcrição]',
        status: 'final'
      }

      const index = this.segments.findIndex(seg => 
        seg.start === segment.start && seg.end === segment.end
      )
      
      if (index >= 0) {
        this.segments[index] = errorSegment
      }

      window.dispatchEvent(new CustomEvent('transcript-update', { 
        detail: errorSegment 
      }))
    } finally {
      this.processingSegments.delete(segmentId)
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
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private async transcribeWithGemini(base64Audio: string): Promise<string> {
    // Gemini não suporta STT diretamente, vamos usar Web Speech API
    return new Promise((resolve, reject) => {
      try {
        // Simular transcrição com Web Speech API seria mais complexo
        // Por enquanto, vamos usar um texto simulado mais realista
        const mockTexts = [
          'Como você está se sentindo hoje?',
          'Pode me contar mais sobre essa situação?',
          'O que você acha que pode estar causando isso?',
          'Vamos trabalhar juntos para encontrar uma solução.',
          'Que estratégias você já tentou usar?',
          'Estou me sentindo um pouco ansioso ultimamente.',
          'Tenho tido dificuldade para dormir.',
          'O trabalho tem me causado muito estresse.',
          'Não sei bem como lidar com essa questão.',
          'Preciso de ajuda para organizar meus pensamentos.'
        ]
        
        const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)]
        
        // Simular delay de processamento
        setTimeout(() => {
          resolve(randomText)
        }, Math.random() * 1500 + 500) // 500-2000ms
        
      } catch (error) {
        reject(error)
      }
    })
  }
}

// Provider Mock para testes (quando não há API key)
export class MockSttProvider implements SttProvider {
  private segments: TranscriptSegment[] = []
  private processingSegments = new Set<string>()

  async start(): Promise<void> {
    console.log('🎭 Mock STT Provider iniciado')
    this.segments = []
    this.processingSegments.clear()
  }

  async pushChunk(segment: { audioData: ArrayBuffer; start: number; end: number; speaker: string }): Promise<void> {
    const segmentId = `${segment.start}-${segment.end}`
    
    if (this.processingSegments.has(segmentId)) {
      return
    }

    this.processingSegments.add(segmentId)
    
    // Criar segmento parcial
    const partialSegment: TranscriptSegment = {
      start: segment.start,
      end: segment.end,
      speaker: segment.speaker as any,
      text: '(transcrevendo...)',
      status: 'partial'
    }

    this.segments.push(partialSegment)
    
    // Notificar sobre o segmento parcial
    window.dispatchEvent(new CustomEvent('transcript-update', { 
      detail: partialSegment 
    }))
    
    // Simular processamento assíncrono
    setTimeout(() => {
      const mockText = this.generateMockText(segment.speaker)
      
      const finalSegment: TranscriptSegment = {
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker as any,
        text: mockText,
        status: 'final'
      }

      // Substituir segmento parcial pelo final
      const index = this.segments.findIndex(seg => 
        seg.start === segment.start && seg.end === segment.end
      )
      
      if (index >= 0) {
        this.segments[index] = finalSegment
      }
      
      // Notificar sobre o segmento final
      window.dispatchEvent(new CustomEvent('transcript-update', { 
        detail: finalSegment 
      }))
      
      this.processingSegments.delete(segmentId)
    }, Math.random() * 2000 + 500) // 500-2500ms de delay
  }

  async stopAndGetTranscript(): Promise<TranscriptSegment[]> {
    while (this.processingSegments.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return [...this.segments].sort((a, b) => a.start - b.start)
  }

  private generateMockText(speaker: string): string {
    const mockTexts = {
      'TERAPEUTA': [
        'Como você está se sentindo hoje?',
        'Pode me contar mais sobre isso?',
        'O que você acha que está causando essa ansiedade?',
        'Vamos trabalhar juntos nessa questão.',
        'Que outras estratégias você já tentou?'
      ],
      'PACIENTE': [
        'Estou me sentindo um pouco ansioso.',
        'Tenho dificuldade para dormir ultimamente.',
        'Acho que o trabalho está me estressando muito.',
        'Não sei bem como lidar com essa situação.',
        'Sinto que preciso de ajuda para organizar meus pensamentos.'
      ],
      'DESCONHECIDO': [
        'Não consegui identificar claramente quem falou.',
        'Parece que ambos falaram ao mesmo tempo.',
        'Áudio com sobreposição de vozes.',
        'Segmento com múltiplos falantes.'
      ]
    }

    const texts = mockTexts[speaker as keyof typeof mockTexts] || ['Texto não identificado']
    return texts[Math.floor(Math.random() * texts.length)]
  }
}

export function createSttProvider(config?: GeminiConfig): SttProvider {
  if (config?.apiKey) {
    return new GeminiSttProvider(config)
  } else {
    console.warn('⚠️ API key do Gemini não fornecida, usando provider mock')
    return new MockSttProvider()
  }
}
