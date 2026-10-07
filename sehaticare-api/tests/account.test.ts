import test from 'node:test'; import assert from 'node:assert/strict';
import { generateLoginId, generatePublicId, generateRecoveryCode, maskLoginId, normalizeLoginId } from '../src/modules/account/identity';
import { anonymousRegistrationSchema, MIN_PASSWORD_LENGTH, POLICY_VERSION, recoverySchema } from '../src/modules/account/account.validators';
import { readFileSync } from 'node:fs'; import path from 'node:path';

test('identity credentials are random, formatted, and separately generated', () => {
 const logins=new Set(Array.from({length:200},generateLoginId)); const publics=new Set(Array.from({length:200},generatePublicId)); const recovery=new Set(Array.from({length:200},generateRecoveryCode));
 assert.equal(logins.size,200); assert.equal(publics.size,200); assert.equal(recovery.size,200);
 assert.match([...logins][0],/^SC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.match([...publics][0],/^usr_[a-f0-9]{32}$/); assert.match([...recovery][0],/^[A-Z2-9]{5}(?:-[A-Z2-9]{5}){3}$/);
 assert.equal(normalizeLoginId(' sc-abcd_efgh ijkl '),'SC-ABCD-EFGH-IJKL'); assert.equal(maskLoginId('SC-ABCD-EFGH-IJKL'),'SC-****-IJKL');
});

test('registration requires strong confirmed password, non-contact alias, and versioned consent', () => {
 const valid={alias:'Bintang Pagi',password:'aman-sekali-2026',password_confirmation:'aman-sekali-2026',accept_terms:true,accept_privacy:true,policy_version:POLICY_VERSION,website:''};
 assert.equal(anonymousRegistrationSchema.safeParse(valid).success,true);
 assert.equal(MIN_PASSWORD_LENGTH,8);
 assert.equal(anonymousRegistrationSchema.safeParse({...valid,password:'aman1234',password_confirmation:'aman1234'}).success,true);
 assert.equal(anonymousRegistrationSchema.safeParse({...valid,password:'aman123',password_confirmation:'aman123'}).success,false);
 assert.equal(anonymousRegistrationSchema.safeParse({...valid,alias:'nama@example.com'}).success,false);
 assert.equal(anonymousRegistrationSchema.safeParse({...valid,alias:'Dokter Resmi'}).success,false);
 assert.equal(anonymousRegistrationSchema.safeParse({...valid,accept_privacy:false}).success,false);
 assert.equal(anonymousRegistrationSchema.safeParse({...valid,password_confirmation:'berbeda-2026'}).success,false);
});

test('recovery request does not accept weak or mismatched replacement passwords',()=>{const base={login_id:'SC-ABCD-EFGH-IJKL',recovery_code:'ABCDE-FGHIJ-KLMNP-QRSTU',new_password:'kata-sandi-aman-2026',password_confirmation:'kata-sandi-aman-2026'};assert.equal(recoverySchema.safeParse(base).success,true);assert.equal(recoverySchema.safeParse({...base,new_password:'short1',password_confirmation:'short1'}).success,false)});

test('anonymous migration is additive and logging policy redacts every credential field',()=>{
 const sql=readFileSync(path.resolve(__dirname,'../prisma/migrations/20260805090000_anonymous_accounts/migration.sql'),'utf8');
 assert.doesNotMatch(sql,/(?:^|\n)\s*(?:DROP|TRUNCATE|DELETE)\b/i); assert.match(sql,/WHERE "public_id" IS NULL/); assert.doesNotMatch(sql,/ALTER\s+COLUMN\s+"(?:email|phone_e164|full_name|password_hash)"/i);
 const app=readFileSync(path.resolve(__dirname,'../src/app.ts'),'utf8'); for(const field of ['recovery_code','login_id','new_password','current_password','password_confirmation']) assert.match(app,new RegExp(`body\\.${field}`));
});
