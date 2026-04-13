import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../../lib/client';
import { useMessagesPolling } from '../../hooks/useMessagesPolling';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { ChatMessages } from '../../components/chat/ChatMessages';
import { VoiceNoteControls } from '../../components/chat/VoiceNoteControls';

type ConsultationDetail = {
  id: string;
  status: string;
  initial_complaint: string;
  opened_at: string;
  assignedDoctorId?: string | null;
  ai_enabled?: boolean;
  closeRequested?: boolean;
  closeRequestedAt?: string | null;
  consent_at?: string | null;
  consent_version?: string | null;
  red_flag?: boolean;
  red_flag_reason?: string | null;
  priority?: number;
};

type ChatMessage = {
  id: string;
  sender_role: 'PASIEN' | 'DOKTER' | 'AI';
  content: string;
  created_at: string;
  voice_note_id?: string | null;
  voiceNoteId?: string | null;
  voice_note?: { id?: string | null; download_url?: string | null } | null;
};

const getLatestMessageTimestamp = (items: ChatMessage[]) => {
  let latestIso: string | null = null;
  let latestTime = -1;
  for (const message of items) {
    const time = Date.parse(message.created_at);
    if (!Number.isFinite(time)) continue;
    if (time > latestTime) {
      latestTime = time;
      latestIso = message.created_at;
    }
  }
  return latestIso;
};

const mergeMessagesById = (prev: ChatMessage[], incoming: ChatMessage[]) => {
  if (prev.length === 0) return incoming;
  const mergedById = new Map<string, ChatMessage>();
  let changed = false;

  for (const message of prev) {
    mergedById.set(message.id, message);
  }

  const appended: ChatMessage[] = [];
  for (const message of incoming) {
    const existing = mergedById.get(message.id);
    if (!existing) {
      mergedById.set(message.id, message);
      appended.push(message);
      changed = true;
      continue;
    }
    if (
      existing.content !== message.content ||
      existing.sender_role !== message.sender_role ||
      existing.created_at !== message.created_at
    ) {
      mergedById.set(message.id, message);
      changed = true;
    }
  }

  const merged = prev.map((message) => mergedById.get(message.id) ?? message);
  for (const message of appended) {
    merged.push(message);
  }

  if (!changed && merged.length === prev.length) {
    return prev;
  }

  return merged;
};

type VoiceNoteStore = {
  pending: { id: string; sentAt: number }[];
  resolved: Record<string, string>;
};

const readVoiceNoteStore = (consultationId: string): VoiceNoteStore => {
  if (typeof window === 'undefined') return { pending: [], resolved: {} };
  try {
    const raw = window.localStorage.getItem(`sehaticare.voiceNotes.${consultationId}`);
    if (!raw) return { pending: [], resolved: {} };
    const parsed = JSON.parse(raw) as { pending?: unknown; resolved?: unknown };
    const pending = Array.isArray(parsed?.pending)
      ? parsed.pending.filter(
          (item): item is { id: string; sentAt: number } =>
            Boolean(item) &&
            typeof (item as { id?: unknown }).id === 'string' &&
            typeof (item as { sentAt?: unknown }).sentAt === 'number'
        )
      : [];
    const resolved: Record<string, string> = {};
    if (parsed?.resolved && typeof parsed.resolved === 'object') {
      for (const [key, value] of Object.entries(parsed.resolved as Record<string, unknown>)) {
        if (typeof key === 'string' && typeof value === 'string') {
          resolved[key] = value;
        }
      }
    }
    return { pending, resolved };
  } catch {
    return { pending: [], resolved: {} };
  }
};

const writeVoiceNoteStore = (consultationId: string, store: VoiceNoteStore) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`sehaticare.voiceNotes.${consultationId}`, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
};

export function PatientConsultationDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, handleUnauthorized } = useAuth();
  const [data, setData] = useState<ConsultationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshingHint, setShowRefreshingHint] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [aiTyping, setAiTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [closeRequesting, setCloseRequesting] = useState(false);
  const [closeRequestError, setCloseRequestError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [voiceNoteByMessageId, setVoiceNoteByMessageId] = useState<Record<string, string>>({});
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef(0);
  const lastMessageAtRef = useRef<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const isInputFocusedRef = useRef(false);
  const justSentRef = useRef(false);
  const didInitialScrollRef = useRef(false);
  const pollStatsRef = useRef({ recentNew: [] as boolean[], consecutiveNoNew: 0 });
  const messagesRequestId = useRef(0);
  const inFlightRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingVoiceNotesRef = useRef<{ id: string; sentAt: number }[]>([]);
  const voiceNoteByMessageIdRef = useRef<Record<string, string>>({});
  const isAiActive = data?.status === 'MENUNGGU_DOKTER' || data?.status === 'AI_AKTIF';
  const showAiInactiveNotice = data?.status === 'DOKTER_AKTIF' || data?.status === 'SELESAI';
  const canRequestClose = Boolean(data && data.status !== 'SELESAI');
  const hasConsent = Boolean(data?.consent_at);
  const isRedFlag = Boolean(data?.red_flag);
  const showStatusBar = showRefreshingHint;

  const updateNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distance < 120;
    if (nearBottom === isNearBottomRef.current) return;
    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setUnreadCount(0);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setIsNearBottom(true);
    setUnreadCount(0);
  }, []);

  const getNextPollDelay = useCallback(() => {
    const isTabActive = document.visibilityState === 'visible';
    const nearBottom = isNearBottomRef.current;
    const consecutiveNoNew = pollStatsRef.current.consecutiveNoNew;
    const recentNew = pollStatsRef.current.recentNew;
    if (!isTabActive || !nearBottom || consecutiveNoNew >= 3) {
      return 12000;
    }
    if (recentNew.length >= 2 && recentNew[recentNew.length - 1] && recentNew[recentNew.length - 2]) {
      return 2500;
    }
    return 3000;
  }, []);

  const loadDetail = useCallback(async () => {
    if (!id) {
      setError('Konsultasi tidak ditemukan.');
      setLoading(false);
      return;
    }
    try {
      if (!data) setLoading(true);
      setError(null);
      const response = await apiFetch<ConsultationDetail>(
        `/consultations/${id}`,
        {},
        { token, onUnauthorized: handleUnauthorized }
      );
      setData(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (!data) setLoading(false);
    }
  }, [data, handleUnauthorized, id, token]);

  const loadMessages = useCallback(async (options?: { silent?: boolean; signal?: AbortSignal }) => {
    if (!id) return;
    if (inFlightRef.current) return;
    const requestId = ++messagesRequestId.current;
    const isInitial = initialLoading && !options?.silent;
    const shouldRefresh = !isInitial;
    const shouldRefreshUI = shouldRefresh && !options?.silent;
    const shouldFetchIncremental = Boolean(options?.silent && lastMessageAtRef.current);

    if (isInitial) {
      setShowRefreshingHint(true);
    } else if (shouldRefreshUI) {
      setIsRefreshing(true);
      setShowRefreshingHint(true);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (refreshHintTimeoutRef.current) clearTimeout(refreshHintTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 300);
      refreshHintTimeoutRef.current = setTimeout(() => setShowRefreshingHint(false), 1200);
    }

    inFlightRef.current = true;
    try {
      setMessagesError(null);
      const query = shouldFetchIncremental ? `?after=${encodeURIComponent(lastMessageAtRef.current as string)}` : '';
      const response = await apiFetch<{ messages: ChatMessage[]; ai_typing?: boolean }>(
        `/consultations/${id}/messages${query}`,
        { signal: options?.signal },
        { token, onUnauthorized: handleUnauthorized }
      );
      if (requestId !== messagesRequestId.current) return;
      if (options?.signal?.aborted) return;
      if (options?.silent) {
        const hadNew = response.messages.length > 0;
        const stats = pollStatsRef.current;
        stats.consecutiveNoNew = hadNew ? 0 : stats.consecutiveNoNew + 1;
        stats.recentNew.push(hadNew);
        if (stats.recentNew.length > 2) stats.recentNew.shift();
        if (hadNew && (!isNearBottomRef.current || isInputFocusedRef.current) && !justSentRef.current) {
          setUnreadCount((prev) => prev + response.messages.length);
        }
      }
      setMessages((prev) => {
        const merged = shouldFetchIncremental ? mergeMessagesById(prev, response.messages) : response.messages;
        const latest = getLatestMessageTimestamp(merged);
        if (latest) {
          lastMessageAtRef.current = latest;
        }
        return merged;
      });
      if (typeof response.ai_typing === 'boolean') {
        setAiTyping(response.ai_typing);
      }
    } catch (err) {
      if (requestId !== messagesRequestId.current) return;
      if (options?.signal?.aborted) return;
      setMessagesError((err as Error).message);
    } finally {
      inFlightRef.current = false;
      if (requestId !== messagesRequestId.current) return;
      if (isInitial) {
        setInitialLoading(false);
        setShowRefreshingHint(false);
      }
      if (shouldRefreshUI) {
        setIsRefreshing(false);
      }
    }
  }, [handleUnauthorized, id, initialLoading, token]);

  const loadDetailRef = useRef(loadDetail);
  const loadMessagesRef = useRef(loadMessages);

  useEffect(() => {
    loadDetailRef.current = loadDetail;
  }, [loadDetail]);

  useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (refreshHintTimeoutRef.current) {
        clearTimeout(refreshHintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadDetail();
    loadMessages();
  }, [loadDetail, loadMessages]);

  useEffect(() => {
    didInitialScrollRef.current = false;
    if (!id) {
      pendingVoiceNotesRef.current = [];
      voiceNoteByMessageIdRef.current = {};
      setVoiceNoteByMessageId({});
      return;
    }
    const store = readVoiceNoteStore(id);
    pendingVoiceNotesRef.current = store.pending;
    voiceNoteByMessageIdRef.current = store.resolved;
    setVoiceNoteByMessageId(store.resolved);
  }, [id]);

  useMessagesPolling({
    consultationId: id,
    getDelay: getNextPollDelay,
    loadMessages,
    loadDetail: () => loadDetailRef.current(),
    detailIntervalMs: 8000,
    initialDelayMs: 3000,
    hiddenDelayMs: 3000
  });

  const attachPendingVoiceNotes = useCallback((items: ChatMessage[]) => {
    if (pendingVoiceNotesRef.current.length === 0) return;
    const nextMap = { ...voiceNoteByMessageIdRef.current };
    const candidates = items
      .filter((message) => message.content === '[VOICE_NOTE]' && !nextMap[message.id])
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    if (candidates.length === 0) return;

    let changed = false;
    const remaining: { id: string; sentAt: number }[] = [];
    for (const pending of pendingVoiceNotesRef.current) {
      const matchIndex = candidates.findIndex((message) => {
        const time = Date.parse(message.created_at);
        return Number.isFinite(time) && time >= pending.sentAt - 5000;
      });
      if (matchIndex === -1) {
        remaining.push(pending);
        continue;
      }
      const match = candidates.splice(matchIndex, 1)[0];
      if (match) {
        nextMap[match.id] = pending.id;
        changed = true;
      }
    }

    pendingVoiceNotesRef.current = remaining;
    if (changed) {
      voiceNoteByMessageIdRef.current = nextMap;
      setVoiceNoteByMessageId(nextMap);
    }
    if (id) {
      writeVoiceNoteStore(id, { pending: pendingVoiceNotesRef.current, resolved: voiceNoteByMessageIdRef.current });
    }
  }, [id]);

  useEffect(() => {
    const hasNew = messages.length > lastMessageCountRef.current;
    if (hasNew) {
      const shouldAutoScroll =
        justSentRef.current || (isNearBottomRef.current && !isInputFocusedRef.current);
      if (shouldAutoScroll) {
        scrollToBottom('smooth');
      }
      justSentRef.current = false;
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    updateNearBottom();
  }, [messages.length, updateNearBottom]);

  useEffect(() => {
    if (initialLoading) return;
    if (didInitialScrollRef.current) return;
    if (messages.length === 0) return;
    scrollToBottom('auto');
    didInitialScrollRef.current = true;
  }, [initialLoading, messages.length, scrollToBottom]);

  useEffect(() => {
    attachPendingVoiceNotes(messages);
  }, [attachPendingVoiceNotes, messages]);

  const handleSend = useCallback(async (text: string) => {
    if (!id) return;
    setSending(true);
    setSendError(null);
    try {
      justSentRef.current = true;
      const created = await apiFetch<ChatMessage>(
        `/consultations/${id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content: text })
        },
        { token, onUnauthorized: handleUnauthorized }
      );
      setMessages((prev) => mergeMessagesById(prev, [created]));
      loadMessages();
    } catch (err) {
      setSendError((err as Error).message);
      throw err;
    } finally {
      setSending(false);
    }
  }, [handleUnauthorized, id, loadMessages, token]);

  const handleVoiceNoteSent = useCallback((voiceNoteId?: string) => {
    if (voiceNoteId) {
      pendingVoiceNotesRef.current.push({ id: voiceNoteId, sentAt: Date.now() });
      if (id) {
        writeVoiceNoteStore(id, { pending: pendingVoiceNotesRef.current, resolved: voiceNoteByMessageIdRef.current });
      }
    }
    loadMessagesRef.current({ silent: false });
  }, [id]);

  const handleRequestClose = async () => {
    if (!id || !canRequestClose || closeRequesting) return;
    const confirmed = window.confirm(
      'Anda yakin ingin meminta konsultasi diakhiri? Dokter akan meninjau dan menutup konsultasi.'
    );
    if (!confirmed) return;
    setCloseRequesting(true);
    setCloseRequestError(null);
    try {
      const response = await apiFetch<{ id: string; closeRequested: boolean; closeRequestedAt: string | null }>(
        `/consultations/${id}/request-close`,
        { method: 'POST' },
        { token, onUnauthorized: handleUnauthorized }
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              closeRequested: response.closeRequested,
              closeRequestedAt: response.closeRequestedAt
            }
          : prev
      );
    } catch (err) {
      setCloseRequestError((err as Error).message);
    } finally {
      setCloseRequesting(false);
    }
  };

  const handleConsent = async () => {
    if (!id || hasConsent || !consentChecked || consentSubmitting) return;
    setConsentSubmitting(true);
    setConsentError(null);
    try {
      const response = await apiFetch<{ id: string; consent_at: string | null; consent_version: string | null }>(
        `/consultations/${id}/consent`,
        { method: 'POST', body: JSON.stringify({ consent: true }) },
        { token, onUnauthorized: handleUnauthorized }
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              consent_at: response.consent_at,
              consent_version: response.consent_version
            }
          : prev
      );
      setConsentChecked(false);
    } catch (err) {
      setConsentError((err as Error).message);
    } finally {
      setConsentSubmitting(false);
    }
  };

  const renderMessages = () => (
    <ChatMessages
      messages={messages}
      isLoading={initialLoading}
      emptyText="Belum ada pesan. Mulai ceritakan keluhan Anda."
      selfRole="PASIEN"
      endRef={endRef}
      token={token}
      onUnauthorized={handleUnauthorized}
      voiceNoteByMessageId={voiceNoteByMessageId}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Sesi Konsultasi</p>
          <h1 className="text-2xl font-semibold text-slate-900">{data?.id ? `ID: ${data.id}` : 'Memuat...'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data?.status ? <Badge variant="outline">{data.status}</Badge> : null}
          {canRequestClose ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRequestClose}
              disabled={closeRequesting || data?.closeRequested}
            >
              {data?.closeRequested ? 'Permintaan penutupan terkirim' : 'Minta Akhiri Konsultasi'}
            </Button>
          ) : null}
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="h-2 w-2 animate-ping rounded-full bg-brand" />
            <span className="text-sm text-slate-600">Memuat detail konsultasi...</span>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Gagal memuat</CardTitle>
            <CardDescription className="text-amber-700">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/patient">
              <Button variant="outline" size="sm">
                Kembali
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          {closeRequestError ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-amber-800">Permintaan gagal</CardTitle>
                <CardDescription className="text-amber-700">{closeRequestError}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Keluhan awal</CardTitle>
              <CardDescription>Dibuka pada {new Date(data.opened_at).toLocaleString('id-ID')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{data.initial_complaint}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chat Konsultasi</CardTitle>
              <CardDescription>Komunikasi teks dengan tim medis</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-col gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Asisten ini bersifat edukatif & pendampingan awal, bukan pengganti dokter.
              </div>
              {isRedFlag ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Kami sarankan segera berbicara dengan dokter. Jika darurat, hubungi layanan darurat setempat.
                </div>
              ) : null}
              {showAiInactiveNotice ? (
                <div className="text-xs text-slate-500">Asisten nonaktif saat dokter menangani.</div>
              ) : null}
              {!hasConsent ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Persetujuan sebelum chat</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Saya memahami bahwa asisten ini bersifat edukatif dan bukan diagnosis medis.
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      checked={consentChecked}
                      onChange={(event) => setConsentChecked(event.target.checked)}
                    />
                    <span>Saya memahami informasi di atas.</span>
                  </label>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={handleConsent} disabled={!consentChecked || consentSubmitting}>
                      {consentSubmitting ? 'Menyimpan...' : 'Saya Setuju & Mulai Chat'}
                    </Button>
                    {consentError ? <span className="text-xs text-red-600">{consentError}</span> : null}
                  </div>
                </div>
              ) : null}
              {messagesError ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span>{messagesError}</span>
                  <Button size="sm" variant="outline" onClick={() => loadMessages()}>
                    Coba lagi
                  </Button>
                </div>
              ) : null}
              <div className="flex min-h-[420px] max-h-[70vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="px-4 pt-3">
                  <div className="min-h-[16px]">
                    <p
                      className={`text-xs text-slate-500 transition-opacity duration-200 ${
                        showStatusBar ? 'visible opacity-100' : 'invisible opacity-0'
                      }`}
                    >
                      Memperbarui percakapan...
                    </p>
                  </div>
                </div>
                <div className="relative flex flex-1 min-h-0 flex-col">
                  <div
                    ref={messagesContainerRef}
                    onScroll={updateNearBottom}
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-3 pb-[120px]"
                  >
                    {renderMessages()}
                  </div>
                  {unreadCount > 0 && !isNearBottom ? (
                    <div className="pointer-events-none absolute bottom-[96px] right-4 z-10 flex justify-end">
                      <button
                        type="button"
                        onClick={() => scrollToBottom('smooth')}
                        className="pointer-events-auto rounded-full border border-brand/30 bg-white px-3 py-1 text-xs font-medium text-brand shadow-md"
                      >
                        Pesan baru ({unreadCount})
                      </button>
                    </div>
                  ) : null}
                </div>
                {aiTyping && isAiActive && hasConsent && !isRedFlag ? (
                  <div className="px-4 pb-2">
                    <div className="inline-flex rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">
                      Asisten sedang menulis...
                    </div>
                  </div>
                ) : null}
                <div className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
                  <ChatComposer
                    onSend={handleSend}
                    onFocusChange={(focused) => {
                      isInputFocusedRef.current = focused;
                    }}
                    leading={
                      id ? (
                        <VoiceNoteControls
                          consultationId={id}
                          token={token}
                          onUnauthorized={handleUnauthorized}
                          disabled={sending || !hasConsent}
                          onSent={handleVoiceNoteSent}
                          onBusyChange={setVoiceBusy}
                          layout="toolbar"
                          className="shrink-0"
                        />
                      ) : null
                    }
                    disabled={sending || !hasConsent || voiceBusy}
                    disabledLabel={
                      !hasConsent ? 'Butuh persetujuan' : voiceBusy ? 'Sedang voice note' : 'Mengirim...'
                    }
                    errorMessage={sendError}
                    placeholder="Contoh: Halo dokter, saya masih demam sejak kemarin."
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div>
        <Link to="/patient">
          <Button variant="secondary">Kembali ke dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
