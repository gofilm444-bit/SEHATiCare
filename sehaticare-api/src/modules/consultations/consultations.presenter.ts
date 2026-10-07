import { chat_sender_role, consultation_status } from '@prisma/client';

export const consultationPublicSelect = {
  id: true,
  status: true,
  initial_complaint: true,
  opened_at: true,
  doctor_joined_at: true,
  closed_at: true,
  created_at: true,
  updated_at: true,
  closeRequested: true,
  closeRequestedAt: true,
  consent_at: true,
  consent_version: true,
  priority: true,
  red_flag: true,
  red_flag_reason: true
} as const;

export type PublicUserResponse = {
  full_name: string;
};

type PublicUserSource = {
  full_name: string;
};

type ConsultationSource = {
  id: string;
  status: consultation_status;
  initial_complaint: string;
  opened_at: Date;
  created_at: Date;
  updated_at: Date;
  doctor_joined_at?: Date | null;
  closed_at?: Date | null;
  closeRequested?: boolean;
  closeRequestedAt?: Date | null;
  consent_at?: Date | null;
  consent_version?: string | null;
  priority?: number;
  red_flag?: boolean;
  red_flag_reason?: string | null;
};

type DoctorConsultationSource = ConsultationSource & {
  patient?: PublicUserSource | null;
  last_message_at?: Date;
};

type MessageSource = {
  id: string;
  sender_role: chat_sender_role;
  content: string;
  created_at: Date;
  voice_note_id?: string | null;
};

export function toPublicUser(user: PublicUserSource): PublicUserResponse {
  return { full_name: user.full_name };
}

export function toSafeConsultationResponse(consultation: ConsultationSource) {
  return {
    id: consultation.id,
    status: consultation.status,
    initial_complaint: consultation.initial_complaint,
    opened_at: consultation.opened_at,
    created_at: consultation.created_at,
    updated_at: consultation.updated_at,
    ...(consultation.doctor_joined_at !== undefined
      ? { doctor_joined_at: consultation.doctor_joined_at }
      : {}),
    ...(consultation.closed_at !== undefined ? { closed_at: consultation.closed_at } : {}),
    ...(consultation.closeRequested !== undefined
      ? { closeRequested: consultation.closeRequested }
      : {}),
    ...(consultation.closeRequestedAt !== undefined
      ? { closeRequestedAt: consultation.closeRequestedAt }
      : {}),
    ...(consultation.consent_at !== undefined ? { consent_at: consultation.consent_at } : {}),
    ...(consultation.consent_version !== undefined
      ? { consent_version: consultation.consent_version }
      : {}),
    ...(consultation.priority !== undefined ? { priority: consultation.priority } : {}),
    ...(consultation.red_flag !== undefined ? { red_flag: consultation.red_flag } : {}),
    ...(consultation.red_flag_reason !== undefined
      ? { red_flag_reason: consultation.red_flag_reason }
      : {})
  };
}

export function toSafeDoctorConsultationResponse(consultation: DoctorConsultationSource) {
  return {
    ...toSafeConsultationResponse(consultation),
    ...(consultation.last_message_at !== undefined
      ? { last_message_at: consultation.last_message_at }
      : {}),
    ...(consultation.patient !== undefined
      ? { patient: consultation.patient ? toPublicUser(consultation.patient) : null }
      : {})
  };
}

export function toSafeMessageResponse(message: MessageSource) {
  return {
    id: message.id,
    sender_role: message.sender_role,
    content: message.content,
    created_at: message.created_at,
    ...(message.voice_note_id !== undefined ? { voice_note_id: message.voice_note_id } : {})
  };
}
