require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
  session,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isDev = process.env.NODE_ENV === 'development';
const API_BASE_URL = 'https://api.aivaii.com/v1';

// ── Single instance lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (overlayWindow) { overlayWindow.show(); overlayWindow.focus(); }
  });
}

let overlayWindow = null;
let providerConfig = {};

// ── System Prompt ────────────────────────────────────────────────────────────
let SYSTEM_PROMPT;
try {
  SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../SystemPlan.md'), 'utf-8');
} catch {
  SYSTEM_PROMPT = `You are HelpMe, developed and created by HelpMe, a live-meeting co-pilot and screen assistant.
Your goal is to help the user at the current moment in the conversation. You can see the user's screen and the audio history of the conversation.
- Answer questions directly with a short headline answer followed by supporting details.
- Define terms or proper nouns that appear at the end of the transcript.
- Suggest follow-up questions when appropriate.
- Solve visible screen problems.
- Use markdown formatting. NO headers (# ## ###). NO pronouns.
- If asked who you are: "I am HelpMe powered by a collection of LLM providers".
- All math in LaTeX. Escape dollar signs for money (\\$100).`;
}

// ── Helper: build user prompt ────────────────────────────────────────────────
function buildUserText(question, transcript) {
  const parts = [];
  if (transcript) parts.push(`<live_transcript>\n${transcript}\n</live_transcript>`);
  if (question) {
    parts.push(question);
  } else if (transcript) {
    parts.push('Analyze the current moment in the conversation and provide relevant assistance based on the transcript and what is visible on the screen.');
  } else {
    parts.push('Analyze what is on the screen and help me.');
  }
  return parts.join('\n\n');
}

function createOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 440,
    height: 680,
    x: width - 460,
    y: 30,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
    },
  });

  overlayWindow.setContentProtection(true);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.once('ready-to-show', () => {
    overlayWindow.show();
    overlayWindow.focus();
  });

  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173');
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  overlayWindow.on('closed', () => { overlayWindow = null; });
}

async function captureAndSend(sendFn) {
  if (!overlayWindow) return;
  overlayWindow.hide();
  await new Promise(r => setTimeout(r, 180));
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    const primary = sources.find(s => s.display_id === String(primaryDisplay.id)) || sources[0];
    const dataUrl = primary ? primary.thumbnail.toDataURL('image/png') : null;
    overlayWindow?.show();
    overlayWindow?.focus();
    await new Promise(r => setTimeout(r, 80));
    sendFn(dataUrl);
  } catch (err) {
    console.error('Capture error:', err);
    overlayWindow?.show();
    overlayWindow?.focus();
    await new Promise(r => setTimeout(r, 80));
    sendFn(null);
  }
}

async function captureAndReveal() {
  await captureAndSend((dataUrl) => {
    overlayWindow?.webContents.send('screenshot-taken', dataUrl);
  });
}

app.whenReady().then(() => {
  // Seed from .env
  if (process.env.OPENAI_API_KEY) {
    providerConfig.openai = { apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' };
  }

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const primary = sources.find(s => s.display_id === String(screen.getPrimaryDisplay().id)) || sources[0];
      if (!primary) { callback({ video: null }); return; }
      if (request.audioRequested) {
        callback({ video: primary, audio: 'loopback' });
      } else {
        callback({ video: primary });
      }
    } catch (err) {
      console.error('[HelpMe] Display media handler error:', err);
      callback({ video: null });
    }
  });

  createOverlay();

  globalShortcut.register('CommandOrControl+Return', async () => {
    if (!overlayWindow || overlayWindow.isVisible()) return;
    await captureAndReveal();
  });

  const bsOk = globalShortcut.register('\\', () => {
    if (!overlayWindow) return;
    overlayWindow.isVisible() ? overlayWindow.hide() : (overlayWindow.show(), overlayWindow.focus());
  });
  if (!bsOk) console.warn('[HelpMe] Backslash shortcut failed.');

  globalShortcut.register('Escape', () => { if (overlayWindow?.isVisible()) overlayWindow.hide(); });

  const STEP = 50;
  const moves = { 'Alt+Left': [-STEP, 0], 'Alt+Right': [STEP, 0], 'Alt+Up': [0, -STEP], 'Alt+Down': [0, STEP] };
  for (const [accel, [dx, dy]] of Object.entries(moves)) {
    globalShortcut.register(accel, () => {
      if (!overlayWindow?.isVisible()) return;
      const [x, y] = overlayWindow.getPosition();
      overlayWindow.setPosition(x + dx, y + dy);
    });
  }

  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (overlayWindow) overlayWindow.webContents.send('stop-recording-signal');
  });
});

// ── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('get-env-config', () => providerConfig);

ipcMain.on('hide-overlay', () => { if (overlayWindow) overlayWindow.hide(); });

ipcMain.on('capture-screen', async (event) => {
  await captureAndSend((dataUrl) => { event.sender.send('screenshot-taken', dataUrl); });
});

ipcMain.on('set-provider-config', (_event, config) => {
  providerConfig = config;
});

ipcMain.handle('save-recording', async (_event, arrayBuffer) => {
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const filename = `helpme-rec-${ts}.webm`;
  const videosDir = path.join(os.homedir(), 'Videos');
  let savePath = path.join(videosDir, filename);
  try { if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true }); }
  catch { savePath = path.join(os.homedir(), 'Desktop', filename); }
  fs.writeFileSync(savePath, Buffer.from(arrayBuffer));
  return savePath;
});

ipcMain.handle('transcribe-audio', async (_event, audioBuffer) => {
  const cfg = providerConfig.openai;
  if (!cfg?.apiKey?.trim()) throw new Error('API key required for transcription. Add it in Settings.');
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: API_BASE_URL });
  const tmpFile = path.join(os.tmpdir(), `helpme-audio-${Date.now()}.webm`);
  fs.writeFileSync(tmpFile, Buffer.from(audioBuffer));
  try {
    const result = await client.audio.transcriptions.create({ file: fs.createReadStream(tmpFile), model: 'whisper-1' });
    return result.text || '';
  } finally { try { fs.unlinkSync(tmpFile); } catch {} }
});

ipcMain.handle('generate', async (_event, { screenshotBase64, question, transcript }) => {
  const cfg = providerConfig.openai;
  if (!cfg?.apiKey?.trim()) {
    return { error: 'No API key. Open Settings to add one.' };
  }
  try {
    const { OpenAI } = require('openai');
    const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: API_BASE_URL });
    const content = [];
    if (screenshotBase64) {
      content.push({ type: 'image_url', image_url: { url: screenshotBase64, detail: 'high' } });
    }
    content.push({ type: 'text', text: buildUserText(question, transcript) });
    const result = await client.chat.completions.create({
      model: cfg.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      max_tokens: 4096,
    });
    const text = result.choices[0]?.message?.content || '';
    return { text };
  } catch (err) {
    console.error('[HelpMe] Generate error:', err.message || err);
    return { error: err.message || 'Generation failed.' };
  }
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault());
