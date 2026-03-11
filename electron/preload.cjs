const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  captureScreen: () => ipcRenderer.send('capture-screen'),
  setProviderConfig: (config) => ipcRenderer.send('set-provider-config', config),
  generate: (data) => ipcRenderer.invoke('generate', data),
  saveRecording: (buf) => ipcRenderer.invoke('save-recording', buf),
  transcribeAudio: (buf) => ipcRenderer.invoke('transcribe-audio', buf),
  getEnvConfig: () => ipcRenderer.invoke('get-env-config'),
  openPdfDialog: () => ipcRenderer.invoke('open-pdf-dialog'),
  clearPdf: () => ipcRenderer.send('clear-pdf'),
  
  startCrop: () => ipcRenderer.send('start-crop'),
  finishCrop: () => ipcRenderer.send('finish-crop'),
  captureFullscreen: () => ipcRenderer.send('capture-fullscreen'),

  onFullscreenCaptured: (cb) => {
    ipcRenderer.removeAllListeners('fullscreen-captured');
    ipcRenderer.on('fullscreen-captured', (_, dataUrl) => cb(dataUrl));
  },

  onStartCropUI: (cb) => {
    ipcRenderer.removeAllListeners('start-crop-ui');
    ipcRenderer.on('start-crop-ui', (_, dataUrl) => cb(dataUrl));
  },
  onScreenshot: (cb) => {
    ipcRenderer.removeAllListeners('screenshot-taken');
    ipcRenderer.on('screenshot-taken', (_, data) => cb(data));
  },
  onGenChunk: (cb) => {
    ipcRenderer.removeAllListeners('gen-chunk');
    ipcRenderer.on('gen-chunk', (_, text) => cb(text));
  },
  onGenDone: (cb) => {
    ipcRenderer.removeAllListeners('gen-done');
    ipcRenderer.on('gen-done', () => cb());
  },
  onGenError: (cb) => {
    ipcRenderer.removeAllListeners('gen-error');
    ipcRenderer.on('gen-error', (_, msg) => cb(msg));
  },
  onStopRecordingSignal: (cb) => {
    ipcRenderer.removeAllListeners('stop-recording-signal');
    ipcRenderer.on('stop-recording-signal', () => cb());
  },

  clearListeners: () => {
    ['screenshot-taken', 'gen-chunk', 'gen-done', 'gen-error', 'stop-recording-signal', 'start-crop-ui', 'fullscreen-captured'].forEach(ch => {
      ipcRenderer.removeAllListeners(ch);
    });
  },
});
