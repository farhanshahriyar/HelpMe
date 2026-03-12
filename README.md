# HelpMe - AI Screen & Meeting Assistant

HelpMe is a powerful, real-time desktop assistant designed to help you during live meetings, research, and general screen-based tasks. It combines local AI transcription with advanced screen analysis to provide instant context-aware assistance.

## ✨ Key Features

- **Live Screen Analysis**: Capture any part of your screen and ask HelpMe to solve problems, summarize content, or extract data.
- **Local Transcription (Privacy First)**: High-accuracy voice-to-text powered by **Whisper Tiny** running directly on your machine using `Transformers.js`. No audio leaves your computer for local transcription.
- **AI-Powered "Command Bar"**:
  - **Solve**: Immediate answers to what's on your screen.
  - **Shorten**: Condense long responses or text.
  - **Recap**: Summarize the current conversation or session.
  - **Follow Up**: Generate strategic questions based on context.
- **PDF Assistant**: Upload PDFs to analyze, summarize, and ask questions alongside your live session.
- **Screen Recording**: High-quality screen capture saved directly to your local Videos folder.
- **Multi-Provider AI**: Powered by OpenAI (GPT-4o/GPT-4o-mini) via high-performance API endpoints.

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) (Desktop)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI/ML**:
  - [Transformers.js](https://v2.transformersjs.com/) (Local Whisper Inference)
  - OpenAI API (Cloud Models)
- **Utilities**: Lucide React (Icons), PDF-parse, Remark/Rehype (Markdown rendering).

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm or yarn
- An OpenAI API Key (for cloud-based features)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd helpme-desktop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment:
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_api_key_here
   ```

### Development

Run the application in development mode:
```bash
npm run dev
```
This will start the Vite dev server and launch the Electron application simultaneously.

### Building for Production

To create a distributable installer:
```bash
npm run dist
```

## ⌨️ Global Shortcuts

- `Command/Ctrl + \`: Toggle the HelpMe Overlay.
- `Command/Ctrl + Return`: Capture screen and reveal analyzer.
- `Escape`: Hide the overlay.
- `Alt + Arrow Keys`: Move the overlay around your screen.

---

## 🔒 Privacy & Security

HelpMe is designed with privacy in mind. Local voice transcription ensures that your voice notes never leave your device unless you explicitly interact with cloud-based features. Screen captures are stored in memory and only sent to the AI provider when you trigger an analysis request.

## 📄 License

This project is proprietary. All rights reserved.
