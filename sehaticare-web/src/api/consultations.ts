import { apiFetch } from './client';

export type ConsultationTopic = 'HEALTH_CONCERN'|'SERVICE_INFORMATION'|'EMOTIONAL_SUPPORT'|'MEDICATION_OR_THERAPY'|'SERVICE_ACCESS'|'OTHER';
export type AssignmentMode = 'RECOMMENDED'|'SELECTED'|'FASTEST'|'GENERAL_QUEUE';
export type CounselorCandidate = {
  public_id:string;
  professional_name:string;
  profession:string;
  facility:{id:string;name:string}|null;
  region:{id:string;name:string}|null;
  competencies:string[];
  languages:string[];
  available_now:true;
  estimated_response:string;
  reasons:string[];
  recommendation_scope:'FACILITY'|'DISTRICT'|'REGION'|'ONLINE';
};
export type ConsultationOverviewItem = {
  id:string;
  status:string;
  title:string;
  service_intent?:string;
  created_at:string;
  updated_at:string;
  has_unread:boolean;
  detail_path:string;
};

type AuthOptions={token:string|null;onUnauthorized:()=>void};
export const consultationApi={
  overview:(auth:AuthOptions)=>apiFetch<{items:ConsultationOverviewItem[]}>('/consultation-overview',{},auth),
  recommendations:(input:{topic:ConsultationTopic;region_id?:string;facility_id?:string},auth:AuthOptions)=>apiFetch<{recommended:CounselorCandidate|null;items:CounselorCandidate[];fallback:string}>('/consultation-counselors/recommendations',{method:'POST',body:JSON.stringify(input)},auth),
  create:(input:{subject?:string;initial_message:string;topic:ConsultationTopic;assignment_mode:AssignmentMode;region_id?:string;facility_id?:string;counselor_public_id?:string;submission_key:string;service_intent?:'COUNSELING'|'COMPANION_SUPPORT'},auth:AuthOptions)=>apiFetch<{public_id:string;status:string;fallback_notice?:string|null}>('/counselor-conversations',{method:'POST',body:JSON.stringify({...input,service_type:'COUNSELOR',service_intent:input.service_intent||'COUNSELING',priority:0,allow_previous_counselor:false})},auth)
};
