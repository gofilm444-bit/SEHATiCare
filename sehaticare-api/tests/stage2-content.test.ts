import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { articleSchema, facilitySchema, statisticSchema, videoSchema } from '../src/modules/publicContent/content.validators';

test('stage 2 validators reject negative counts, unsafe markup, unsafe video hosts, and incomplete facilities', () => {
  assert.equal(statisticSchema.safeParse({region_id:'11111111-1111-4111-8111-111111111111',period_start:'2026-01-01',period_end:'2026-12-31',year:2026,period_type:'YEARLY',case_count:-1,data_category:'Agregat',source_name:'Sumber',updated_on:'2026-08-05'}).success,false);
  assert.equal(articleSchema.safeParse({title:'Judul',slug:'judul',summary:'Ringkas',body_markdown:'<script>alert(1)</script>',language:'id',source_reference:'https://example.org',reading_minutes:2}).success,false);
  assert.equal(videoSchema.safeParse({title:'Video',description:'Deskripsi',source_type:'EXTERNAL',external_url:'https://evil.example/video',thumbnail_alt:'Gambar',language:'id',subtitle_text:'Sub',transcript_text:'Transkrip',speaker_type:'GENERAL'}).success,false);
  assert.equal(videoSchema.safeParse({title:'Video',description:'Deskripsi',source_type:'EXTERNAL',external_url:'https://youtube.com/channel/bukan-video',thumbnail_alt:'Gambar',language:'id',subtitle_text:'Sub',transcript_text:'Transkrip',speaker_type:'GENERAL'}).success,false);
  assert.equal(videoSchema.safeParse({title:'Video',description:'Deskripsi',source_type:'EXTERNAL',external_url:'https://youtu.be/mLfb3mMNubc',thumbnail_alt:'Gambar',language:'id',subtitle_text:'Sub',transcript_text:'Transkrip',speaker_type:'GENERAL'}).success,true);
  assert.equal(facilitySchema.safeParse({name:'Fasilitas',facility_type:'KLINIK',region_id:'11111111-1111-4111-8111-111111111111',address:'Alamat',service_hours:'Senin',source_name:'Sumber',services:['NOT_A_SERVICE']}).success,false);
});

test('stage 2 migration remains additive and contains aggregate privacy constraints', () => {
  const sql=readFileSync(path.join(__dirname,'../prisma/migrations/20260805120000_stage2_public_information/migration.sql'),'utf8');
  assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
  assert.match(sql,/case_statistics_count_check/i);
  assert.match(sql,/case_statistics_period_check/i);
  assert.match(sql,/CREATE TABLE "media_consents"/);
});
