import InsightsPanel from '../shared/InsightsPanel'
import { TranscriptSegment } from '../shared/audio/types'

interface AppPanelProps {
  transcript?: TranscriptSegment[]
  isRecording?: boolean
}

export default function AppPanel({ transcript = [], isRecording = false }: AppPanelProps) {
  return <InsightsPanel transcript={transcript} isRecording={isRecording} />
}
