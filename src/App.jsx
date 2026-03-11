import { useState, useEffect } from 'react';
import Overlay from './components/Overlay';
import CropOverlay from './components/CropOverlay';

export default function App() {
  const [screenshot, setScreenshot] = useState(null);
  const [cropImage, setCropImage] = useState(null);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [providerConfig, setProviderConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('helpme_provider_config');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [configLoaded, setConfigLoaded] = useState(!!providerConfig);

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn('[HelpMe] window.electronAPI is undefined. Are you running in a browser?');
      setConfigLoaded(true);
      return;
    }

    if (!providerConfig) {
      // Load API key from .env via main process on first launch
      window.electronAPI.getEnvConfig().then((envCfg) => {
        if (envCfg?.openai?.apiKey) {
          const config = { activeProvider: 'openai', openai: envCfg.openai };
          localStorage.setItem('helpme_provider_config', JSON.stringify(config));
          window.electronAPI.setProviderConfig(config);
          setProviderConfig(config);
        }
        setConfigLoaded(true);
      }).catch((err) => {
        console.error('[HelpMe] getEnvConfig error:', err);
        setConfigLoaded(true);
      });
    } else {
      window.electronAPI.setProviderConfig(providerConfig);
      setConfigLoaded(true);
    }

    // onScreenshot auto-removes previous listener before registering
    window.electronAPI.onScreenshot((dataUrl) => setScreenshot(dataUrl));
    window.electronAPI.onStartCropUI((dataUrl) => setCropImage(dataUrl));
  }, []);

  const handleSaveConfig = (config) => {
    localStorage.setItem('helpme_provider_config', JSON.stringify(config));
    window.electronAPI.setProviderConfig(config);
    setProviderConfig(config);
  };

  if (!configLoaded) return null;

  if (cropImage) {
    return (
      <CropOverlay
        image={cropImage}
        onCrop={(dataUrl) => {
          setCropImage(null);
          window.electronAPI.finishCrop();
          setScreenshot(dataUrl);
          if (autoSubmit) {
            setAutoSubmit(false);
            // We'll let Overlay handle the submission via a ref or by detecting the state change.
            // But since Overlay is a separate component, we can use a small delay or a trigger prop.
          }
        }}
        onCancel={() => {
          setCropImage(null);
          setPendingQuestion(null);
          setAutoSubmit(false);
          window.electronAPI.finishCrop();
        }}
      />
    );
  }

  return (
    <Overlay
      screenshot={screenshot}
      providerConfig={providerConfig}
      pendingQuestion={pendingQuestion}
      onNewCapture={() => window.electronAPI.startCrop()}
      onCaptureAndSubmit={(question) => {
        setPendingQuestion(question);
        setAutoSubmit(true);
        window.electronAPI.startCrop();
      }}
      onClearPending={() => setPendingQuestion(null)}
      onPasteImage={(dataUrl) => setScreenshot(dataUrl)}
      onClose={() => window.electronAPI.hideOverlay()}
      onSaveConfig={handleSaveConfig}
      initialShowSettings={!providerConfig?.openai?.apiKey}
    />
  );
}
