require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const electron = require('electron');
const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
  session,
  dialog,
} = electron;
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
let pdfContext = null; // { name, text }

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
function buildUserText(question, transcript, pdfText) {
  const parts = [];
  if (pdfText) parts.push(`<pdf_document>\n${pdfText}\n</pdf_document>`);
  if (transcript) parts.push(`<live_transcript>\n${transcript}\n</live_transcript>`);
  if (question) {
    parts.push(question);
  } else if (transcript) {
    parts.push('Analyze the current moment in the conversation and provide relevant assistance based on the transcript and what is visible on the screen.');
  } else if (pdfText) {
    parts.push('Summarize the key points of the PDF document.');
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
    x: width - 480, // Slightly more padding from right
    y: 50,
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

let originalBounds = null;

// ── Full-screen capture (no crop UI) ─ used by "Use Screen" ──────────────────
ipcMain.on('capture-fullscreen', async (event) => {
  if (!overlayWindow) return;
  overlayWindow.hide();
  await new Promise(r => setTimeout(r, 180));
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    const primary = sources.find(s => s.display_id === String(primaryDisplay.id)) || sources[0];
    const dataUrl = primary ? 'data:image/jpeg;base64,' + primary.thumbnail.toJPEG(85).toString('base64') : null;
    overlayWindow?.show();
    overlayWindow?.focus();
    event.sender.send('fullscreen-captured', dataUrl);
  } catch (err) {
    console.error('Fullscreen capture error:', err);
    overlayWindow?.show();
    overlayWindow?.focus();
    event.sender.send('fullscreen-captured', null);
  }
});

async function startCropSequence(event) {
  if (!overlayWindow) return;
  originalBounds = overlayWindow.getBounds();
  overlayWindow.hide();
  await new Promise(r => setTimeout(r, 180));
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    const primary = sources.find(s => s.display_id === String(primaryDisplay.id)) || sources[0];
    
    // Capture full resolution so user can crop clearly
    const dataUrl = primary ? 'data:image/jpeg;base64,' + primary.thumbnail.toJPEG(90).toString('base64') : null;
    
    if (dataUrl) {
      overlayWindow.setBounds(primaryDisplay.bounds);
      overlayWindow.show();
      overlayWindow.focus();
      event.sender.send('start-crop-ui', dataUrl);
    } else {
      overlayWindow.show();
      overlayWindow.focus();
    }
  } catch (err) {
    console.error('Crop capture error:', err);
    overlayWindow.setBounds(originalBounds);
    overlayWindow.show();
    overlayWindow.focus();
  }
}

async function captureAndSend(sendFn) {
  // Keeping this for generic screenshot generation if needed, but not scaled down
  if (!overlayWindow) return;
  overlayWindow.hide();
  await new Promise(r => setTimeout(r, 180));
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    const primary = sources.find(s => s.display_id === String(primaryDisplay.id)) || sources[0];
    const dataUrl = primary ? 'data:image/jpeg;base64,' + primary.thumbnail.toJPEG(90).toString('base64') : null;
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
  if (!overlayWindow) return;
  startCropSequence({ sender: overlayWindow.webContents });
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

ipcMain.on('start-crop', (event) => {
  startCropSequence(event);
});

ipcMain.on('finish-crop', () => {
  if (overlayWindow && originalBounds) {
    overlayWindow.setBounds(originalBounds);
  }
});

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
      // Log image payload size for debugging
      const payloadKB = Math.round(screenshotBase64.length / 1024);
      console.log(`[HelpMe] Image payload: ~${payloadKB} KB`);
      content.push({ type: 'image_url', image_url: { url: screenshotBase64, detail: 'auto' } });
    }
    content.push({ type: 'text', text: buildUserText(question, transcript, pdfContext?.text || null) });
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
    const status = err.status || err.statusCode || '';
    const body = err.error?.message || err.message || 'Generation failed.';
    console.error(`[HelpMe] Generate error (${status}):`, body);
    return { error: status ? `${status} – ${body}` : body };
  }
});

ipcMain.handle('open-pdf-dialog', async () => {
  const result = await dialog.showOpenDialog(overlayWindow, {
    title: 'Select a PDF',
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const name = path.basename(filePath);
    pdfContext = { name, text: data.text };
    return { name, pageCount: data.numpages };
  } catch (err) {
    console.error('[HelpMe] PDF parse error:', err.message || err);
    return { error: err.message || 'Failed to parse PDF' };
  }
});

ipcMain.on('clear-pdf', () => { pdfContext = null; });

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault());
