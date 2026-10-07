import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { inQuietHours, localDateKey, localDateTimeToUtc, localParts, localTimeKey, weekday } from '../healthPlanning/timezone';

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomGroup(length:number){const bytes=randomBytes(length);return Array.from(bytes,b=>ALPHABET[b%ALPHABET.length]).join('')}
export function trackingCode(){return`TC-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`}
export function trackingSecret(){return`TRK-${randomGroup(5)}-${randomGroup(5)}-${randomGroup(5)}`}
export async function hashSecret(secret:string){return bcrypt.hash(secret,12)}
export async function verifySecret(secret:string,hash:string){return bcrypt.compare(secret,hash)}

export async function accessAudit(input:{actorId?:string|null;actorRole?:any;resourceType:string;resourcePublicId:string;action:string;result?:string;correlationId:string;reason?:string;safeMetadata?:Prisma.InputJsonValue}){await prisma.sensitive_access_audits.create({data:{id:randomUUID(),actor_user_id:input.actorId??null,actor_role:input.actorRole??null,resource_type:input.resourceType,resource_public_id:input.resourcePublicId,action:input.action,result:input.result??'ALLOWED',correlation_id:input.correlationId,reason:input.reason??null,safe_metadata:input.safeMetadata??undefined}})}
export async function safeEvent(kind:'conversation'|'complaint',resourceId:string,eventType:string,actorId?:string|null,meta?:Prisma.InputJsonValue){if(kind==='conversation')await prisma.conversation_events.create({data:{id:randomUUID(),conversation_id:resourceId,event_type:eventType,actor_user_id:actorId??null,safe_metadata:meta??undefined}});else await prisma.complaint_events.create({data:{id:randomUUID(),ticket_id:resourceId,event_type:eventType,actor_user_id:actorId??null,safe_metadata:meta??undefined}})}

export async function createNeutralNotification(userId:string,key:string,kind:'NEW_MESSAGE'|'COMPLAINT_UPDATE',resourcePublicId:string,text:'Anda memiliki pesan baru.'|'Anda memiliki pembaruan baru.'){const pref=await prisma.notification_preferences.findUnique({where:{user_id:userId}});const now=new Date();const quiet=Boolean(pref&&inQuietHours(localTimeKey(now,pref.timezone),pref.quiet_hours_start,pref.quiet_hours_end));await prisma.notification_deliveries.upsert({where:{deduplication_key:key},update:{},create:{id:randomUUID(),user_id:userId,deduplication_key:key,kind,resource_public_id:resourcePublicId,neutral_text:text,due_at:now,status:!pref?.in_app_enabled||quiet?'SUPPRESSED':'PENDING',updated_at:now}})}

type BusinessConfig={active_days:number[];opens_at:string;closes_at:string;timezone:string};
function isBusinessMinute(date:Date,c:BusinessConfig){const key=localDateKey(date,c.timezone);const time=localTimeKey(date,c.timezone);return c.active_days.includes(weekday(key))&&time>=c.opens_at&&time<c.closes_at}
export function addBusinessMinutes(start:Date,minutes:number,c:BusinessConfig){let cursor=new Date(start);let remaining=minutes;let guard=0;while(remaining>0&&guard<60*24*60){cursor=new Date(cursor.getTime()+60_000);if(isBusinessMinute(cursor,c))remaining--;guard++}if(remaining>0)throw new Error('SLA configuration cannot produce a deadline');return cursor}
export function slaState(ticket:{status:string;response_due_at:Date;resolution_due_at:Date},now=new Date()){if(ticket.status==='WAITING_USER')return'PAUSED';if(['RESOLVED','CLOSED','REJECTED'].includes(ticket.status))return'COMPLETED';const due=ticket.response_due_at??ticket.resolution_due_at;const delta=due.getTime()-now.getTime();if(delta<0)return'OVERDUE';if(delta<=60*60_000)return'DUE_SOON';return'ON_TRACK'}
export async function serviceAvailability(serviceType:'COUNSELOR'|'GENERAL_SUPPORT',now=new Date()){const config=await prisma.service_settings.findUnique({where:{service_type:serviceType}});if(!config)return{open:false,config:null,message:'Pesan Anda telah diterima dan akan ditinjau pada jam layanan berikutnya.'};const key=localDateKey(now,config.timezone);const time=localTimeKey(now,config.timezone);const open=config.is_active&&config.active_days.includes(weekday(key))&&time>=config.opens_at&&time<config.closes_at;return{open,config,message:open?config.estimated_response_label:'Pesan Anda telah diterima dan akan ditinjau pada jam layanan berikutnya.'}}
export function localDeadline(date:Date,timeZone:string){const p=localParts(date,timeZone);return`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')} ${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')} ${timeZone}`}

