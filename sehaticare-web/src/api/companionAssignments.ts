import { apiFetch } from './client';

export interface LongitudinalAssignmentItem {
  id: string;
  patient: {
    public_id: string;
    alias: string;
  };
  companion: {
    public_id: string;
    professional_name: string;
  };
  facility: {
    id: string;
    name: string;
  } | null;
  status: 'ACTIVE' | 'ENDED' | 'CANCELLED';
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  created_at: string;
}

export interface CandidateCompanion {
  public_id: string;
  professional_name: string;
  facility_id: string | null;
  service_role: string;
  is_active: boolean;
  verification_status: string;
}

export interface CandidatePatient {
  public_id: string;
  alias: string;
  has_active_companion: boolean;
}

export interface CompanionCandidatesResponse {
  companions: CandidateCompanion[];
  patients: CandidatePatient[];
}

export interface CompanionPatientRosterItem {
  assignment_id: string;
  patient_public_id: string;
  alias: string;
  status: 'ACTIVE' | 'ENDED' | 'CANCELLED';
  started_at: string;
  facility: {
    id: string;
    name: string;
  } | null;
}

export interface PatientActiveCompanionResponse {
  assigned: boolean;
  companion: {
    public_id: string;
    professional_name: string;
    service_role: string;
    facility: {
      id: string;
      name: string;
    } | null;
  } | null;
  started_at: string | null;
}

export function getAdminCompanionAssignments(
  token: string,
  params?: { status?: string; search?: string }
) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const qStr = query.toString();
  return apiFetch<{ items: LongitudinalAssignmentItem[] }>(
    `/admin/companion-assignments${qStr ? `?${qStr}` : ''}`,
    {},
    { token }
  );
}

export function getAdminCompanionCandidates(token: string) {
  return apiFetch<CompanionCandidatesResponse>(
    '/admin/companion-assignments/candidates',
    {},
    { token }
  );
}

export function createCompanionAssignment(
  token: string,
  body: { patient_public_id: string; companion_public_id: string; facility_id?: string | null }
) {
  return apiFetch<LongitudinalAssignmentItem>(
    '/admin/companion-assignments',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    { token }
  );
}

export function reassignCompanion(
  token: string,
  assignmentId: string,
  body: { new_companion_public_id: string; reason?: string }
) {
  return apiFetch<LongitudinalAssignmentItem>(
    `/admin/companion-assignments/${encodeURIComponent(assignmentId)}/reassign`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
    { token }
  );
}

export function endCompanionAssignment(
  token: string,
  assignmentId: string,
  body?: { reason?: string }
) {
  return apiFetch<LongitudinalAssignmentItem>(
    `/admin/companion-assignments/${encodeURIComponent(assignmentId)}/end`,
    {
      method: 'PUT',
      body: JSON.stringify(body || {}),
    },
    { token }
  );
}

export function getCompanionPatients(token: string) {
  return apiFetch<{ items: CompanionPatientRosterItem[] }>(
    '/companion/patients',
    {},
    { token }
  );
}

export function getCompanionPatientDetail(token: string, publicId: string) {
  return apiFetch<CompanionPatientRosterItem>(
    `/companion/patients/${encodeURIComponent(publicId)}`,
    {},
    { token }
  );
}

export function getPatientCompanion(token: string) {
  return apiFetch<PatientActiveCompanionResponse>(
    '/patient/companion',
    {},
    { token }
  );
}

export interface StartCompanionConversationResponse {
  conversation_public_id: string;
  is_reused: boolean;
  routed_to_companion: boolean;
  status: string;
}

export function startCompanionConversation(
  token: string,
  body?: { initial_message?: string; submission_key?: string }
) {
  return apiFetch<StartCompanionConversationResponse>(
    '/patient/companion/start-conversation',
    {
      method: 'POST',
      body: JSON.stringify(body || {}),
    },
    { token }
  );
}

export function getPatientActiveCompanionConversation(token: string) {
  return apiFetch<{
    has_active_conversation: boolean;
    conversation_public_id: string | null;
    status: string | null;
  }>(
    '/patient/companion/active-conversation',
    {},
    { token }
  );
}

