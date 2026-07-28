import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { 
  Camera, 
  X, 
  RefreshCw, 
  Zap, 
  ZapOff, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Tablet as TabletIcon, 
  Upload, 
  Sparkles,
  HelpCircle,
  FileImage,
  ArrowRight
} from 'lucide-react';
import { Tablet } from '../../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
  title?: string;
  subtitle?: string;
  placeholderText?: string;
  sampleTablets?: Tablet[];
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Tablet QR / Barcode',
  subtitle = 'Position physical QR tag within view or upload an image',
  placeholderText = 'e.g. TBL-8012, QR-TBL-8012, BC-TBL8012',
  sampleTablets = [],
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<'camera' | 'file' | 'demo'>('camera');
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  // Sound feedback when QR code is successfully detected
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio context may be restricted before user gesture
    }
  };

  const handleDetectedCode = useCallback(
    (codeText: string) => {
      if (!isScanningActive && lastScannedResult) return;
      setIsScanningActive(false);
      setLastScannedResult(codeText);
      playBeep();

      setTimeout(() => {
        onScanSuccess(codeText);
        onClose();
      }, 650);
    },
    [isScanningActive, lastScannedResult, onScanSuccess, onClose]
  );

  // Initialize Camera Stream
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      return;
    }

    setIsScanningActive(true);
    setLastScannedResult(null);
    let currentStream: MediaStream | null = null;

    const startCamera = async () => {
      setErrorMessage(null);
      setHasCameraAccess(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access API is not supported in this browser environment.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }

        setHasCameraAccess(true);

        // Check torch capabilities
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
          if (capabilities.torch) {
            setHasTorchSupport(true);
          }
        }
      } catch (err: any) {
        console.warn('Camera initialization error:', err);
        setHasCameraAccess(false);
        setErrorMessage(
          err.message || 'Unable to start camera feed. You can upload a QR image or select from sample devices below.'
        );
      }
    };

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, activeTab, facingMode]);

  // QR Camera Scanning Loop using requestAnimationFrame & jsQR
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera' || !hasCameraAccess || !isScanningActive) return;

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data.trim().length > 0) {
            handleDetectedCode(code.data.trim());
            return;
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isOpen, activeTab, hasCameraAccess, isScanningActive, handleDetectedCode]);

  // Image File Upload Decoder
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          setIsProcessingFile(false);
          if (code && code.data) {
            handleDetectedCode(code.data.trim());
          } else {
            setErrorMessage('Could not find a valid QR code in the uploaded image. Please try another image or code.');
          }
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        setErrorMessage('Failed to read image file.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('Failed to toggle torch:', e);
      }
    }
  };

  // Manual Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleDetectedCode(manualCode.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-2xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/30 p-1 gap-1">
          <button
            onClick={() => { setActiveTab('camera'); setErrorMessage(null); }}
            className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Camera</span>
          </button>

          <button
            onClick={() => { setActiveTab('file'); setErrorMessage(null); }}
            className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'file'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>

          <button
            onClick={() => { setActiveTab('demo'); setErrorMessage(null); }}
            className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'demo'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick Select</span>
          </button>
        </div>

        {/* Scanner Content Body */}
        <div className="p-5 space-y-4">
          
          {/* TAB 1: LIVE CAMERA */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative w-full aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-800">
                {/* Canvas for JS decoding */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Video Feed */}
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />

                {/* Scanning Frame Overlay */}
                {hasCameraAccess && isScanningActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="absolute inset-0 bg-slate-950/40" />

                    <div className="relative w-56 h-56 rounded-2xl border-2 border-indigo-400/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] flex items-center justify-center overflow-hidden">
                      <div className="absolute top-2 left-2 w-4 h-4 border-t-3 border-l-3 border-indigo-400 rounded-tl-md" />
                      <div className="absolute top-2 right-2 w-4 h-4 border-t-3 border-r-3 border-indigo-400 rounded-tr-md" />
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-3 border-l-3 border-indigo-400 rounded-bl-md" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-3 border-r-3 border-indigo-400 rounded-br-md" />

                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_#818cf8] animate-[pulse_1.5s_infinite,bounce_2s_infinite]" />
                    </div>
                  </div>
                )}

                {/* Match Detected Overlay */}
                {lastScannedResult && (
                  <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-2xs flex flex-col items-center justify-center p-6 text-center text-white space-y-2 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                    <div className="text-base font-extrabold text-emerald-200">Scanned QR Code Matched!</div>
                    <div className="font-mono text-sm px-3 py-1 rounded-lg bg-emerald-900/80 border border-emerald-500/50 text-emerald-100 font-bold">
                      {lastScannedResult}
                    </div>
                  </div>
                )}

                {/* Requesting Access */}
                {hasCameraAccess === null && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-slate-300 space-y-3 p-6 text-center">
                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                    <div className="font-semibold text-xs text-slate-200">Initializing Camera Stream...</div>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Please allow camera permission in your browser prompt.
                    </p>
                  </div>
                )}

                {/* Camera Permission Error */}
                {hasCameraAccess === false && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-slate-300 space-y-3 p-6 text-center">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                    <div className="font-bold text-sm text-slate-100">Camera Unavailable</div>
                    <p className="text-xs text-slate-400 max-w-xs">{errorMessage}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('demo')}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-500 transition cursor-pointer"
                      >
                        Use Quick Select
                      </button>
                      <button
                        type="button"
                        onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700 transition cursor-pointer"
                      >
                        Retry Camera
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls Bar */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Flip Camera</span>
                  </button>

                  {hasTorchSupport && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        torchOn ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {torchOn ? <ZapOff className="w-3.5 h-3.5 text-amber-600" /> : <Zap className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{torchOn ? 'Torch On' : 'Torch'}</span>
                    </button>
                  )}
                </div>

                <span className="text-[11px] font-semibold text-slate-400">Scanner Active</span>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD IMAGE */}
          {activeTab === 'file' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-4/3 border-2 border-dashed border-indigo-300 dark:border-indigo-800 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
              >
                {isProcessingFile ? (
                  <div className="space-y-2">
                    <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
                    <div className="font-bold text-slate-700 dark:text-slate-300">Decoding QR Image...</div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition">
                      <FileImage className="w-8 h-8" />
                    </div>
                    <div className="mt-3 font-bold text-slate-800 dark:text-slate-200 text-sm">
                      Click to Choose QR Photo / Screenshot
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                      Select a photo containing a tablet asset QR tag or barcode
                    </p>
                    <button
                      type="button"
                      className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
                    >
                      Browse Files
                    </button>
                  </>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUICK SELECT DEMO TABLETS */}
          {activeTab === 'demo' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 font-medium">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Click any tablet below to simulate scanning its physical QR tag instantly:</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {sampleTablets && sampleTablets.length > 0 ? (
                  sampleTablets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleDetectedCode(t.tabletNumber)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs">
                          {t.tabletNumber}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{t.tabletName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {t.brand} {t.model} • {t.status}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold text-xs opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition">
                        <span>Scan</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))
                ) : (
                  ['TBL-8012', 'TBL-8015', 'TBL-8020', 'BOX-01'].map((code) => (
                    <div
                      key={code}
                      onClick={() => handleDetectedCode(code)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 transition flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-mono font-bold text-indigo-600">{code}</span>
                      <span className="text-xs font-semibold text-slate-500">Tap to Scan</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-slate-200 dark:border-slate-800" />
            <span className="shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Or Enter Asset Code Manually
            </span>
            <div className="grow border-t border-slate-200 dark:border-slate-800" />
          </div>

          {/* Manual Code Input Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative grow">
              <TabletIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={placeholderText}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Lookup</span>
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
