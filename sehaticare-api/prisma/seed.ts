import '../src/config/env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = 'SehatiCare123!';
  const password_hash = await bcrypt.hash(defaultPassword, 10);
  const now = new Date();

  const admin = await prisma.users.upsert({
    where: { email: 'admin@sehaticare.local' },
    update: {
      role: 'ADMIN',
      full_name: 'Admin SEHATiCare',
      is_active: true,
      password_hash,
      updated_at: now
    },
    create: {
      id: randomUUID(),
      email: 'admin@sehaticare.local',
      full_name: 'Admin SEHATiCare',
      role: 'ADMIN',
      is_active: true,
      password_hash,
      updated_at: now
    }
  });

    const doctor = await prisma.users.upsert({
    where: { email: 'doctor@sehaticare.local' },
    update: {
      role: 'DOKTER',
      full_name: 'Dokter SEHATiCare',
      is_active: true,
      password_hash,
      updated_at: now
    },
    create: {
      id: randomUUID(),
      email: 'doctor@sehaticare.local',
      full_name: 'Dokter SEHATiCare',
      role: 'DOKTER',
      is_active: true,
      password_hash,
      updated_at: now
      // ❌ jangan isi phone_e164 di sini
    }
  });

  const patient = await prisma.users.upsert({
    where: { email: 'patient@sehaticare.local' },
    update: {
      role: 'PASIEN',
      full_name: 'Pasien SEHATiCare',
      is_active: true,
      password_hash,
      updated_at: now
    },
    create: {
      id: randomUUID(),
      email: 'patient@sehaticare.local',
      full_name: 'Pasien SEHATiCare',
      role: 'PASIEN',
      is_active: true,
      password_hash,
      updated_at: now
      // ❌ jangan isi phone_e164 di sini juga
    }
  });


  await prisma.doctor_profiles.upsert({
    where: { user_id: doctor.id },
    update: {
      verification_status: 'VERIFIED',
      verified_at: new Date(),
      verified_by: admin.id,
      puskesmas_name: 'Puskesmas Contoh',
      str_number: 'STR-123456',
      updated_at: now
    },
    create: {
      user_id: doctor.id,
      verification_status: 'VERIFIED',
      verified_at: new Date(),
      verified_by: admin.id,
      puskesmas_name: 'Puskesmas Contoh',
      str_number: 'STR-123456',
      updated_at: now
    }
  });

  const educationCategory = 'HIV/AIDS';
  const educationSummary =
    'Diagnosa HIV bisa membuat kaget dan cemas. Anda tidak sendiri—dengan pengobatan yang tepat, orang dengan HIV bisa hidup panjang, sehat, dan produktif. Artikel ini membantu Anda menenangkan diri dan mengambil langkah aman pertama.';

  const educationBody = [
    '1) Tarik napas dulu — wajar merasa kaget',
    '- Reaksi seperti takut, sedih, marah, atau bingung adalah normal.',
    '- Hindari menyalahkan diri sendiri. Fokus pada langkah berikutnya.',
    '',
    '2) HIV bukan akhir hidup',
    '- Dengan terapi ARV yang rutin, jumlah virus bisa ditekan.',
    '- Saat virus tidak terdeteksi (undetectable), risiko penularan melalui hubungan seksual bisa sangat rendah (ikuti arahan tenaga kesehatan).',
    '',
    '3) Langkah 24–72 jam pertama (praktis)',
    '- Jika belum, jadwalkan kunjungan ke layanan HIV/klinik untuk evaluasi dan mulai ARV.',
    '- Tulis pertanyaan yang ingin ditanyakan (efek samping ARV, jadwal kontrol, pemeriksaan CD4/viral load).',
    '- Pilih 1 orang tepercaya untuk dukungan emosional (jika aman).',
    '',
    '4) Cara mengelola stres (yang benar-benar membantu)',
    '- Tidur cukup, makan teratur, minum air.',
    '- Batasi pencarian informasi acak di internet yang membuat panik.',
    '- Teknik 3 menit: tarik napas 4 detik, tahan 2, hembus 6—ulang 5 kali.',
    '',
    '5) Keamanan & privasi',
    '- Informasi kesehatan Anda bersifat rahasia.',
    '- Jika Anda belum siap bercerita, tidak perlu memaksakan diri.',
    '',
    '6) Kapan harus segera mencari bantuan',
    '- Jika merasa putus asa berat, tidak bisa tidur berhari-hari, atau muncul pikiran menyakiti diri, segera hubungi tenaga kesehatan/pendamping terdekat.',
    '',
    'Jika Anda ingin, Anda bisa mulai konsultasi lewat aplikasi ini. Ceritakan keluhan fisik atau perasaan Anda—kami akan bantu langkah selanjutnya.'
  ].join('\n');

  const body_markdown = [
    `<!-- sehaticare:category=${educationCategory} -->`,
    `<!-- sehaticare:summary=${educationSummary} -->`,
    '',
    educationBody
  ].join('\n');

  await prisma.education_articles.upsert({
    where: { slug: 'kesehatan-reproduksi-dan-pencegahan' },
    update: {
      title: 'Edukasi Awal: Baru Didiagnosis HIV? Ini Langkah Aman Tanpa Panik',
      body_markdown,
      is_published: true,
      published_at: new Date(),
      updated_by: admin.id,
      updated_at: now
    },
    create: {
      id: randomUUID(),
      title: 'Edukasi Awal: Baru Didiagnosis HIV? Ini Langkah Aman Tanpa Panik',
      slug: 'kesehatan-reproduksi-dan-pencegahan',
      body_markdown,
      is_published: true,
      published_at: new Date(),
      created_by: admin.id,
      updated_by: admin.id,
      updated_at: now
    }
  });
}

main()
  .then(() => {
    console.log('Seed completed');
  })
  .catch((e) => {
    console.error('Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
