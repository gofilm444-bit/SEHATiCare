import { memo, type RefObject } from 'react';

type ChatMessage = {
  id: string;
  sender_role: 'PASIEN' | 'DOKTER' | 'AI';
  content: string;
  created_at: string;
};

type ChatMessagesProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  emptyText: string;
  selfRole: 'PASIEN' | 'DOKTER';
  endRef: RefObject<HTMLDivElement>;
};

export const ChatMessages = memo(function ChatMessages({
  messages,
  isLoading,
  emptyText,
  selfRole,
  endRef
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
        messages.map((msg) => <ChatMessageItem key={msg.id} msg={msg} selfRole={selfRole} />)
      )}
      <div ref={endRef} />
    </div>
  );
});

type ChatMessageItemProps = {
  msg: ChatMessage;
  selfRole: 'PASIEN' | 'DOKTER';
};

const ChatMessageItem = memo(
  function ChatMessageItem({ msg, selfRole }: ChatMessageItemProps) {
    const isSelf = msg.sender_role === selfRole;
    const isAi = msg.sender_role === 'AI';
    const isVoiceNote = msg.content === '[VOICE_NOTE]';
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
          {isVoiceNote ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                Voice note terkirim
              </span>
              <span className="text-[11px] text-slate-500">(belum diputar)</span>
            </div>
          ) : (
            <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
          )}
          <span
            className={`mt-1 block text-[10px] ${isSelf ? 'text-white/80' : isAi ? 'text-emerald-700/70' : 'text-slate-500'}`}
          >
            {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  },
  (prev, next) => prev.msg === next.msg && prev.selfRole === next.selfRole
);
