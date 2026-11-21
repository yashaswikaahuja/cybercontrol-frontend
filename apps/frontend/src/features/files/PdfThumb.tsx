/**
 * PDF tile thumbnail.
 * Fast path: Hub `/drive/thumb` (Drive's small JPEG).
 * Fallback: pdf.js page-1 raster of the full download, queued and only when visible.
 */
import { useEffect, useRef, useState } from 'react';
import { FilePdf, SpinnerGap } from '@phosphor-icons/react';
import api, { API_URL } from '../../shared/api';
import { getCachedBlob } from '../../shared/fileCache';
import { useAuthStore } from '../auth/store';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const thumbCache = new Map<string, string>();
const RASTER_CONCURRENCY = 2;
let rasterActive = 0;
const rasterWait: Array<() => void> = [];

function enqueueRaster<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const kick = () => {
      rasterActive++;
      fn().then(resolve, reject).finally(() => {
        rasterActive--;
        const next = rasterWait.shift();
        if (next) next();
      });
    };
    if (rasterActive < RASTER_CONCURRENCY) kick();
    else rasterWait.push(kick);
  });
}

function sniffPdf(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function hubThumbUrl(fileId: string): string | null {
  if (!fileId) return null;
  const token = useAuthStore.getState().accessToken || '';
  if (!token) return null;
  return `${API_URL}/drive/thumb/${fileId}?token=${encodeURIComponent(token)}`;
}

async function rasterPdfPage(fileId: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

  const blob = await getCachedBlob(fileId, async () => {
    const res = await api.get(`/drive/download/${fileId}`, {
      responseType: 'blob',
      skipErrorToast: true,
    } as any);
    return new Blob([res.data], { type: String(res.headers['content-type'] ?? 'application/pdf') });
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!sniffPdf(bytes)) throw new Error('not_pdf');

  const pdf = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    verbosity: 0,
  }).promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.45 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no_canvas');
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    try { await (pdf as any).cleanup?.(); } catch { /* stay */ }
  }
}

export default function PdfThumb({
  fileId,
  driveThumbUrl,
  className = '',
  variant = 'dark',
}: {
  fileId: string;
  /** Optional extra URL while pdf.js loads — Google Drive thumbnail hosts 403 in-app. */
  driveThumbUrl?: string;
  className?: string;
  /** Paper tiles (Documents) vs dark wells (File Manager). */
  variant?: 'paper' | 'dark';
}) {
  const hubUrl = hubThumbUrl(fileId);
  const [src, setSrc] = useState<string | null>(() => thumbCache.get(fileId) || null);
  const [failed, setFailed] = useState(false);
  const [hubBroken, setHubBroken] = useState(!hubUrl);
  const [hubReady, setHubReady] = useState(false);
  const [driveBroken, setDriveBroken] = useState(false);
  const [visible, setVisible] = useState(false);
  const wellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thumbCache.has(fileId)) {
      setSrc(thumbCache.get(fileId)!);
      return;
    }
    setSrc(null);
    setFailed(false);
    setHubBroken(!hubThumbUrl(fileId));
    setHubReady(false);
    setDriveBroken(false);
    setVisible(false);
  }, [fileId]);

  useEffect(() => {
    if (src || visible) return;
    const el = wellRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    }, { rootMargin: '140px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [src, visible, hubBroken, failed]);

  useEffect(() => {
    if (src || !hubBroken || !visible || failed) return;
    if (thumbCache.has(fileId)) {
      setSrc(thumbCache.get(fileId)!);
      return;
    }
    let cancelled = false;
    enqueueRaster(async () => {
      if (cancelled) return;
      try {
        const dataUrl = await rasterPdfPage(fileId);
        thumbCache.set(fileId, dataUrl);
        if (!cancelled) setSrc(dataUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    });
    return () => { cancelled = true; };
  }, [fileId, hubBroken, visible, src, failed]);

  const well =
    variant === 'paper'
      ? 'w-full h-full flex items-center justify-center bg-[hsl(var(--pt-secondary))]'
      : 'w-full h-full flex items-center justify-center bg-[#2a1515]';

  if (src) {
    return (
      <img
        src={src}
        alt=""
        data-pdf-thumb={fileId}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  if (hubUrl && !hubBroken) {
    return (
      <img
        src={hubUrl}
        alt=""
        data-pdf-thumb={hubReady ? fileId : undefined}
        className={`w-full h-full object-cover ${className}`}
        loading="lazy"
        onLoad={() => setHubReady(true)}
        onError={() => setHubBroken(true)}
      />
    );
  }

  // Google Drive thumbnail URLs 403 in-app; only use Hub-authenticated URLs.
  const usableDriveThumb = driveThumbUrl && !/drive\.google\.com\/thumbnail/i.test(driveThumbUrl);
  if (!failed && usableDriveThumb && !driveBroken) {
    return (
      <img
        src={driveThumbUrl}
        alt=""
        className={`w-full h-full object-cover ${className}`}
        onError={() => setDriveBroken(true)}
      />
    );
  }

  if (!failed) {
    return (
      <div ref={wellRef} className={well} data-pdf-thumb-loading={fileId}>
        <SpinnerGap
          size={22}
          className={variant === 'paper' ? 'animate-spin text-[hsl(0_65%_48%/0.7)]' : 'animate-spin text-red-300/80'}
        />
      </div>
    );
  }

  return (
    <div className={well}>
      <FilePdf size={36} className={variant === 'paper' ? 'text-[hsl(0_65%_48%)]' : 'text-red-400'} weight="fill" />
    </div>
  );
}
