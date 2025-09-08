# Psicolmeia Desktop App

A Cluely-like overlay application for Psicolmeia with voice activity detection and transcription capabilities.

## Features

- 🎯 **Always on top** - Stays above all other applications
- 🎨 **Transparent overlay** - Glassmorphism design with blur effects
- 🎤 **Voice Activity Detection** - Real-time audio analysis
- 📝 **Live transcription** - Mock transcription with extensible architecture
- 🔄 **Click-through** - Ignores mouse events except on interactive elements
- ⌨️ **Keyboard shortcuts** - Ctrl/Cmd+Shift+R to start/stop recording
- 🌐 **Cross-platform** - Windows, Linux, and macOS support

## Tech Stack

- **Frontend**: React 19.1.0, TypeScript 5.8.3, Vite 7.0.4
- **Styling**: Tailwind CSS 4.1.12
- **Desktop**: Tauri 2 (Rust)
- **UI Components**: Radix UI, shadcn/ui (new-york preset)
- **Icons**: Lucide React
- **State Management**: Zustand
- **Audio**: @ricky0123/vad-react (Voice Activity Detection)
- **Testing**: Vitest, Playwright

## Prerequisites

- Node.js 18+ and npm
- Rust 1.70+
- Platform-specific audio drivers (see below)

### Platform-specific Requirements

#### Windows
- No additional setup required for system audio capture

#### Linux
- PulseAudio or PipeWire for system audio capture

#### macOS
- For system audio capture, you'll need a virtual audio driver:
  - [BlackHole](https://github.com/ExistentialAudio/BlackHole) (recommended)
  - [Soundflower](https://github.com/mattingalls/Soundflower)
  
  If no virtual driver is installed, the app will work with microphone-only capture.

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd psicolmeia-desktop
```

2. Install dependencies:
```bash
cd apps/desktop
npm install
```

3. Install Tauri CLI (if not already installed):
```bash
npm install -g @tauri-apps/cli
```

## Development

### Start the development server:
```bash
npm run tauri:dev
```

This will:
- Start the Vite dev server on `http://localhost:1420`
- Launch the Tauri application
- Enable hot reload for both frontend and backend changes

### Frontend-only development:
```bash
npm run dev
```

## Building

### Development build:
```bash
npm run tauri:build
```

### Production build:
```bash
npm run tauri:build -- --release
```

The built application will be available in `src-tauri/target/release/` (or `debug/` for dev builds).

## Testing

### Unit tests:
```bash
npm test
```

### E2E tests:
```bash
npx playwright test
```

### Test coverage:
```bash
npm run test:coverage
```

## Project Structure

```
apps/desktop/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── lib/               # Utilities and store
│   ├── styles/            # Global styles
│   └── test/              # Test utilities
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── audio/         # Audio capture modules
│   │   ├── main.rs        # Main Rust entry point
│   │   └── window.rs      # Window management
│   └── Cargo.toml         # Rust dependencies
├── tests/                 # E2E tests
└── dist/                  # Built frontend assets
```

## Usage

1. **Launch the app** - The overlay will appear at the top-center of your screen
2. **Start recording** - Click the microphone button or press `Ctrl/Cmd+Shift+R`
3. **View insights** - Live insights will appear in the bottom panel
4. **Toggle transcript** - Use the "Show transcript" switch to view raw transcription
5. **Open website** - Click the "psicolmeia" logo to open the website

## Audio Capture

The app captures both microphone and system audio:

- **Microphone**: Uses `getUserMedia()` API
- **System Audio**: 
  - Windows: WASAPI loopback
  - Linux: PulseAudio/PipeWire monitor
  - macOS: AVFoundation (requires virtual audio driver)

## Keyboard Shortcuts

- `Ctrl/Cmd+Shift+R`: Start/stop recording

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Contact the Psicolmeia team

## Roadmap

- [ ] Real transcription service integration
- [ ] Advanced audio processing
- [ ] Customizable overlay positioning
- [ ] Plugin system for insights
- [ ] Cloud sync capabilities
