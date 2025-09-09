import HudBar from '../shared/HudBar'
import { TranscriptSegment, RecordingState } from '../shared/audio/types'

interface AppHudProps {
  onRecordingStateChange?: (state: RecordingState) => void
  onTranscriptUpdate?: (transcript: TranscriptSegment[]) => void
}

export default function AppHud({ onRecordingStateChange, onTranscriptUpdate }: AppHudProps) {
  return <HudBar onRecordingStateChange={onRecordingStateChange} onTranscriptUpdate={onTranscriptUpdate} />
}
