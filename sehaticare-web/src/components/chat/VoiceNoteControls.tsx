import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../lib/client';
import { Button } from '../ui/button';

type UploadUrlResponse = {
  upload_url: string;
  upload_session_id: string;
  expires_at: string;
};

type VoiceNoteControlsProps = {
  consultationId: string;
  token: string | null;
  onUnauthorized?: () => void;
  disabled?: boolean;
  onSent?: (voiceNoteId?: string) => void;
  onBusyChange?: (busy: boolean) => void;
  layout?: 'card' | 'toolbar';
  className?: string;
  showStatus?: boolean;
};

const MAX_RECORDING_SECONDS = 30;
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg'
];

const normalizeContentType = (value: string) => {
  const base = value.split(';')[0]?.trim();
  return base || 'audio/webm';
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

const MicIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-5 9V6a5 5 0 0 1 10 0v6a5 5 0 0 1-10 0Zm5 7a7 7 0 0 1-7-7H3a9 9 0 0 0 18 0h-2a7 7 0 0 1-7 7Zm-1 0h2v2h-2v-2Z"
      fill="currentColor"
    />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      d="M3.5 20.5 21 12 3.5 3.5l1.7 6.4 7.8 2.1-7.8 2.1-1.7 6.4Z"
      fill="currentColor"
    />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19l-1.4-1.4L17.6 5l1.4 1.4Z"
      fill="currentColor"
    />
  </svg>
);

const VoiceOverIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      d="M4 9h2v6H4V9Zm4-3h2v12H8V6Zm4 2h2v8h-2V8Zm4-3h2v12h-2V5Zm4 4h2v4h-2V9Z"
      fill="currentColor"
    />
  </svg>
);

export function VoiceNoteControls({
  consultationId,
  token,
  onUnauthorized,
  disabled,
  onSent,
  onBusyChange,
  layout = 'card',
  className,
  showStatus = true
}: VoiceNoteControlsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadStep, setUploadStep] = useState<'uploading' | 'sending' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const discardRef = useRef(false);

  const isBusy = isRecording || uploadStep !== null;

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const cleanupTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stopTimeoutRef.current) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    setError(null);
    if (isRecording) {
      discardRef.current = true;
      stopRecording();
      return;
    }
    setRecordedBlob(null);
    setRecordingSeconds(0);
  }, [isRecording, stopRecording]);

  const startRecording = useCallback(async () => {
    if (disabled || isRecording || uploadStep) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Perangkat ini tidak mendukung perekaman audio.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('Browser tidak mendukung perekaman audio.');
      return;
    }

    try {
      setError(null);
      setRecordedBlob(null);
      setRecordingSeconds(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const recorderMimeType = recorder.mimeType || mimeType || 'audio/webm';

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        setIsRecording(false);
        cleanupTimers();
        cleanupStream();

        const discard = discardRef.current;
        discardRef.current = false;
        if (discard) {
          chunksRef.current = [];
          setRecordedBlob(null);
          setRecordingSeconds(0);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorderMimeType || 'audio/webm' });
        chunksRef.current = [];
        if (!blob.size) {
          setRecordedBlob(null);
          setError('Gagal merekam audio.');
          return;
        }
        setRecordedBlob(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1);
      }, 1000);
      stopTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
      cleanupStream();
      setError(err instanceof Error ? err.message : 'Gagal mengakses mikrofon.');
    }
  }, [cleanupStream, cleanupTimers, disabled, isRecording, stopRecording, uploadStep]);

  const handleSend = useCallback(async () => {
    if (!recordedBlob || !consultationId) return;
    if (!token) {
      setError('Sesi login berakhir. Silakan login kembali.');
      return;
    }

    const contentType = normalizeContentType(recordedBlob.type || 'audio/webm');
    try {
      setError(null);
      setUploadStep('uploading');

      const uploadResponse = await apiFetch<UploadUrlResponse>(
        `/consultations/${consultationId}/voice-notes/upload-url`,
        {
          method: 'POST',
          body: JSON.stringify({ content_type: contentType, file_size_bytes: recordedBlob.size })
        },
        { token, onUnauthorized }
      );

      const uploadResult = await fetch(uploadResponse.upload_url, {
        method: 'PUT',
        body: recordedBlob,
        headers: { 'Content-Type': contentType }
      });

      if (!uploadResult.ok) {
        throw new Error('Gagal mengunggah voice note.');
      }

      setUploadStep('sending');
      const voiceNote = await apiFetch<{ id: string }>(
        `/consultations/${consultationId}/voice-notes/commit`,
        {
          method: 'POST',
          body: JSON.stringify({
            upload_session_id: uploadResponse.upload_session_id,
            content_type: contentType,
            file_size_bytes: recordedBlob.size
          })
        },
        { token, onUnauthorized }
      );

      setUploadStep(null);
      setRecordedBlob(null);
      setRecordingSeconds(0);
      onSent?.(voiceNote?.id);
    } catch (err) {
      setUploadStep(null);
      setError(err instanceof Error ? err.message : 'Gagal mengirim voice note.');
    }
  }, [consultationId, onSent, onUnauthorized, recordedBlob, token]);

  useEffect(() => {
    return () => {
      cleanupTimers();
      cleanupStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [cleanupStream, cleanupTimers]);

  const statusText = useMemo(() => {
    if (isRecording) return `Merekam... ${formatDuration(recordingSeconds)} / 0:${MAX_RECORDING_SECONDS}`;
    if (uploadStep === 'uploading') return 'Mengunggah...';
    if (uploadStep === 'sending') return 'Mengirim...';
    if (recordedBlob) return `Rekaman siap (${formatDuration(recordingSeconds)})`;
    return 'Rekam maksimal 30 detik.';
  }, [isRecording, recordingSeconds, recordedBlob, uploadStep]);

  if (layout === 'toolbar') {
    return (
      <div className={`flex flex-col items-start gap-1 ${className ?? ''}`}>
        <div className="flex items-center gap-2 flex-nowrap">
          {!isRecording && !recordedBlob ? (
            <Button
              size="sm"
              variant="outline"
              onClick={startRecording}
              disabled={disabled || isBusy}
              className="h-10 w-10 shrink-0 p-0"
              aria-label="Rekam voice note"
              title="Rekam voice note"
            >
              <MicIcon />
            </Button>
          ) : null}
          {isRecording ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={stopRecording}
                className="h-10 w-10 shrink-0 p-0"
                aria-label="Stop rekaman"
                title="Stop rekaman"
              >
                <StopIcon />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelRecording}
                className="h-10 w-10 shrink-0 p-0"
                aria-label="Batal rekaman"
                title="Batal rekaman"
              >
                <CloseIcon />
              </Button>
            </>
          ) : null}
          {recordedBlob && !isRecording ? (
            <>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={disabled || isBusy}
                className="h-10 w-10 shrink-0 p-0"
                aria-label="Kirim voice note"
                title="Kirim voice note"
              >
                <SendIcon />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelRecording}
                disabled={isBusy}
                className="h-10 w-10 shrink-0 p-0"
                aria-label="Batalkan rekaman"
                title="Batalkan rekaman"
              >
                <CloseIcon />
              </Button>
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled
            className="h-10 w-10 shrink-0 p-0"
            aria-label="Voice over segera hadir"
            title="Voice over segera hadir"
          >
            <VoiceOverIcon />
          </Button>
        </div>
        {showStatus ? <p className="max-w-[140px] text-[11px] leading-tight text-slate-500">{statusText}</p> : null}
        {error ? <p className="max-w-[160px] text-[11px] leading-tight text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white px-3 py-2 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {!isRecording && !recordedBlob ? (
          <Button size="sm" variant="outline" onClick={startRecording} disabled={disabled || isBusy}>
            Kirim Voice Note
          </Button>
        ) : null}
        {isRecording ? (
          <>
            <Button size="sm" variant="outline" onClick={stopRecording}>
              Stop
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelRecording}>
              Batal
            </Button>
          </>
        ) : null}
        {recordedBlob && !isRecording ? (
          <>
            <Button size="sm" onClick={handleSend} disabled={disabled || isBusy}>
              Kirim Voice Note
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelRecording} disabled={isBusy}>
              Batal
            </Button>
          </>
        ) : null}
      </div>
      {showStatus ? <p className="mt-2 text-xs text-slate-500">{statusText}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
