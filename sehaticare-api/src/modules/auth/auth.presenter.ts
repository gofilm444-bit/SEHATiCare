import { doctor_verification_status, user_role } from '@prisma/client';

type DoctorProfileSource = {
  verification_status: doctor_verification_status;
  verified_at: Date | null;
  puskesmas_name: string | null;
  str_number: string | null;
};

type SelfUserSource = {
  id: string;
  role: user_role;
  is_superadmin?: boolean;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  public_id: string;
  display_alias: string | null;
  account_mode: 'LEGACY' | 'ANONYMOUS';
  doctor_profiles_doctor_profiles_user_idTousers?: DoctorProfileSource | null;
};

export function toSelfUserResponse(user: SelfUserSource) {
  const doctorProfile = user.doctor_profiles_doctor_profiles_user_idTousers;
  return {
    id: user.public_id,
    public_id: user.public_id,
    role: user.role,
    is_superadmin: Boolean(user.is_superadmin),
    full_name: user.display_alias ?? user.full_name,
    display_alias: user.display_alias,
    account_mode: user.account_mode,
    phone_e164: user.account_mode === 'LEGACY' ? user.phone_e164 : null,
    email: user.account_mode === 'LEGACY' ? user.email : null,
    doctor_profile: doctorProfile
      ? {
          verification_status: doctorProfile.verification_status,
          verified_at: doctorProfile.verified_at,
          puskesmas_name: doctorProfile.puskesmas_name,
          str_number: doctorProfile.str_number
        }
      : null
  };
}
