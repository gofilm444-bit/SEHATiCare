# SEHATiCare API

Backend API MVP Fase 1 untuk sistem edukasi, konsultasi, dan pendampingan kesehatan berbasis empati. Stack: Fastify + TypeScript + Prisma (PostgreSQL) + Minio untuk voice note storage.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Salin `.env.example` ke `.env` lalu isi nilai yang kuat:
   - Database: `DATABASE_URL`
   - JWT: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL_MINUTES`, `JWT_REFRESH_TTL_DAYS`
   - Internal AI: `INTERNAL_AI_TOKEN`
   - Storage (Minio/S3): `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_USE_SSL`, `STORAGE_SIGNED_URL_TTL_SECONDS`
3. Jalankan Prisma migrate (buat database Postgres terlebih dahulu):
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

### Menjalankan Postgres (opsional via Docker)

Jika belum punya Postgres lokal, jalankan cepat dengan Docker:
```bash
docker run --name sehaticare-postgres -e POSTGRES_DB=sehaticare -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```
Lalu set `DATABASE_URL` (contoh):
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sehaticare?schema=public"
```

### Menjalankan Postgres (macOS tanpa Docker)

- Postgres.app: install dan klik **Start**, lalu set `DATABASE_URL` sesuai user/db yang kamu buat.
- Homebrew (contoh Postgres 16):
  ```bash
  brew install postgresql@16
  brew services start postgresql@16
  createdb sehaticare
  ```

## Menjalankan

- Development: `npm run dev`
- Build: `npm run build`
- Start (production build): `npm start`
- Seed data (admin + verified doctor + artikel edukasi): `npm run seed`
- Open API docs: http://localhost:3000/docs (Authorize with `Bearer <access_token>`)
- Login for docs: request OTP (`POST /auth/otp/request`), verify (`POST /auth/otp/verify`), then click **Authorize** in Swagger UI and paste `Bearer <access_token>`.
- Default seeded password (admin/doctor/patient): `SehatiCare123!`

## Endpoint (MVP)

- Auth: `POST /auth/otp/request`, `POST /auth/otp/verify`, `GET /auth/me`
- Education: `GET /education`, `GET /education/:id`
- Consultations: `POST /consultations`, `GET /consultations?scope=mine|queue`, `POST /consultations/:id/join`, `POST /consultations/:id/close`, `GET /consultations/:id`
- Chat: `GET /consultations/:id/messages`, `POST /consultations/:id/messages/text`
- Voice Notes: `POST /consultations/:id/voice-notes/upload-url`, `POST /consultations/:id/voice-notes/commit`, `GET /voice-notes/:voiceNoteId`
- AI (internal): `POST /consultations/:id/ai/reply`
- Admin: `POST /admin/doctors`, `GET /admin/audit-logs`

## Keamanan & Privasi

- JWT access + refresh; refresh token disimpan sebagai hash.
- OTP disimpan sebagai hash + salt, tidak pernah dilog.
- Rate limit pada permintaan OTP; verifikasi OTP diblokir setelah banyak percobaan.
- Konsultasi status `SELESAI` bersifat read-only; AI berhenti setelah dokter aktif.
- Logging menggunakan Pino dengan redaksi header sensitif dan konten chat.
- Voice note menggunakan signed URL (PUT/GET) yang pendek; kunci objek acak, tipe/ukuran divalidasi.

## Catatan

- Pastikan dokter diverifikasi (role DOKTER + doctor_profile VERIFIED) sebelum akses antrean/join.
- Audit log dibuat pada aksi penting: join konsultasi, close konsultasi, verifikasi dokter.
