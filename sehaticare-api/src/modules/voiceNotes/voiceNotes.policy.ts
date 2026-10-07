import crypto from 'node:crypto';

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg'];
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

export function createVoiceNoteStorageKey() {
  return `voice-notes/${crypto.randomUUID()}`;
}

export function validateAudio(contentType: string, fileSizeBytes: number) {
  const normalizedType = contentType.split(';')[0]?.trim().toLowerCase();
  if (!normalizedType || !ALLOWED_AUDIO_TYPES.includes(normalizedType)) {
    throw new Error('Unsupported audio type');
  }
  if (!Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error('Invalid file size');
  }
  if (fileSizeBytes > MAX_AUDIO_SIZE_BYTES) {
    throw new Error('File too large');
  }
  return normalizedType;
}

export type UploadSessionSource = {
  consultation_id: string;
  requested_by: string;
  committed_at: Date | null;
  expires_at: Date;
  content_type: string | null;
  file_size_bytes: number | null;
};

export function assertUploadSessionValid(
  session: UploadSessionSource | null,
  params: { consultationId: string; actorId: string; now?: Date }
): asserts session is UploadSessionSource {
  if (!session || session.consultation_id !== params.consultationId) {
    throw new Error('Upload session invalid');
  }
  if (session.requested_by !== params.actorId) throw new Error('Upload session invalid');
  if (session.committed_at) throw new Error('Upload session already committed');
  if (session.expires_at.getTime() < (params.now ?? new Date()).getTime()) {
    throw new Error('Upload session expired');
  }
}

export function validateUploadedObject(params: {
  requestedContentType: string;
  requestedFileSizeBytes: number;
  sessionContentType: string | null;
  sessionFileSizeBytes: number | null;
  object: { size: number; contentType: string | null } | null;
}) {
  const requestedType = validateAudio(params.requestedContentType, params.requestedFileSizeBytes);
  if (!params.object?.contentType) throw new Error('Uploaded object not found or missing content type');
  const storedType = validateAudio(params.object.contentType, params.object.size);
  if (storedType !== requestedType || params.object.size !== params.requestedFileSizeBytes) {
    throw new Error('Uploaded object metadata mismatch');
  }
  if (
    (params.sessionContentType &&
      validateAudio(params.sessionContentType, params.requestedFileSizeBytes) !== requestedType) ||
    (params.sessionFileSizeBytes !== null &&
      params.sessionFileSizeBytes !== params.requestedFileSizeBytes)
  ) {
    throw new Error('Upload session metadata mismatch');
  }
}

export function validateAudioSignature(contentType: string, prefix: Buffer) {
  const normalizedType = validateAudio(contentType, 1);
  const matches =
    (normalizedType === 'audio/webm' &&
      prefix.length >= 4 &&
      prefix.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) ||
    (normalizedType === 'audio/ogg' &&
      prefix.length >= 4 &&
      prefix.subarray(0, 4).toString('ascii') === 'OggS') ||
    (normalizedType === 'audio/wav' &&
      prefix.length >= 12 &&
      prefix.subarray(0, 4).toString('ascii') === 'RIFF' &&
      prefix.subarray(8, 12).toString('ascii') === 'WAVE') ||
    (normalizedType === 'audio/mpeg' &&
      ((prefix.length >= 3 && prefix.subarray(0, 3).toString('ascii') === 'ID3') ||
        (prefix.length >= 2 && prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0)));
  if (!matches) throw new Error('Uploaded file content does not match audio type');
}
