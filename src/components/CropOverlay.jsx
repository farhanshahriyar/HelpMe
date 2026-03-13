import { useState, useRef, useEffect } from 'react';

export default function CropOverlay({ image, onCrop, onCancel }) {
  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState(null);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (!isDragging || !start || !current) return;
    setIsDragging(false);

    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    if (width < 20 || height < 20) {
      onCancel();
      return;
    }

    const img = new Image();
    img.src = image;
    img.onload = () => {
      const scaleX = img.naturalWidth / window.innerWidth;
      const scaleY = img.naturalHeight / window.innerHeight;

      // Crop at native resolution first
      let cropW = Math.round(width * scaleX);
      let cropH = Math.round(height * scaleY);
      const cropX = Math.round(left * scaleX);
      const cropY = Math.round(top * scaleY);

      // Resize to fit within MAX_DIM to keep base64 payload small
      const MAX_DIM = 1024;
      let outW = cropW;
      let outH = cropH;
      if (outW > MAX_DIM || outH > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / outW, MAX_DIM / outH);
        outW = Math.round(outW * ratio);
        outH = Math.round(outH * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        img,
        cropX, cropY, cropW, cropH,
        0, 0, outW, outH
      );

      const croppedUrl = canvas.toDataURL('image/jpeg', 0.75);
      onCrop(croppedUrl);
    };
  };

  let box = null;
  if (start && current) {
    box = {
      left: Math.min(start.x, current.x),
      top: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };
  }

  return (
    <div
      className="fixed inset-0 z-[9999] cursor-crosshair select-none"
      style={{
        backgroundImage: `url(${image})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="absolute inset-0 bg-black/60 pointer-events-none" />
      
      {box && (
        <div
          className="absolute border border-white/80 pointer-events-none"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            backgroundImage: `url(${image})`,
            backgroundSize: `${window.innerWidth}px ${window.innerHeight}px`,
            backgroundPosition: `-${box.left}px -${box.top}px`,
            backgroundRepeat: 'no-repeat',
            boxShadow: '0 0 15px rgba(0,0,0,0.5)',
          }}
        />
      )}
      
      <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[11px] px-4 py-2 rounded-full pointer-events-none shadow-xl border border-white/10 font-medium tracking-wide">
        Click and drag to crop • Press Esc to cancel
      </div>
    </div>
  );
}
