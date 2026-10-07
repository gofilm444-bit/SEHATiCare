import { consultation_topic, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { localDateKey, localTimeKey, weekday } from '../healthPlanning/timezone';

export const OPEN_CONVERSATION_STATUSES = [
  'ASSIGNED',
  'ACTIVE',
  'WAITING_USER',
  'WAITING_COUNSELOR'
] as const;

export type CounselorSearchInput = {
  topic: consultation_topic;
  region_id?: string;
  facility_id?: string;
  profession?: string;
  language?: string;
  available_now?: boolean;
};

type CandidateSource = {
  user_id: string;
  professional_name: string;
  profession: string;
  competencies: string[];
  languages: string[];
  active_days: number[];
  opens_at: string;
  closes_at: string;
  timezone: string;
  is_available: boolean;
  max_active_conversations: number;
  facility_id: string | null;
  region_id: string | null;
  user: { public_id: string; role: string; is_active: boolean; doctor_profiles_doctor_profiles_user_idTousers?: { verification_status: string } | null };
  facility: { id: string; name: string; is_active: boolean; verification_status: string; region_id: string; regions: { name: string; parent_id: string | null } } | null;
  region: { id: string; name: string; parent_id: string | null } | null;
};

export type CounselorCandidate = {
  public_id: string;
  professional_name: string;
  profession: string;
  facility: { id: string; name: string } | null;
  region: { id: string; name: string } | null;
  competencies: string[];
  languages: string[];
  available_now: true;
  estimated_response: string;
  reasons: string[];
  recommendation_scope: 'FACILITY' | 'DISTRICT' | 'REGION' | 'ONLINE';
};

function isWithinHours(profile: Pick<CandidateSource, 'active_days' | 'opens_at' | 'closes_at' | 'timezone'>, now: Date) {
  const day = weekday(localDateKey(now, profile.timezone));
  const time = localTimeKey(now, profile.timezone);
  return profile.active_days.includes(day) && time >= profile.opens_at && time < profile.closes_at;
}

function hasCompetency(competencies: string[], topic: consultation_topic) {
  const normalized = competencies.map((value) => value.trim().toUpperCase());
  return normalized.includes(topic) || normalized.includes('GENERAL') || normalized.includes('ALL');
}

export function rankEligibleCounselor(input: {
  profile: CandidateSource;
  topic: consultation_topic;
  workload: number;
  blocked: boolean;
  conflicted: boolean;
  requestedRegion?: { id: string; parent_id: string | null } | null;
  requestedFacilityId?: string;
  now: Date;
}): { eligible: boolean; score: number; reasons: string[]; scope: CounselorCandidate['recommendation_scope'] } {
  const { profile, topic, workload, blocked, conflicted, requestedRegion, requestedFacilityId, now } = input;
  const doctorVerified = profile.user.role !== 'DOKTER' || profile.user.doctor_profiles_doctor_profiles_user_idTousers?.verification_status === 'VERIFIED';
  const facilityValid = !profile.facility || (profile.facility.is_active && profile.facility.verification_status === 'VERIFIED');
  const competent = hasCompetency(profile.competencies, topic);
  const withinHours = isWithinHours(profile, now);
  const eligible = profile.user.is_active && doctorVerified && facilityValid && profile.is_available && competent && withinHours && workload < profile.max_active_conversations && !blocked && !conflicted;
  if (!eligible) return { eligible: false, score: -1, reasons: [], scope: 'ONLINE' };

  let score = 100 - workload * 4;
  const reasons = ['Sesuai topik kebutuhan', 'Tersedia saat ini'];
  let scope: CounselorCandidate['recommendation_scope'] = 'ONLINE';
  if (requestedFacilityId && profile.facility_id === requestedFacilityId) {
    score += 50;
    reasons.push('Berada di fasilitas pilihan');
    scope = 'FACILITY';
  } else if (requestedRegion) {
    const candidateRegion = profile.region ?? (profile.facility ? { id: profile.facility.region_id, name: profile.facility.regions.name, parent_id: profile.facility.regions.parent_id } : null);
    if (candidateRegion?.id === requestedRegion.id) {
      score += 30;
      reasons.push('Berada di wilayah pilihan');
      scope = 'DISTRICT';
    } else if (candidateRegion?.parent_id && candidateRegion.parent_id === requestedRegion.parent_id) {
      score += 15;
      reasons.push('Tersedia di wilayah terdekat yang sama');
      scope = 'REGION';
    }
  }
  if (workload === 0) reasons.push('Antrean lebih singkat');
  return { eligible: true, score, reasons, scope };
}

const profileInclude = {
  user: {
    select: {
      public_id: true,
      role: true,
      is_active: true,
      doctor_profiles_doctor_profiles_user_idTousers: { select: { verification_status: true } }
    }
  },
  facility: { include: { regions: { select: { name: true, parent_id: true } } } },
  region: { select: { id: true, name: true, parent_id: true } }
} satisfies Prisma.counselor_profilesInclude;

export async function findEligibleCounselors(patientId: string, input: CounselorSearchInput, now = new Date()) {
  const [profiles, requestedRegion, blocks, conflicts, workloads] = await Promise.all([
    prisma.counselor_profiles.findMany({
      where: {
        permission_enabled: true,
        verification_status: 'VERIFIED',
        verified_at: { not: null },
        is_active: true,
        service_role: { in: ['COUNSELOR', 'FACILITATOR'] },
        ...(input.profession ? { profession: { equals: input.profession, mode: 'insensitive' } } : {}),
        ...(input.language ? { languages: { has: input.language } } : {})
      },
      include: profileInclude
    }),
    input.region_id ? prisma.regions.findFirst({ where: { id: input.region_id, is_active: true }, select: { id: true, parent_id: true } }) : null,
    prisma.conversation_blocks.findMany({ where: { user_id: patientId, is_active: true }, select: { counselor_id: true } }),
    prisma.counselor_conflicts.findMany({ where: { patient_id: patientId, is_active: true }, select: { counselor_id: true } }),
    prisma.service_conversations.groupBy({
      by: ['assigned_counselor_id'],
      where: { assigned_counselor_id: { not: null }, status: { in: [...OPEN_CONVERSATION_STATUSES] } },
      _count: { _all: true }
    })
  ]);
  const blocked = new Set(blocks.map((row) => row.counselor_id));
  const conflicted = new Set(conflicts.map((row) => row.counselor_id));
  const workload = new Map(workloads.map((row) => [row.assigned_counselor_id, row._count._all]));

  return profiles
    .map((profile) => {
      const ranked = rankEligibleCounselor({
        profile: profile as CandidateSource,
        topic: input.topic,
        workload: workload.get(profile.user_id) ?? 0,
        blocked: blocked.has(profile.user_id),
        conflicted: conflicted.has(profile.user_id),
        requestedRegion,
        requestedFacilityId: input.facility_id,
        now
      });
      if (!ranked.eligible) return null;
      const region = profile.region ?? (profile.facility ? { id: profile.facility.region_id, name: profile.facility.regions.name } : null);
      return {
        internalUserId: profile.user_id,
        workload: workload.get(profile.user_id) ?? 0,
        score: ranked.score,
        dto: {
          public_id: profile.user.public_id,
          professional_name: profile.professional_name,
          profession: profile.profession,
          facility: profile.facility ? { id: profile.facility.id, name: profile.facility.name } : null,
          region,
          competencies: profile.competencies,
          languages: profile.languages,
          available_now: true as const,
          estimated_response: (workload.get(profile.user_id) ?? 0) === 0 ? 'Antrean paling singkat' : 'Ditinjau pada jam layanan',
          reasons: ranked.reasons,
          recommendation_scope: ranked.scope
        }
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.score - left.score || left.workload - right.workload || left.dto.professional_name.localeCompare(right.dto.professional_name, 'id'));
}
