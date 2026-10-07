import { z } from 'zod';
const status = z.enum(['DRAFT','REVIEW','PUBLISHED','ARCHIVED']);
const safeText = (max:number) => z.string().trim().min(1).max(max).refine(v=>!/<\/?(?:script|iframe|object|embed)\b/i.test(v),'Unsafe markup');
const httpsUrl = z.string().url().max(500).refine(v=>new URL(v).protocol==='https:','HTTPS required');
const externalVideoUrl = httpsUrl.optional().refine((value) => {
  if (!value) return true;
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'vimeo.com') return true;
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] ?? '';
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    id = url.pathname === '/watch'
      ? url.searchParams.get('v') ?? ''
      : url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1] ?? '';
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}, 'Supported YouTube or Vimeo URL required');
export const pageSchema=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(50).default(10),q:z.string().trim().max(80).optional(),regionId:z.string().uuid().optional(),year:z.coerce.number().int().min(2000).max(2100).optional(),periodType:z.enum(['MONTHLY','QUARTERLY','SEMESTER','YEARLY']).optional(),type:z.enum(['PUSKESMAS','RUMAH_SAKIT','KLINIK']).optional(),service:z.enum(['COUNSELING','HIV_TESTING','ARV_SERVICE','PSYCHOLOGY','LABORATORY','PHARMACY','DISABILITY_ACCESS','OTHER']).optional(),category:z.string().max(64).optional()});
export const statisticSchema=z.object({region_id:z.string().uuid(),period_start:z.coerce.date(),period_end:z.coerce.date(),year:z.number().int().min(2000).max(2100),period_type:z.enum(['MONTHLY','QUARTERLY','SEMESTER','YEARLY']),case_count:z.number().int().min(0),data_category:safeText(80),source_name:safeText(160),source_publication:z.string().trim().max(200).optional(),source_url:httpsUrl.optional(),updated_on:z.coerce.date(),methodology_note:z.string().trim().max(1000).optional(),is_sample:z.boolean().default(false)}).refine(v=>v.period_end>=v.period_start,{message:'Invalid period'});
export const articleSchema=z.object({title:safeText(160),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),summary:safeText(300),body_markdown:safeText(20000),category_id:z.string().uuid().optional(),thumbnail_key:z.string().regex(/^thumbnails\/[a-f0-9-]+\.(?:webp|jpg|png)$/).optional(),thumbnail_alt:z.string().trim().max(200).optional(),language:z.enum(['id']),source_reference:httpsUrl,reading_minutes:z.number().int().min(1).max(120),featured:z.boolean().default(false)}).refine(v=>!v.thumbnail_key||Boolean(v.thumbnail_alt),{message:'Thumbnail alt required'});
export const videoSchema=z.object({title:safeText(160),description:safeText(1000),category_id:z.string().uuid().optional(),source_type:z.enum(['UPLOAD','EXTERNAL']),storage_key:z.string().regex(/^education-videos\/[a-f0-9-]+\.(?:mp4|webm)$/).optional(),external_url:externalVideoUrl,thumbnail_key:z.string().max(300).optional(),thumbnail_alt:safeText(200),duration_seconds:z.number().int().min(1).max(14400).optional(),file_size_bytes:z.number().int().min(1).max(524288000).optional(),language:z.enum(['id']),subtitle_text:safeText(100000),transcript_text:safeText(200000),speaker_type:z.enum(['GENERAL','ODHIV_OPEN'])}).refine(v=>v.source_type==='UPLOAD'?Boolean(v.storage_key):Boolean(v.external_url),{message:'Video source required'});
export const consentSchema=z.object({subject_type:z.enum(['PERSON','ORGANIZATION']),subject_reference:z.string().regex(/^sub_[a-f0-9]{16,64}$/),consent_version:safeText(40),scope:safeText(500),expires_at:z.coerce.date().optional()});
export const facilitySchema=z.object({name:safeText(160),facility_type:z.enum(['PUSKESMAS','RUMAH_SAKIT','KLINIK']),region_id:z.string().uuid(),district_name:z.string().trim().max(120).optional(),address:safeText(500),public_contact:z.string().trim().max(80).optional(),service_hours:safeText(300),description:z.string().trim().max(1000).optional(),source_name:safeText(200),is_sample:z.boolean().default(false),services:z.array(z.enum(['COUNSELING','HIV_TESTING','ARV_SERVICE','PSYCHOLOGY','LABORATORY','PHARMACY','DISABILITY_ACCESS','OTHER'])).max(8)});
export const regionSchema=z.object({code:z.string().regex(/^[A-Z0-9.-]{2,20}$/),name:safeText(120),type:z.enum(['PROVINCE','CITY_REGENCY','DISTRICT']),parent_id:z.string().uuid().optional()});
export const categorySchema=z.object({name:safeText(100),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),is_active:z.boolean().default(true)});
export const statusSchema=z.object({status});
export const portalSectionEnum=z.enum(['hero','carouselImages','edukasiAwal','video','infografis','faq','banner']);
export const portalItemCreateSchema=z.object({
  section:portalSectionEnum,
  title:safeText(200),
  summary:z.string().trim().max(2000).default(''),
  link_url:z.string().trim().max(500).optional().nullable(),
  media_url:z.string().trim().max(2000).optional().nullable(),
  article_id:z.string().uuid().optional().nullable(),
  video_id:z.string().uuid().optional().nullable(),
  publication_status:z.enum(['DRAFT','REVIEW','PUBLISHED','ARCHIVED']).default('DRAFT'),
  display_order:z.coerce.number().int().min(0).default(1)
});
export const portalItemUpdateSchema=z.object({
  section:portalSectionEnum.optional(),
  title:safeText(200).optional(),
  summary:z.string().trim().max(2000).optional(),
  link_url:z.string().trim().max(500).optional().nullable(),
  media_url:z.string().trim().max(2000).optional().nullable(),
  article_id:z.string().uuid().optional().nullable(),
  video_id:z.string().uuid().optional().nullable(),
  publication_status:z.enum(['DRAFT','REVIEW','PUBLISHED','ARCHIVED']).optional(),
  display_order:z.coerce.number().int().min(0).optional()
});
export const portalReorderSchema=z.object({
  section:portalSectionEnum,
  items:z.array(z.object({id:z.string().uuid(),display_order:z.number().int().min(0)})).min(1)
});
export function pagination(v:unknown){const p=pageSchema.parse(v);return{...p,skip:(p.page-1)*p.limit}}
