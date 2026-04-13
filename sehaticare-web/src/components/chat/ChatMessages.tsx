import { memo, useCallback, useRef, useState, type RefObject } from 'react';
import { apiFetch } from '../../lib/client';

type ChatMessage = {
  id: string;
  sender_role: 'PASIEN' | 'DOKTER' | 'AI';
  content: string;
  created_at: string;
  voice_note_id?: string | null;
  voiceNoteId?: string | null;
  voice_note?: {
    id?: string | null;
    download_url?: string | null;
  } | null;
};

type ChatMessagesProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  emptyText: string;
  selfRole: 'PASIEN' | 'DOKTER';
  endRef: RefObject<HTMLDivElement>;
  token?: string | null;
  onUnauthorized?: () => void;
  voiceNoteByMessageId?: Record<string, string>;
};

export const ChatMessages = memo(function ChatMessages({
  messages,
  isLoading,
  emptyText,
  selfRole,
  endRef,
  token,
  onUnauthorized,
  voiceNoteByMessageId
}: ChatMessagesProps) {
  return (
    <div className="space-y-2">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="h-2 w-2 animate-ping rounded-full bg-brand" />
          <span>Memuat percakapan...</span>
        </div>
      ) : messages.length === 0 ? (
        <p className="text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            msg={msg}
            selfRole={selfRole}
            token={token}
            onUnauthorized={onUnauthorized}
            voiceNoteByMessageId={voiceNoteByMessageId}
          />
        ))
      )}
      <div ref={endRef} />
    </div>
  );
});

type ChatMessageItemProps = {
  msg: ChatMessage;
  selfRole: 'PASIEN' | 'DOKTER';
  token?: string | null;
  onUnauthorized?: () => void;
  voiceNoteByMessageId?: Record<string, string>;
};

const formatDuration = (seconds: number | null) => {
  if (!seconds || Number.isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${mins}:${secs}`;
};

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const VOICE_NOTE_ID_PATTERN = /(?:voice[-_ ]?note|VOICE_NOTE)\s*[:=]\s*([0-9a-f-]{36})/i;
const VOICE_NOTE_BRACKET_PATTERN = /\[VOICE_NOTE[:=]([^\]]+)\]/i;
const VOICE_NOTE_MARKER = /voice[-_ ]?note|\[voice_note/i;

const extractVoiceNoteIdFromContent = (value?: string | null) => {
  if (!value) return null;
  const bracketMatch = value.match(VOICE_NOTE_BRACKET_PATTERN);
  if (bracketMatch?.[1] && UUID_PATTERN.test(bracketMatch[1])) return bracketMatch[1];
  const directMatch = value.match(VOICE_NOTE_ID_PATTERN);
  if (directMatch?.[1]) return directMatch[1];
  if (!VOICE_NOTE_MARKER.test(value)) return null;
  const uuidMatch = value.match(UUID_PATTERN);
  return uuidMatch ? uuidMatch[0] : null;
};

const extractVoiceNoteIdFromMeta = (meta: Record<string, unknown>) => {
  const direct =
    meta.voiceNoteId ?? meta.voice_note_id ?? (meta.voiceNote && (meta.voiceNote as { id?: unknown }).id) ?? null;
  return typeof direct === 'string' && UUID_PATTERN.test(direct) ? direct : null;
};

const extractVoiceNoteIdFromAttachments = (attachments: unknown) => {
  if (!Array.isArray(attachments)) return null;
  for (const entry of attachments) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const direct =
      record.voiceNoteId ??
      record.voice_note_id ??
      (record.voiceNote && (record.voiceNote as { id?: unknown }).id) ??
      (record.voice_note && (record.voice_note as { id?: unknown }).id) ??
      null;
    if (typeof direct === 'string' && UUID_PATTERN.test(direct)) return direct;
    const type = String(record.type ?? record.kind ?? '').toLowerCase();
    if (type.includes('voice') && type.includes('note')) {
      const id = record.id;
      if (typeof id === 'string' && UUID_PATTERN.test(id)) return id;
    }
  }
  return null;
};

const resolveVoiceNoteId = (msg: ChatMessage, voiceNoteByMessageId?: Record<string, string>) => {
  if (msg.voiceNoteId && UUID_PATTERN.test(msg.voiceNoteId)) return msg.voiceNoteId;
  if (msg.voice_note_id && UUID_PATTERN.test(msg.voice_note_id)) return msg.voice_note_id;
  if (msg.voice_note?.id && UUID_PATTERN.test(msg.voice_note.id)) return msg.voice_note.id;
  if (voiceNoteByMessageId?.[msg.id]) return voiceNoteByMessageId[msg.id];

  const anyMsg = msg as Record<string, unknown>;
  const metaId = anyMsg.metadata && typeof anyMsg.metadata === 'object' ? extractVoiceNoteIdFromMeta(anyMsg.metadata as Record<string, unknown>) : null;
  if (metaId) return metaId;
  const metaAlt = anyMsg.meta && typeof anyMsg.meta === 'object' ? extractVoiceNoteIdFromMeta(anyMsg.meta as Record<string, unknown>) : null;
  if (metaAlt) return metaAlt;
  const attachmentId = extractVoiceNoteIdFromAttachments(anyMsg.attachments);
  if (attachmentId) return attachmentId;

  const contentText = typeof anyMsg.content_text === 'string' ? anyMsg.content_text : null;
  const parsedFromContent = extractVoiceNoteIdFromContent(msg.content) ?? extractVoiceNoteIdFromContent(contentText);
  return parsedFromContent;
};

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="m8 5 12 7-12 7V5Z" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" fill="currentColor" />
  </svg>
);

const VoiceNoteBubble = memo(function VoiceNoteBubble({
  voiceNoteId,
  initialUrl,
  isSelf,
  token,
  onUnauthorized
}: {
  voiceNoteId: string | null;
  initialUrl?: string | null;
  isSelf: boolean;
  token?: string | null;
  onUnauthorized?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(initialUrl ?? null);

  const handleToggle = useCallback(async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      return;
    }
    if (!voiceNoteId && !downloadUrl) {
      setError('Voice note tidak tersedia.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      let url = downloadUrl;
      if (!url && voiceNoteId) {
        const response = await apiFetch<{ download_url: string }>(
          `/voice-notes/${voiceNoteId}`,
          {},
          { token, onUnauthorized }
        );
        url = response.download_url;
        setDownloadUrl(url);
      }
      if (!url) {
        setError('Voice note tidak tersedia.');
        return;
      }
      if (audioRef.current.src !== url) {
        audioRef.current.src = url;
      }
      await audioRef.current.play();
    } catch {
      setError('Gagal memutar.');
    } finally {
      setIsLoading(false);
    }
  }, [downloadUrl, isPlaying, onUnauthorized, token, voiceNoteId]);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleToggle}
        className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm ${
          isSelf ? 'border border-white/30 bg-white/10 text-white' : 'border border-slate-200 bg-white text-slate-700'
        }`}
        aria-label={isPlaying ? 'Jeda voice note' : 'Putar voice note'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="min-w-0">
        <div className={`flex items-center gap-2 text-[11px] ${isSelf ? 'text-white/80' : 'text-slate-600'}`}>
          <span>{isLoading ? 'Memuat...' : isPlaying ? 'Memutar' : 'Voice note'}</span>
          <span className={isSelf ? 'text-white/60' : 'text-slate-400'}>{formatDuration(duration)}</span>
        </div>
        {error ? <div className={`text-[11px] ${isSelf ? 'text-white/80' : 'text-red-600'}`}>{error}</div> : null}
      </div>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? null)}
      />
    </div>
  );
});

const ChatMessageItem = memo(
  function ChatMessageItem({ msg, selfRole, token, onUnauthorized, voiceNoteByMessageId }: ChatMessageItemProps) {
    const isSelf = msg.sender_role === selfRole;
    const isAi = msg.sender_role === 'AI';
    const voiceNoteId = resolveVoiceNoteId(msg, voiceNoteByMessageId);
    const anyMsg = msg as Record<string, unknown>;
    const contentText = typeof anyMsg.content_text === 'string' ? anyMsg.content_text : null;
    const isVoiceNote =
      Boolean(voiceNoteId) ||
      msg.content === '[VOICE_NOTE]' ||
      (typeof contentText === 'string' && VOICE_NOTE_MARKER.test(contentText)) ||
      VOICE_NOTE_MARKER.test(msg.content);
    const initialUrl = msg.voice_note?.download_url ?? null;
    if (isVoiceNote) {
      return (
        <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
              isSelf
                ? 'bg-brand text-white'
                : isAi
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border border-slate-200 bg-white text-slate-800'
            }`}
          >
            <VoiceNoteBubble
              voiceNoteId={voiceNoteId}
              initialUrl={initialUrl}
              isSelf={isSelf}
              token={token}
              onUnauthorized={onUnauthorized}
            />
            <span
              className={`mt-1 block text-[10px] ${isSelf ? 'text-white/80' : isAi ? 'text-emerald-700/70' : 'text-slate-500'}`}
            >
              {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
            isSelf
              ? 'bg-brand text-white'
              : isAi
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border border-slate-200 bg-white text-slate-800'
          }`}
        >
          {isAi ? (
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-emerald-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              <span>Asisten Edukasi</span>
            </div>
          ) : null}
          <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
          <span
            className={`mt-1 block text-[10px] ${isSelf ? 'text-white/80' : isAi ? 'text-emerald-700/70' : 'text-slate-500'}`}
          >
            {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.msg === next.msg &&
    prev.selfRole === next.selfRole &&
    prev.token === next.token &&
    prev.onUnauthorized === next.onUnauthorized &&
    prev.voiceNoteByMessageId === next.voiceNoteByMessageId
);
