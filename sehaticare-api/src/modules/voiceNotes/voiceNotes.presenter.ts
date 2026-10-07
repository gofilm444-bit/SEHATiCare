type VoiceNoteSource = {
  id: string;
  content_type: string;
  file_size_bytes: number;
  created_at: Date;
};

export function toSafeVoiceNoteResponse(voiceNote: VoiceNoteSource, messageId?: string) {
  return {
    id: voiceNote.id,
    content_type: voiceNote.content_type,
    file_size_bytes: voiceNote.file_size_bytes,
    created_at: voiceNote.created_at,
    ...(messageId ? { message_id: messageId } : {})
  };
}

export function toSafeVoiceNoteDownloadResponse(voiceNote: VoiceNoteSource, downloadUrl: string) {
  return {
    ...toSafeVoiceNoteResponse(voiceNote),
    download_url: downloadUrl
  };
}
