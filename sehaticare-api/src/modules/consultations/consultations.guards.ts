import { consultation_status, doctor_profiles, user_role } from '@prisma/client';

export type AuthUser = { userId: string; role: user_role };

export function ensureConsultationAccess(
  consultation: {
    patient_id: string;
    assignedDoctorId: string | null;
    consultation_participants?: { user_id: string }[] | null;
  },
  user: AuthUser
) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'PASIEN') {
    if (consultation.patient_id !== user.userId) {
      throw new Error('Forbidden');
    }
    return;
  }
  if (user.role === 'DOKTER') {
    const isAssigned = consultation.assignedDoctorId === user.userId;
    const isParticipant = consultation.consultation_participants?.some((p) => p.user_id === user.userId);
    if (!isAssigned && !isParticipant) {
      throw new Error('Forbidden');
    }
    return;
  }
  throw new Error('Forbidden');
}

export function ensureDoctorVerified(profile?: doctor_profiles | null) {
  if (!profile || profile.verification_status !== 'VERIFIED') {
    throw new Error('Doctor not verified');
  }
}

export function ensureNotClosed(status: consultation_status) {
  if (status === 'SELESAI') {
    throw new Error('Consultation already closed');
  }
}
