import { useState, useEffect } from 'react';
import Overlay from './components/Overlay';

export default function App() {
  const [screenshot, setScreenshot] = useState(null);
  const [providerConfig, setProviderConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('helpme_provider_config');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [configLoaded, setConfigLoaded] = useState(!!providerConfig);

  useEffect(() => {
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
      }).catch(() => setConfigLoaded(true));
    } else {
      window.electronAPI.setProviderConfig(providerConfig);
    }

    // onScreenshot auto-removes previous listener before registering
    window.electronAPI.onScreenshot((dataUrl) => setScreenshot(dataUrl));
  }, []);

  const handleSaveConfig = (config) => {
    localStorage.setItem('helpme_provider_config', JSON.stringify(config));
    window.electronAPI.setProviderConfig(config);
    setProviderConfig(config);
  };

  if (!configLoaded) return null;

  return (
    <Overlay
      screenshot={screenshot}
      providerConfig={providerConfig}
      onNewCapture={() => window.electronAPI.captureScreen()}
      onClose={() => window.electronAPI.hideOverlay()}
      onSaveConfig={handleSaveConfig}
      initialShowSettings={!providerConfig?.openai?.apiKey}
    />
  );
}
