import { CheckCircle, Warning } from '@phosphor-icons/react';

interface QrOutcome { status?: string; signature?: string; reason?: string }

/** Plain-language result of the server's Aadhaar QR step (suggestions.document_type.qr). */
export function qrNoteFor(qr: QrOutcome | undefined): { tone: 'ok' | 'warn'; text: string } | null {
  if (!qr?.status) return null;
  if (qr.status === 'used') {
    if (qr.signature === 'valid') return { tone: 'ok', text: 'Address read from the Aadhaar QR and verified with UIDAI.' };
    if (qr.signature === 'unsigned') return { tone: 'ok', text: 'Address read from the Aadhaar QR (older card, no signature).' };
    return { tone: 'ok', text: 'Address read from the Aadhaar QR.' };
  }
  if (qr.status === 'rejected') {
    return { tone: 'warn', text: 'The Aadhaar QR failed the UIDAI signature check, so it was ignored. The address below is from the printed text.' };
  }
  if (qr.status === 'failed' && qr.reason === 'qr_unreadable') {
    return { tone: 'warn', text: 'Aadhaar QR found but too blurry to read. The address below is from the printed text. Check it, or ask for a clearer photo sent as a document, or the e-Aadhaar PDF.' };
  }
  if (qr.status === 'failed') {
    return { tone: 'warn', text: 'Could not read the Aadhaar QR. The address below is from the printed text. Please check it.' };
  }
  return { tone: 'warn', text: 'No Aadhaar QR found in this image. The address below is from the printed text. Please check it.' };
}

export function QrNote({ suggestions }: { suggestions: Record<string, any> }) {
  const note = qrNoteFor(suggestions?.document_type?.qr);
  if (!note) return null;
  const ok = note.tone === 'ok';
  const Icon = ok ? CheckCircle : Warning;
  return (
    <p
      role="status"
      className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 mb-3"
      style={ok
        ? { color: 'hsl(var(--confidence))', background: 'hsl(var(--confidence) / 0.08)', border: '1px solid hsl(var(--confidence) / 0.25)' }
        : { color: 'hsl(35 92% 32%)', background: 'hsl(35 92% 48% / 0.10)', border: '1px solid hsl(35 92% 48% / 0.30)' }}
    >
      <Icon size={14} weight="fill" className="shrink-0 mt-px" aria-hidden="true" />
      <span>{note.text}</span>
    </p>
  );
}
