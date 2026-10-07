import { randomUUID } from 'node:crypto';
import { generateDownloadUrl, generateUploadUrl, getObjectMetadata, getObjectPrefix, removeStoredObject } from '../voiceNotes/storage.service';
import { validateAudio, validateAudioSignature } from '../voiceNotes/voiceNotes.policy';

export function voiceKey(){return`counselor-voice/${randomUUID()}`}
export function attachmentKey(){return`complaint-attachments/${randomUUID()}`}
export function counselorDocumentKey(){return`counselor-documents/${randomUUID()}`}
export async function uploadUrl(key:string,contentType:string){return generateUploadUrl(key,contentType)}
export async function downloadUrl(key:string){return generateDownloadUrl(key)}
export async function verifyVoiceObject(key:string,contentType:string,size:number){validateAudio(contentType,size);const meta=await getObjectMetadata(key);if(meta.size!==size||meta.contentType?.split(';')[0]?.toLowerCase()!==contentType.toLowerCase())throw new Error('Uploaded object metadata mismatch');validateAudioSignature(contentType,await getObjectPrefix(key,16));return meta}
export function validateAttachment(contentType:string,size:number){if(!['application/pdf','image/png','image/jpeg'].includes(contentType))throw new Error('Unsupported attachment type');if(!Number.isInteger(size)||size<=0||size>5*1024*1024)throw new Error('Invalid attachment size')}
export async function verifyAttachmentObject(key:string,contentType:string,size:number){validateAttachment(contentType,size);const meta=await getObjectMetadata(key);if(meta.size!==size||meta.contentType?.split(';')[0]?.toLowerCase()!==contentType)throw new Error('Uploaded object metadata mismatch');const prefix=await getObjectPrefix(key,16);const ok=(contentType==='application/pdf'&&prefix.subarray(0,5).toString('ascii')==='%PDF-')||(contentType==='image/png'&&prefix.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))||(contentType==='image/jpeg'&&prefix[0]===0xff&&prefix[1]===0xd8&&prefix[2]===0xff);if(!ok)throw new Error('Attachment content does not match type');return meta}
export async function cleanupObject(key:string){await removeStoredObject(key).catch(()=>undefined)}
