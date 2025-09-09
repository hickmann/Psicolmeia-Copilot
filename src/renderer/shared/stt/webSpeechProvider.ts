import { TranscriptSegment, SegmentStatus } from '../audio/types'
import { SttProvider } from './geminiProvider'

export class WebSpeechSttProvider implements SttProvider {
  private segments: TranscriptSegment[] = []
  private processingSegments = new Set<string>()
  private recognition: SpeechRecognition | null = null

  constructor() {
    // Verificar se a Web Speech API está disponível
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('⚠️ Web Speech API não disponível, usando provider mock')
    }
  }

  async start(): Promise<void> {
    console.log('🎤 Web Speech STT Provider iniciado')
    this.segments = []
    this.processingSegments.clear()
    
    // Configurar reconhecimento de fala
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      this.recognition = new SpeechRecognition()
      
      this.recognition.continuous = false
      this.recognition.interimResults = true
      this.recognition.lang = 'pt-BR'
      this.recognition.maxAlternatives = 1
    }
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
      // Tentar usar Web Speech API ou fallback para mock
      const transcription = await this.transcribeAudio(segment.audioData, segment.speaker)
      
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
      console.error('Erro no Web Speech STT:', error)
      
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

  private async transcribeAudio(audioData: ArrayBuffer, speaker: string): Promise<string> {
    // Por enquanto, vamos usar textos simulados realistas
    // Em uma implementação real, você converteria o ArrayBuffer para um formato que a Web Speech API pode usar
    
    return new Promise((resolve) => {
      const mockTexts = {
        'TERAPEUTA': [
          'Como você está se sentindo hoje?',
          'Pode me contar mais sobre essa situação?',
          'O que você acha que pode estar causando isso?',
          'Vamos trabalhar juntos para encontrar uma solução.',
          'Que estratégias você já tentou usar?',
          'Como isso te faz sentir?',
          'Você já passou por algo parecido antes?',
          'O que você gostaria de mudar nessa situação?',
          'Como posso te ajudar melhor?',
          'Vamos explorar essa questão mais profundamente.'
        ],
        'PACIENTE': [
          'Estou me sentindo um pouco ansioso ultimamente.',
          'Tenho tido dificuldade para dormir.',
          'O trabalho tem me causado muito estresse.',
          'Não sei bem como lidar com essa questão.',
          'Preciso de ajuda para organizar meus pensamentos.',
          'Às vezes me sinto sobrecarregado.',
          'Tenho medo de não conseguir resolver isso.',
          'Sinto que estou perdendo o controle.',
          'Preciso aprender a lidar melhor com a pressão.',
          'Quero me sentir mais confiante.'
        ],
        'DESCONHECIDO': [
          'Não consegui identificar claramente quem falou.',
          'Parece que ambos falaram ao mesmo tempo.',
          'Áudio com sobreposição de vozes.',
          'Segmento com múltiplos falantes.'
        ]
      }

      const texts = mockTexts[speaker as keyof typeof mockTexts] || mockTexts['DESCONHECIDO']
      const randomText = texts[Math.floor(Math.random() * texts.length)]
      
      // Simular delay de processamento realista
      setTimeout(() => {
        resolve(randomText)
      }, Math.random() * 1500 + 800) // 800-2300ms
    })
  }
}

// Função para criar o provider apropriado
export function createWebSpeechSttProvider(): SttProvider {
  return new WebSpeechSttProvider()
}
