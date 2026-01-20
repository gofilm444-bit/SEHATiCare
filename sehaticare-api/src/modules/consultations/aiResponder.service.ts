import { consultation_status } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { audit } from '../../utils/auditEvents';

const SYSTEM_PROMPT =
  'Kamu adalah Asisten Edukasi HIV/AIDS untuk aplikasi kesehatan. Tugasmu menenangkan pasien, mengurangi kecemasan, dan memberi edukasi awal yang aman. Gunakan bahasa empatik, non-stigma, dan ringkas. Jangan memberi diagnosis, resep, atau instruksi medis spesifik. Jika ada tanda bahaya (nyeri hebat, demam tinggi berkepanjangan, pikiran menyakiti diri), arahkan untuk segera menghubungi tenaga kesehatan. Dorong kepatuhan ARV secara umum tanpa detail dosis. Hormati privasi.';

const FALLBACK_REPLY =
  'Maaf, pendamping AI sedang tidak tersedia. Tim medis akan membantu. Jika kamu mengalami nyeri hebat, demam tinggi berkepanjangan, atau pikiran menyakiti diri, segera hubungi tenaga kesehatan.';

const MAX_CONTEXT_MESSAGES = 5;
const MAX_MESSAGE_CHARS = 320;
const MAX_COMPLAINT_CHARS = 700;
const AI_TIMEOUT_MS = 8000;

type PromptPayload = {
  systemPrompt: string;
  userPrompt: string;
};

const isAiActiveStatus = (status: consultation_status) => status === 'MENUNGGU_DOKTER' || status === 'AI_AKTIF';

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

async function getLastAiMessageAt(consultationId: string) {
  const lastAiMessage = await prisma.chat_messages.findFirst({
    where: { consultation_id: consultationId, sender_role: 'AI' },
    orderBy: { created_at: 'desc' },
    select: { created_at: true }
  });
  return lastAiMessage?.created_at ?? null;
}

async function getLastAiEventAt(consultationId: string) {
  const lastEvent = await prisma.ai_events.findFirst({
    where: { consultation_id: consultationId, trigger: { in: ['AI_RESPONDER_TRIGGER', 'AI_RESPONDER_REPLY'] } },
    orderBy: { created_at: 'desc' },
    select: { created_at: true }
  });
  return lastEvent?.created_at ?? null;
}

async function getLatestPatientMessageAt(consultationId: string) {
  const lastUserMessage = await prisma.chat_messages.findFirst({
    where: { consultation_id: consultationId, sender_role: 'PASIEN' },
    orderBy: { created_at: 'desc' },
    select: { created_at: true }
  });
  return lastUserMessage?.created_at ?? null;
}

export async function shouldRespond(
  consultation: {
    id: string;
    status: consultation_status;
    assignedDoctorId: string | null;
    consent_at?: Date | null;
    red_flag?: boolean | null;
  },
  lastUserMessageAt: Date
) {
  if (!env.AI_ENABLED) return { shouldRespond: false, reason: 'AI_DISABLED' as const };
  if (!isAiActiveStatus(consultation.status)) return { shouldRespond: false, reason: 'STATUS' as const };
  if (consultation.assignedDoctorId) return { shouldRespond: false, reason: 'DOCTOR_ASSIGNED' as const };
  if (!consultation.consent_at) return { shouldRespond: false, reason: 'NO_CONSENT' as const };
  if (consultation.red_flag) return { shouldRespond: false, reason: 'REDFLAG' as const };

  const lastAiEventAt = await getLastAiEventAt(consultation.id);
  if (lastAiEventAt && lastAiEventAt >= lastUserMessageAt) {
    return { shouldRespond: false, reason: 'DUPLICATE' as const };
  }

  if (lastAiEventAt) {
    const elapsedSeconds = (Date.now() - lastAiEventAt.getTime()) / 1000;
    if (elapsedSeconds < env.AI_COOLDOWN_SECONDS) {
      return { shouldRespond: false, reason: 'COOLDOWN' as const };
    }
  }

  return { shouldRespond: true };
}

export async function buildPrompt(consultationId: string, initialComplaint: string): Promise<PromptPayload> {
  const recentMessages = await prisma.chat_messages.findMany({
    where: { consultation_id: consultationId },
    orderBy: { created_at: 'desc' },
    take: MAX_CONTEXT_MESSAGES,
    select: { sender_role: true, content: true }
  });

  const messageSummary = recentMessages
    .reverse()
    .map((message) => `${message.sender_role}: ${truncateText(message.content, MAX_MESSAGE_CHARS)}`)
    .join('\n');

  const userPrompt = [
    `Keluhan awal pasien: ${truncateText(initialComplaint, MAX_COMPLAINT_CHARS)}`,
    'Ringkasan pesan terakhir:',
    messageSummary || '(belum ada pesan tambahan)',
    '',
    'Gunakan template balasan:',
    '1) Validasi emosi singkat.',
    '2) 1-2 poin edukasi yang aman.',
    '3) 1 teknik coping ringan.',
    '4) Ajakan menunggu dokter atau lanjutkan konsultasi.'
  ].join('\n');

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

async function generateMockReply() {
  return [
    'Terima kasih sudah berbagi. Wajar jika kamu merasa cemas saat menerima kabar seperti ini.',
    'Secara umum, HIV dapat dikelola dengan ARV dan banyak orang tetap hidup panjang serta produktif.',
    'Coba tarik napas perlahan 4 hitungan, tahan 4, lalu hembuskan 6 untuk menenangkan diri.',
    'Silakan lanjutkan konsultasi, dokter akan membantu langkah berikutnya.'
  ].join(' ');
}

async function generateOpenAiReply(prompt: PromptPayload) {
  const apiKey = env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0.5,
        max_tokens: 280,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${bodyText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } | null }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenAI response content is empty');
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateReply(prompt: PromptPayload) {
  if (env.AI_PROVIDER === 'openai') {
    return generateOpenAiReply(prompt);
  }
  return generateMockReply();
}

export async function persistAIMessage(consultationId: string, content: string) {
  return prisma.$transaction(async (tx) => {
    const message = await tx.chat_messages.create({
      data: {
        id: randomUUID(),
        consultation_id: consultationId,
        sender_role: 'AI',
        sender_user_id: null,
        content
      }
    });

    await tx.ai_events.create({
      data: {
        id: randomUUID(),
        consultation_id: consultationId,
        trigger: 'AI_RESPONDER_REPLY',
        request_payload: {},
        response_text: content
      }
    });
    await audit.log(tx, {
      actorUserId: null,
      actorRole: 'AI',
      action: 'AI_REPLIED',
      consultationId,
      meta: {}
    });

    return message;
  });
}

export async function recordAiTrigger(consultationId: string, messageId: string, messageCreatedAt: Date) {
  await prisma.ai_events.create({
    data: {
      id: randomUUID(),
      consultation_id: consultationId,
      trigger: 'AI_RESPONDER_TRIGGER',
      request_payload: { messageId, messageCreatedAt: messageCreatedAt.toISOString() },
      response_text: null
    }
  });
}

export async function getAiTypingState(consultation: {
  id: string;
  status: consultation_status;
  assignedDoctorId: string | null;
  consent_at?: Date | null;
  red_flag?: boolean | null;
}) {
  if (!env.AI_ENABLED) return false;
  if (!isAiActiveStatus(consultation.status)) return false;
  if (consultation.assignedDoctorId) return false;
  if (!consultation.consent_at) return false;
  if (consultation.red_flag) return false;

  const [lastUserMessageAt, lastAiMessageAt] = await Promise.all([
    getLatestPatientMessageAt(consultation.id),
    getLastAiMessageAt(consultation.id)
  ]);

  if (!lastUserMessageAt) return false;
  if (lastAiMessageAt && lastAiMessageAt >= lastUserMessageAt) return false;

  const elapsedSinceUserMessage = (Date.now() - lastUserMessageAt.getTime()) / 1000;
  if (elapsedSinceUserMessage > env.AI_COOLDOWN_SECONDS) return false;

  return true;
}

export function getFallbackReply() {
  return FALLBACK_REPLY;
}
