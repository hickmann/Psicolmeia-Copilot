import { Speaker } from './types'

interface EnergyReading {
  timestamp: number
  energy: number
}

export class UnknownDetector {
  private micEnergyHistory: EnergyReading[] = []
  private systemEnergyHistory: EnergyReading[] = []
  private readonly WINDOW_SIZE = 500 // ms
  private readonly OVERLAP_THRESHOLD = 200 // ms
  private readonly ENERGY_THRESHOLD = 30

  addMicEnergy(energy: number, timestamp: number): void {
    this.micEnergyHistory.push({ timestamp, energy })
    this.cleanupHistory(this.micEnergyHistory, timestamp)
  }

  addSystemEnergy(energy: number, timestamp: number): void {
    this.systemEnergyHistory.push({ timestamp, energy })
    this.cleanupHistory(this.systemEnergyHistory, timestamp)
  }

  getSpeakerAt(timestamp: number): Speaker {
    const windowStart = timestamp - this.WINDOW_SIZE
    
    // Verificar energia do MIC na janela
    const micInWindow = this.micEnergyHistory.filter(
      reading => reading.timestamp >= windowStart && reading.timestamp <= timestamp
    )
    const micHighEnergy = micInWindow.filter(reading => reading.energy > this.ENERGY_THRESHOLD)
    
    // Verificar energia do SYSTEM na janela
    const systemInWindow = this.systemEnergyHistory.filter(
      reading => reading.timestamp >= windowStart && reading.timestamp <= timestamp
    )
    const systemHighEnergy = systemInWindow.filter(reading => reading.energy > this.ENERGY_THRESHOLD)
    
    // Calcular duração de alta energia para cada fonte
    const micDuration = this.calculateHighEnergyDuration(micHighEnergy)
    const systemDuration = this.calculateHighEnergyDuration(systemHighEnergy)
    
    // Verificar sobreposição
    const hasOverlap = micDuration > this.OVERLAP_THRESHOLD && systemDuration > this.OVERLAP_THRESHOLD
    
    if (hasOverlap) {
      return 'DESCONHECIDO'
    } else if (micDuration > this.OVERLAP_THRESHOLD) {
      return 'TERAPEUTA'
    } else if (systemDuration > this.OVERLAP_THRESHOLD) {
      return 'PACIENTE'
    } else {
      return 'TERAPEUTA' // Default
    }
  }

  private cleanupHistory(history: EnergyReading[], currentTimestamp: number): void {
    const cutoff = currentTimestamp - this.WINDOW_SIZE * 2
    const index = history.findIndex(reading => reading.timestamp > cutoff)
    if (index > 0) {
      history.splice(0, index)
    }
  }

  private calculateHighEnergyDuration(highEnergyReadings: EnergyReading[]): number {
    if (highEnergyReadings.length === 0) return 0
    
    // Agrupar leituras consecutivas
    const groups: EnergyReading[][] = []
    let currentGroup: EnergyReading[] = [highEnergyReadings[0]]
    
    for (let i = 1; i < highEnergyReadings.length; i++) {
      const prev = highEnergyReadings[i - 1]
      const curr = highEnergyReadings[i]
      
      // Se a diferença de tempo for pequena, adicionar ao grupo atual
      if (curr.timestamp - prev.timestamp < 100) {
        currentGroup.push(curr)
      } else {
        // Iniciar novo grupo
        groups.push(currentGroup)
        currentGroup = [curr]
      }
    }
    groups.push(currentGroup)
    
    // Calcular duração total
    let totalDuration = 0
    for (const group of groups) {
      if (group.length > 1) {
        const start = group[0].timestamp
        const end = group[group.length - 1].timestamp
        totalDuration += end - start
      }
    }
    
    return totalDuration
  }

  clear(): void {
    this.micEnergyHistory = []
    this.systemEnergyHistory = []
  }
}
