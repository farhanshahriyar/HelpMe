# HelpMe - AI Screen & Meeting Assistant

HelpMe is a powerful, real-time desktop assistant designed to help you during live meetings, research, and general screen-based tasks. It combines local AI transcription with advanced screen analysis to provide instant context-aware assistance.

---

## ✨ Key Features

- **🔍 Live Screen Analysis**: Capture any part of your screen using the crop tool and ask HelpMe to solve problems, summarize content, or extract data.
- **🎙️ Local Transcription (Privacy First)**: High-accuracy voice-to-text powered by **Whisper Tiny** running directly on your machine using `Transformers.js`. Your audio stays local during transcription.
- **⚡ AI-Powered "Command Bar"**:
  - **Solve**: Immediate answers to what's on your screen.
  - **Shorten**: Condense long responses or text.
  - **Recap**: Summarize the current conversation or session.
  - **Follow Up**: Generate strategic questions based on context.
- **📄 PDF Assistant**: Upload PDFs to analyze, summarize, and ask questions alongside your live session.
- **🎥 Screen Recording**: High-quality screen capture (WebM) saved automatically to your local `Videos` folder.
- **🧠 Multi-Provider AI**: Powered by OpenAI models (GPT-4o/GPT-4o-mini) via high-performance API endpoints.
- **🎨 Modern UI**: Sleek, glassmorphic overlay that stays on top for seamless workflow integration.

---

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) (Desktop)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI/ML**:
  - [Transformers.js](https://v2.transformersjs.com/) (Local Whisper Inference)
  - [OpenAI API](https://openai.com/) (Cloud Models)
- **Utilities**:
  - `Lucide React` (Icons)
  - `pdf-parse` (PDF extraction)
  - `Remark`/`Rehype` (Markdown and LaTeX rendering)
  - `onnxruntime-web` (ML acceleration)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm or yarn
- An OpenAI API Key (Configure in app Settings or `.env`)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd helpme-desktop
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    Create a `.env` file in the root directory:
    ```env
    OPENAI_API_KEY=your_api_key_here
    ```

### Development & Build

- **Development Mode**: `npm run dev` (Starts Vite and Electron concurrently)
- **Build Frontend**: `npm run build`
- **Create Executable**: `npm run dist` (Generates a Windows installer in the `release/` folder)

---

## ⌨️ Global Shortcuts

Maximize your productivity with these built-in shortcuts:

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + \` | **Toggle** HelpMe Overlay visibility |
| `Ctrl + Enter` | **Capture & Reveal** crop tool |
| `Alt + Arrow Keys` | **Move** the overlay window precisely |
| `Ctrl + Shift + R` | **Stop Recording** screen session |
| `Escape` | **Hide** the overlay |

---

## 📁 Project Structure

```text
HelpMe/
├── electron/          # Main process, IPC handlers, Preload scripts
├── src/               # React frontend
│   ├── components/    # Reusable UI (Overlay, Settings, Crop, etc.)
│   ├── lib/           # Utility functions
│   └── workers/       # Web Workers (Local Whisper Inference)
├── dist/              # Compiled frontend (built)
├── release/           # Generated installers (.exe)
└── package.json       # Dependencies and build scripts
```

---

## 🔒 Privacy & Security

HelpMe is built with a **Privacy-First** mindset.
- **Audio Processing**: Voice notes are transcribed locally using Whisper and ONNX. No raw audio is sent to external servers unless cloud features are explicitly used.
- **Screen Data**: Capture data is stored in memory and only sent to AI providers upon your request for analysis.
- **Local Storage**: Recording files are saved directly to your local user directory.

---

## 📄 License

This project is proprietary. All rights reserved.
