import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeImageProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

export const QRCodeImage: React.FC<QRCodeImageProps> = ({
  value,
  size = 180,
  className = '',
  alt = 'QR Code',
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!value) return;

    let isMounted = true;
    QRCode.toDataURL(value, {
      width: size * 2, // High resolution for crisp rendering & camera scanning
      margin: 1,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
          setError(false);
        }
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
        if (isMounted) {
          setError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (error || !dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs font-mono p-2 border border-slate-200 ${className}`}
      >
        <span>QR: {value}</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt || `QR Code for ${value}`}
      style={{ width: size, height: size }}
      className={`object-contain rounded-lg shadow-2xs ${className}`}
    />
  );
};
