import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Settings, X, Send, ChevronDown, ChevronUp, AlertCircle, Sparkles, Check,
  Circle, Square, Mic, MicOff, MoreVertical, FileText,
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import SettingsPanel from './Settings';
import { cn } from '../lib/utils';

export default function Overlay({
  screenshot,
  providerConfig,
  pendingQuestion,
  onNewCapture,
  onCaptureAndSubmit,
  captureError, // NEW
  onClearPending,
  onPasteImage,
  onClose,
  onSaveConfig,
  initialShowSettings,
}) {
  // ── State ────────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(!!initialShowSettings);
  const [showMenu, setShowMenu] = useState(false);
  const [useScreen, setUseScreen] = useState(true);
  const [toast, setToast] = useState(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showScreenshot, setShowScreenshot] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [usedScreenshot, setUsedScreenshot] = useState(false);

  // ── Voice Record state (Whisper Web Worker) ─────────────────────────
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // ── Transcript state ──────────────────────────────────────────────────────
  const [transcript, setTranscript] = useState([]);
  const [hasTranscript, setHasTranscript] = useState(false);

  // ── PDF state ─────────────────────────────────────────────────────────────
  const [pdfName, setPdfName] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const responseRef = useRef(null);
  const textareaRef = useRef(null);
  const menuRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Whisper Worker Refs
  const whisperWorkerRef = useRef(null);
  const voiceMediaRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const usedScreenshotRef = useRef(false);
  const transcriptTextRef = useRef('');

  const autoAnalysisRef = useRef(null);
  const lastAnalyzedLenRef = useRef(0);

  // ── Toast helper ───────────────────────────────────────────────────────
  const toastTimerRef = useRef(null);
  const flash = useCallback((t, ms = 4500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(t);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }, []);

  // ── PDF handlers ──────────────────────────────────────────────────────
  const handleOpenPdf = useCallback(async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const result = await window.electronAPI.openPdfDialog();
      if (!result) return; // user cancelled
      if (result.error) {
        flash({ type: 'error', message: result.error });
      } else {
        setPdfName(result.name);
        flash({ type: 'success', message: `"${result.name}" ready · ${result.pageCount} page${result.pageCount !== 1 ? 's' : ''}` }, 4000);
      }
    } catch (err) {
      flash({ type: 'error', message: err.message || 'PDF upload failed' });
    } finally {
      setPdfLoading(false);
    }
  }, [pdfLoading, flash]);

  const handleClearPdf = useCallback(() => {
    window.electronAPI.clearPdf();
    setPdfName(null);
  }, []);

  // ── Recording callbacks ────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      chunksRef.current = [];
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.onended = () => stopRecording();
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        try {
          const buf = await blob.arrayBuffer();
          const savedPath = await window.electronAPI.saveRecording(buf);
          flash({ type: 'recording', name: savedPath.split(/[\\/]/).pop() });
        } catch { flash({ type: 'error', message: 'Failed to save recording' }); }
      };
      recorder.onerror = () => { stopRecording(); flash({ type: 'error', message: 'Recording error' }); };
      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      flash({ type: 'error', message: 'Could not start recording' });
    }
  }, [stopRecording, flash]);

  // ── Listening / transcription ──────────────────────────────────────────
  // ── Effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (screenshot) { setShowScreenshot(true); setResponse(''); setStatus('idle'); setErrorMsg(''); }
  }, [screenshot]);



  useEffect(() => {
    if (!window.electronAPI?.onStopRecordingSignal) return;
    window.electronAPI.onStopRecordingSignal(() => stopRecording());
  }, [stopRecording]);
  
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            if (onPasteImage) onPasteImage(event.target.result);
            flash({ type: 'success', message: 'Image pasted from clipboard' }, 2000);
          };
          reader.readAsDataURL(blob);
          // e.preventDefault(); // allow default so text isn't blocked if they paste text WITH an image? 
          // Actually, if it's an image, default is nothing, but let's just break;
          break;
        }
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [onPasteImage, flash]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      
      if (voiceMediaRecorderRef.current?.state !== 'inactive') voiceMediaRecorderRef.current?.stop();
      voiceStreamRef.current?.getTracks().forEach(t => t.stop());
      
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  // ── Core action helper ─────────────────────────────────────────────────
  const fireAction = useCallback(async (label, userQuestion) => {
    if (status === 'thinking' || status === 'streaming') return;
    if (response && submittedQuestion) setHistory(prev => [{ question: submittedQuestion, response, usedScreenshot: usedScreenshotRef.current }, ...prev]);
    setSubmittedQuestion(label);
    setQuestion('');
    setResponse('');
    setStatus('thinking');
    setErrorMsg('');
    setUsedScreenshot(!!screenshot);
    usedScreenshotRef.current = !!screenshot;
    
    try {
      const result = await window.electronAPI.generate({
        screenshotBase64: screenshot || null,
        question: userQuestion,
      });
      if (result.error) {
        setStatus('error');
        setErrorMsg(result.error);
      } else {
        setResponse(result.text || '');
        setStatus('done');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Generation failed.');
    }
  }, [status, response, submittedQuestion, screenshot]);

  // ── Voice Record via Web Worker ────────────────────────────────────────
  const processVoiceAudio = useCallback(async (blob) => {
    setIsTranscribing(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      // Decode audio into standard 16000Hz PCM required by Whisper
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const float32Array = audioBuffer.getChannelData(0);
      
      if (!whisperWorkerRef.current) {
        whisperWorkerRef.current = new Worker(new URL('../workers/whisperWorker.js', import.meta.url), { type: 'module' });
        whisperWorkerRef.current.onmessage = (e) => {
          const { type, text, error } = e.data;
          if (type === 'ready') {
            console.log('[HelpMe] Local Whisper worker ready');
          } else if (type === 'result') {
            setIsTranscribing(false);
            if (text?.trim()) {
              setQuestion(text.trim());
              // Force next React tick
              setTimeout(() => {
                const q = text.trim();
                fireAction(q, q);
              }, 50);
            }
          } else if (type === 'error') {
            setIsTranscribing(false);
            flash({ type: 'error', message: 'Transcription error: ' + error });
          }
        };
      }
      whisperWorkerRef.current.postMessage({ type: 'transcribe', audio: float32Array });
    } catch (err) {
      console.error(err);
      setIsTranscribing(false);
      flash({ type: 'error', message: 'Audio processing failed' });
    }
  }, [flash, fireAction]);

  const stopVoiceRecord = useCallback(() => {
    if (voiceMediaRecorderRef.current && voiceMediaRecorderRef.current.state !== 'inactive') {
      voiceMediaRecorderRef.current.stop();
    }
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach(t => t.stop());
      voiceStreamRef.current = null;
    }
    setIsVoiceRecording(false);
  }, []);

  const startVoiceRecord = useCallback(async () => {
    if (isVoiceRecording || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      voiceMediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      
      recorder.ondataavailable = e => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: mimeType || 'audio/wav' });
        processVoiceAudio(blob);
      };
      
      recorder.start();
      setIsVoiceRecording(true);
      flash({ type: 'listening', message: 'Recording started...' }, 2000);
    } catch (err) {
      console.error(err);
      flash({ type: 'error', message: 'Mic access denied' });
    }
  }, [isVoiceRecording, isTranscribing, flash, processVoiceAudio]);

  useEffect(() => {
    return () => whisperWorkerRef.current?.terminate();
  }, []);

  // ── Auto-submit when screenshot arrives with pending question ──────────
  useEffect(() => {
    if (screenshot && pendingQuestion !== null) {
      setIsCapturingScreen(false);
      fireAction(pendingQuestion || 'Analyze screen', pendingQuestion);
      onClearPending();
    }
  }, [screenshot, pendingQuestion, fireAction, onClearPending]);

  // ── Auto-submit fallback if screen capture fails ──────────
  useEffect(() => {
    if (captureError && pendingQuestion !== null) {
      setIsCapturingScreen(false);
      fireAction(pendingQuestion || 'Analyze screen', pendingQuestion);
      onClearPending();
    }
  }, [captureError, pendingQuestion, fireAction, onClearPending]);

  // ── Command bar actions (HelpMe style) ────────────────────────────
  const handleSolve = () => fireAction('Solve', '');
  const handleShorten = () => {
    if (!response) return;
    fireAction('Shorten', `Shorten and condense this response, keep key info:\n\n${response}`);
  };
  const handleRecap = () => {
    if (!transcriptTextRef.current && !response) return;
    fireAction('Recap', 'Provide a brief recap of the key points discussed so far.');
  };
  const handleFollowUp = () => {
    if (!transcriptTextRef.current && !response) return;
    fireAction('Follow Up', `Suggest 2-3 strategic follow-up questions based on the conversation.${response ? `\n\nLatest response:\n${response}` : ''}`);
  };

  // ── Other handlers ────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (status === 'thinking' || status === 'streaming' || isCapturingScreen) return;
    if (!question.trim() && !screenshot && !hasTranscript && !pdfName && !useScreen) return;
    
    if (useScreen && !screenshot) {
      setIsCapturingScreen(true);
      // Trigger auto-capture and let App.jsx handle the submission once crop finishes or is skipped
      onCaptureAndSubmit(question.trim());
      return;
    }

    const q = question.trim();
    fireAction(q || (hasTranscript ? 'Live analysis' : pdfName ? 'PDF analysis' : 'Analyze screen'), q);
  }, [question, screenshot, status, hasTranscript, pdfName, useScreen, fireAction, onCaptureAndSubmit]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key.toLowerCase() === 'r' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleReset();
    }
  };

  const handleNewCapture = () => {
    if (screenshot) {
      // Toggle off — clear the current screenshot
      onPasteImage(null);
      return;
    }
    onNewCapture();
    setQuestion(''); setSubmittedQuestion(''); setResponse(''); setStatus('idle'); setErrorMsg('');
    textareaRef.current?.focus();
  };

  const handleReset = () => {
    if (response && submittedQuestion) setHistory(prev => [{ question: submittedQuestion, response }, ...prev]);
    setQuestion(''); setSubmittedQuestion(''); setResponse(''); setStatus('idle'); setErrorMsg('');
    textareaRef.current?.focus();
  };

  const clearTranscript = () => { setTranscript([]); transcriptTextRef.current = ''; setHasTranscript(false); lastAnalyzedLenRef.current = 0; };

  const handleSaveConfig = (config) => {
    onSaveConfig(config);
    flash({ type: 'success', message: `API key saved · ${config.openai?.model || 'gpt-4o-mini'}` }, 3500);
  };

  const loadHistoryItem = (index) => {
    const item = history[index];
    if (!item) return;
    if (response && submittedQuestion) {
      setHistory(prev => [{ question: submittedQuestion, response }, ...prev.filter((_, i) => i !== index)]);
    } else {
      setHistory(prev => prev.filter((_, i) => i !== index));
    }
    setSubmittedQuestion(item.question); setResponse(item.response); setStatus('done'); setErrorMsg(''); setQuestion('');
    setUsedScreenshot(!!item.usedScreenshot);
    usedScreenshotRef.current = !!item.usedScreenshot;
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const isLoading = status === 'thinking' || status === 'streaming';
  const hasResponse = response.length > 0;

  // ── Command bar button style ──────────────────────────────────────────
  const cmdBtn = (label, active) => cn(
    'no-drag px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap',
    'hover:bg-red-600/20 hover:text-red-300 active:scale-95',
    active ? 'bg-red-600/20 text-red-300' : 'text-zinc-500',
    isLoading && 'opacity-40 pointer-events-none'
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-start justify-end p-2" style={{ background: 'transparent' }}>
      <div className="glass-panel flex flex-col w-full max-w-[420px] max-h-[90vh] animate-slide-in relative" style={{ minHeight: 52 }}>

        {/* ── Toast ── */}
        {toast && (
          <div className="absolute top-12 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none animate-slide-in">
            <div className={cn("flex items-center gap-2 bg-zinc-900/95 rounded-lg px-3 py-2 shadow-xl border text-[10px]",
              toast.type === 'error' ? 'border-red-500/30 text-red-400' : 'border-green-500/30 text-green-400')}>
              {toast.type === 'error' ? <AlertCircle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
              <span>{toast.message || toast.name || `${toast.provider} · ${toast.model}`}</span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            COMMAND BAR — HelpMe style slim action bar
            ══════════════════════════════════════════════════════════════════ */}
        <div className="drag-region flex items-center gap-1 px-2 py-1.5 select-none">

          {/* Action buttons */}
          <button onClick={handleSolve} className={cmdBtn('Solve', submittedQuestion === 'Solve')}>Solve</button>
          <button onClick={handleShorten} className={cmdBtn('Shorten', submittedQuestion === 'Shorten')}>Shorten</button>
          <button onClick={handleRecap} className={cmdBtn('Recap', submittedQuestion === 'Recap')}>Recap</button>
          <button onClick={handleFollowUp} className={cmdBtn('Follow Up', submittedQuestion === 'Follow Up')}>Follow Up</button>

          {/* Divider */}
          <div className="w-px h-4 bg-white/[0.08] mx-0.5" />

          {/* Start/Stop Voice Recording icon button */}
          <button
            onClick={isVoiceRecording ? stopVoiceRecord : startVoiceRecord}
            disabled={isTranscribing || isLoading}
            title={isVoiceRecording ? 'Stop Recording' : 'Record Voice'}
            className={cn(
              'no-drag p-1.5 rounded-md transition-all active:scale-90',
              isTranscribing ? 'text-zinc-500 cursor-not-allowed opacity-50' :
              isVoiceRecording
                ? 'bg-red-600/25 text-red-400 hover:bg-red-600/35'
                : 'text-zinc-500 hover:text-red-400 hover:bg-red-600/15',
              (isLoading || isTranscribing) && 'opacity-40 pointer-events-none'
            )}
          >
            {isVoiceRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          {/* Capture Screen icon button */}
          <button
            onClick={handleNewCapture}
            title="Capture Screen"
            className={cn(
              'no-drag p-1.5 rounded-md transition-all active:scale-90',
              screenshot
                ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                : 'text-zinc-500 hover:text-red-400 hover:bg-red-600/15',
              isLoading && 'opacity-40 pointer-events-none'
            )}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Status indicators */}
          {isLoading && (
            <span className="flex gap-0.5 items-center ml-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1 h-1 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          )}
          {isRecording && (
            <span className="text-red-400 text-[10px] font-mono font-semibold flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {formatTime(recordingTime)}
            </span>
          )}
          {isVoiceRecording && !isLoading && (
            <span className="text-red-400 text-[9px] font-semibold flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              RECORDING
            </span>
          )}
          {isTranscribing && !isLoading && (
            <span className="text-indigo-400 text-[9px] font-semibold flex items-center gap-1 ml-1 animate-pulse">
              PROCESSING AUDIO...
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Three-dot menu */}
          <div className="relative no-drag" ref={menuRef}>
            <button
              onClick={() => setShowMenu(m => !m)}
              className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute top-full right-0 mt-1 w-40 max-h-[250px] overflow-y-auto bg-zinc-900 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-2xl shadow-black/60 py-1 z-50">
                <button onClick={() => { setShowSettings(s => !s); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                  <Settings className="w-3 h-3" /> Add API Key
                </button>
                <button
                  onClick={() => { handleOpenPdf(); setShowMenu(false); }}
                  disabled={pdfLoading}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40">
                  <FileText className="w-3 h-3" />
                  {pdfLoading ? 'Parsing PDF…' : pdfName ? 'Replace PDF' : 'Upload PDF'}
                </button>
                {pdfName && (
                  <button onClick={() => { handleClearPdf(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors">
                    <X className="w-3 h-3" /> Remove PDF
                  </button>
                )}
                {isRecording && (
                  <button onClick={() => { stopRecording(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                    <Square className="w-3 h-3 fill-current" /> Stop Recording
                  </button>
                )}
                {!isRecording && (
                  <button onClick={() => { startRecording(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                    <Circle className="w-3 h-3 fill-red-500 text-red-500" /> Record Screen
                  </button>
                )}
                {(hasResponse) && (
                  <>
                    <div className="border-t border-white/[0.06] my-1" />
                    {hasResponse && (
                      <button onClick={() => { handleReset(); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                        <X className="w-3 h-3" /> Clear Response
                      </button>
                    )}
                  </>
                )}
                <div className="border-t border-white/[0.06] my-1" />
                <button onClick={onClose}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors">
                  <X className="w-3 h-3" /> Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Settings panel ── */}
        {showSettings && (
          <SettingsPanel config={providerConfig} onSave={handleSaveConfig}
            onClose={providerConfig ? () => setShowSettings(false) : null} />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            EXPANDABLE CONTENT — appears below command bar when active
            ══════════════════════════════════════════════════════════════════ */}
        {!showSettings && (
          <>

            {/* ── PDF badge ── */}
            {pdfName && (
              <div className="border-t border-white/[0.06] px-3 py-2">
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-md px-2.5 py-1.5">
                  <FileText className="w-3 h-3 text-red-400 shrink-0" />
                  <span className="text-zinc-300 text-[10px] truncate flex-1">{pdfName}</span>
                  <button onClick={handleClearPdf} className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Screenshot ── */}
            {screenshot && showScreenshot && (
              <div className="border-t border-white/[0.06] px-3 py-2">
                <div className="relative group/ss rounded-md overflow-hidden border border-white/[0.06]">
                  <img src={screenshot} alt="capture" className="w-full h-14 object-cover object-top" />
                  <button onClick={() => setShowScreenshot(false)}
                    className="absolute top-1 right-1 p-0.5 rounded bg-black/50 text-white/50 hover:text-white opacity-0 group-hover/ss:opacity-100 transition-opacity">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Response area ── */}
            {(hasResponse || status === 'thinking' || status === 'error') && (
              <div ref={responseRef} className="border-t border-white/[0.06] flex-1 overflow-y-auto px-4 py-3 min-h-[80px] max-h-[400px]">
                {status === 'thinking' && !hasResponse && (
                  <div className="flex items-center gap-2 text-zinc-500 text-xs py-1">
                    <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    <span>Analyzing...</span>
                  </div>
                )}
                {status === 'error' && (
                  <div className="flex items-start gap-2 text-red-400 text-xs p-2.5 bg-red-500/10 rounded-lg border border-red-500/20">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-1">
                      <span>{errorMsg}</span>
                      <button onClick={() => setShowSettings(true)} className="text-red-400/70 hover:text-red-400 underline text-left text-[10px]">Settings →</button>
                    </div>
                  </div>
                )}
                {hasResponse && <MarkdownRenderer content={response} streaming={status === 'streaming'} />}
                
                {hasResponse && usedScreenshot && (
                  <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-white/[0.04] text-zinc-500 text-[10px] font-medium italic">
                    <Camera className="w-3 h-3 text-zinc-600" />
                    Sent with screenshot
                  </div>
                )}
              </div>
            )}

            {/* ── Past Responses ── */}
            {history.length > 0 && (
              <div className="border-t border-white/[0.06]">
                <button onClick={() => setShowHistory(h => !h)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.02] transition-colors">
                  <span className="text-zinc-500 text-[10px] font-medium">Past Responses ({history.length})</span>
                  {showHistory ? <ChevronUp className="w-3 h-3 text-zinc-700" /> : <ChevronDown className="w-3 h-3 text-zinc-700" />}
                </button>
                {showHistory && (
                  <div className="px-3 pb-2 flex flex-col gap-1 max-h-[90px] overflow-y-auto">
                    {history.map((item, i) => (
                      <button key={i} onClick={() => loadHistoryItem(i)}
                        className="w-full text-left px-2.5 py-1.5 rounded-md bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                        <span className="text-zinc-400 text-[10px] truncate block hover:text-zinc-300">{item.question}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Input bar ── */}
            <div className="border-t border-white/[0.06] px-3 py-2">
              <div className="flex items-center gap-1.5">
                <input
                  ref={textareaRef}
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isVoiceRecording ? "Listening..." :
                    isTranscribing ? "Processing audio..." :
                    isCapturingScreen ? "Capturing screen..." : 
                    "Click to ask HelpMe"
                  }
                  disabled={isLoading || isCapturingScreen || isVoiceRecording || isTranscribing}
                  className={cn(
                    'no-drag flex-1 bg-white/[0.04] border border-white/[0.06] rounded-md',
                    'text-white text-[11px] placeholder:text-zinc-600 outline-none',
                    isCapturingScreen && 'placeholder:text-indigo-400 placeholder:animate-pulse',
                    isVoiceRecording && 'placeholder:text-red-400 placeholder:animate-pulse',
                    isTranscribing && 'placeholder:text-indigo-400 placeholder:animate-pulse',
                    'px-2.5 py-1.5 transition-colors',
                    'focus:border-white/[0.12] focus:bg-white/[0.06]',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                />
                {/*  
                <button
                  onClick={() => setUseScreen(u => !u)}
                  disabled={isLoading || !!screenshot}
                  className={cn(
                    'no-drag shrink-0 px-2 h-6 flex items-center justify-center rounded-md text-[10px] font-medium transition-colors border',
                    useScreen 
                      ? 'bg-red-600 border-red-500 text-white' 
                      : 'bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:text-white',
                    'disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap'
                  )}
                >
                  Use Screen
                </button>
                */}
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || isCapturingScreen || isVoiceRecording || isTranscribing || (!question.trim() && !screenshot && !pdfName)}
                  className={cn(
                    'no-drag shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all',
                    'bg-red-600 hover:bg-red-500 text-white',
                    'disabled:opacity-20 disabled:cursor-not-allowed active:scale-90'
                  )}
                >
                  {isLoading
                    ? <div className="w-2.5 h-2.5 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" />
                    : <Send className="w-2.5 h-2.5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
