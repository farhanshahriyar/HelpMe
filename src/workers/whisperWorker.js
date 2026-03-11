import { pipeline, env } from '@xenova/transformers';

// Tell transformers.js to download models from Hugging Face and try caching them in the browser
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.addEventListener('message', async (event) => {
  const { type, audio } = event.data;

  if (type === 'load') {
    try {
      // Pre-load the model
      if (!transcriber) {
        // Post a progress message
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
          progress_callback: (info) => {
            self.postMessage({ type: 'progress', info });
          }
        });
      }
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }

  if (type === 'transcribe') {
    try {
      if (!transcriber) {
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      }
      // audio should be a Float32Array containing standard 16000Hz PCM
      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      self.postMessage({ type: 'result', text: output.text });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
});
