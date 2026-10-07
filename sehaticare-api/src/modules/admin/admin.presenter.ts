import { doctor_verification_status } from '@prisma/client';

type DoctorProfileSource = {
  user_id: string;
  verification_status: doctor_verification_status;
  verified_at: Date | null;
  puskesmas_name: string | null;
  str_number: string | null;
  created_at: Date;
  updated_at: Date;
};

export function toSafeDoctorProfileResponse(profile: DoctorProfileSource) {
  return {
    user_id: profile.user_id,
    verification_status: profile.verification_status,
    verified_at: profile.verified_at,
    puskesmas_name: profile.puskesmas_name,
    str_number: profile.str_number,
    created_at: profile.created_at,
    updated_at: profile.updated_at
  };
}
