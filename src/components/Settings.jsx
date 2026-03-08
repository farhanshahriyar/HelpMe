import { useState } from 'react';
import { Eye, EyeOff, Check, Key } from 'lucide-react';
import { cn } from '../lib/utils';

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
];

function maskKey(key) {
  if (!key || key.length < 8) return '';
  return key.slice(0, 6) + '••••••••' + key.slice(-4);
}

export default function SettingsPanel({ config, onSave, onClose }) {
  const [apiKey, setApiKey] = useState(config?.openai?.apiKey || '');
  const [model, setModel] = useState(config?.openai?.model || 'gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    const newConfig = {
      activeProvider: 'openai',
      openai: { apiKey: apiKey.trim(), model },
    };
    onSave(newConfig);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const hasKey = !!config?.openai?.apiKey;

  return (
    <div className="flex flex-col gap-0 animate-fade-in border-t border-white/[0.06]">

      {/* Current key status */}
      {hasKey && (
        <div className={cn(
          'mx-3 mt-3 rounded-lg border p-2.5 transition-all duration-500',
          justSaved ? 'bg-green-500/10 border-green-500/25' : 'bg-white/[0.03] border-white/[0.06]'
        )}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={cn(
              'text-[9px] uppercase tracking-widest font-semibold',
              justSaved ? 'text-green-400' : 'text-zinc-500'
            )}>
              {justSaved ? 'Saved' : 'Active'}
            </span>
            <span className="text-[9px] text-zinc-600 font-mono">
              {MODELS.find(m => m.value === (config?.openai?.model || model))?.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key className="w-3 h-3 text-zinc-600 shrink-0" />
            <span className="text-zinc-500 text-[10px] font-mono tracking-wider">
              {maskKey(config?.openai?.apiKey)}
            </span>
          </div>
        </div>
      )}

      <div className="px-3 pb-3 pt-3 flex flex-col gap-3">
        {/* API Key input */}
        <div>
          <label className="block text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-1.5">
            API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className={cn(
                'no-drag w-full bg-white/[0.04] border border-white/[0.08] rounded-lg',
                'text-white text-xs px-3 py-2 pr-9',
                'placeholder:text-zinc-700 outline-none transition-colors',
                'focus:border-white/20 focus:bg-white/[0.07]'
              )}
            />
            <button
              onClick={() => setShowKey(s => !s)}
              className="no-drag absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-white/[0.03] border border-white/[0.06] rounded-md">
            <span className="text-zinc-600 text-[9px]">Endpoint:</span>
            <span className="text-zinc-400 text-[9px] font-mono">https://api.aivaii.com/v1</span>
          </div>
        </div>

        {/* Model select */}
        <div>
          <label className="block text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-1.5">
            Model
          </label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className={cn(
              'no-drag w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg',
              'text-white text-xs px-3 py-2 outline-none cursor-pointer transition-colors',
              'focus:border-white/20'
            )}
          >
            {MODELS.map(m => (
              <option key={m.value} value={m.value} style={{ background: '#18181b', color: '#fff' }}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className={cn(
            'no-drag w-full py-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-2',
            justSaved
              ? 'bg-green-600/80 text-white scale-[0.98]'
              : 'bg-red-600 hover:bg-red-500 text-white disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]'
          )}
        >
          {justSaved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : 'Save API Key'}
        </button>

        {onClose && !justSaved && (
          <button onClick={onClose} className="no-drag text-zinc-600 hover:text-zinc-400 text-[11px] text-center transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
