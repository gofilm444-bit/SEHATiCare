import '../src/config/env';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

const categories = [
  { id: '31000000-0000-4000-8000-000000000001', slug: 'dasar-hiv', name: 'Dasar HIV' },
  { id: '31000000-0000-4000-8000-000000000002', slug: 'pencegahan-dan-tes', name: 'Pencegahan dan Tes' },
  { id: '31000000-0000-4000-8000-000000000003', slug: 'pengobatan-hiv', name: 'Pengobatan HIV' },
  { id: '31000000-0000-4000-8000-000000000004', slug: 'dukungan-psikososial', name: 'Dukungan Psikososial' }
];

const articles = [
  {
    id: '32000000-0000-4000-8000-000000000001',
    categorySlug: 'dasar-hiv',
    slug: 'memahami-perbedaan-hiv-dan-aids',
    title: 'Memahami Perbedaan HIV dan AIDS',
    summary: 'HIV adalah virus yang menyerang sistem kekebalan tubuh, sedangkan AIDS adalah tahap paling lanjut dari infeksi HIV yang tidak ditangani.',
    body: `## HIV dan AIDS tidak sama

HIV adalah virus yang menyerang sistem kekebalan tubuh. AIDS adalah tahap paling lanjut dari infeksi HIV. Seseorang yang hidup dengan HIV tidak otomatis berada pada tahap AIDS.

Dengan diagnosis, pengobatan antiretroviral (ARV), dan perawatan yang sesuai, HIV dapat dikelola sebagai kondisi kesehatan kronis. Orang dengan HIV dapat menjalani hidup yang panjang dan sehat.

Gejala saja tidak dapat memastikan status HIV. Tes HIV yang dilakukan sesuai strategi nasional dan dikonfirmasi oleh tenaga kesehatan diperlukan untuk menegakkan diagnosis.

Materi ini untuk edukasi umum dan tidak menggantikan pemeriksaan atau nasihat tenaga kesehatan.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 2,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000002',
    categorySlug: 'dasar-hiv',
    slug: 'cara-hiv-menular-dan-tidak-menular',
    title: 'Cara HIV Menular dan Tidak Menular',
    summary: 'HIV dapat menular melalui cairan tubuh tertentu, tetapi tidak melalui pelukan, berjabat tangan, berbagi makanan, atau pergaulan sehari-hari.',
    body: `## Kenali faktanya, kurangi stigma

HIV dapat ditularkan melalui darah, air mani, cairan vagina, dan ASI dari seseorang yang hidup dengan HIV. Penularan juga dapat terjadi dari ibu ke bayi selama kehamilan, persalinan, atau menyusui.

HIV tidak menular melalui pelukan, berjabat tangan, berbagi makanan atau air, maupun penggunaan barang sehari-hari bersama. Interaksi sosial biasa dengan orang yang hidup dengan HIV aman.

Informasi yang benar membantu setiap orang mengambil langkah pencegahan sekaligus mengurangi stigma. Perlakukan orang yang hidup dengan HIV dengan hormat dan tanpa diskriminasi.

Materi ini untuk edukasi umum dan tidak menggantikan nasihat tenaga kesehatan.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 2,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000003',
    categorySlug: 'pencegahan-dan-tes',
    slug: 'tes-hiv-dan-masa-jendela',
    title: 'Tes HIV dan Masa Jendela',
    summary: 'Tes adalah satu-satunya cara mengetahui status HIV. Waktu tes dan kemungkinan tes ulang perlu dipertimbangkan setelah paparan yang baru terjadi.',
    body: `## Mengapa waktu tes penting

Tes diagnostik cepat dapat memberikan hasil pada hari yang sama. Namun, satu hasil reaktif belum menjadi diagnosis akhir; tes konfirmasi oleh tenaga kesehatan tetap diperlukan.

Banyak tes mendeteksi antibodi yang dibentuk tubuh terhadap HIV. Pada masa awal setelah paparan, kadar antibodi mungkin belum cukup untuk terdeteksi. WHO menjelaskan bahwa pada kebanyakan orang antibodi berkembang dalam 28 hari. Bila paparan berisiko baru terjadi dan hasil tes negatif, tenaga kesehatan dapat menyarankan tes ulang.

Jangan menentukan waktu tes atau menafsirkan hasil sendirian. Ceritakan waktu dan jenis paparan kepada tenaga kesehatan agar mendapat saran yang sesuai.

Materi ini untuk edukasi umum dan tidak menggantikan pemeriksaan medis.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 3,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000004',
    categorySlug: 'pencegahan-dan-tes',
    slug: 'pilihan-pencegahan-hiv',
    title: 'Pilihan Pencegahan HIV',
    summary: 'Pencegahan dapat mencakup kondom, tes HIV dan IMS, alat suntik steril, PrEP, PEP, serta pengobatan ARV yang efektif.',
    body: `## Pencegahan disesuaikan dengan kebutuhan

Risiko HIV dapat dikurangi dengan penggunaan kondom yang benar, tes HIV dan infeksi menular seksual, serta tidak berbagi jarum atau alat suntik.

PrEP adalah obat pencegahan bagi orang tanpa HIV yang berisiko terpapar. PEP adalah obat darurat setelah kemungkinan paparan dan perlu dimulai secepat mungkin. Keduanya harus dibicarakan dengan tenaga kesehatan; jangan memulai atau menghentikan obat sendiri.

Bagi orang yang hidup dengan HIV, pengobatan ARV yang efektif menjaga kesehatan dan menurunkan jumlah virus. Ketika viral load dipertahankan tidak terdeteksi, HIV tidak ditularkan melalui hubungan seksual.

Materi ini untuk edukasi umum. Konsultasikan pilihan pencegahan yang sesuai dengan tenaga kesehatan.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 3,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000005',
    categorySlug: 'pengobatan-hiv',
    slug: 'arv-viral-load-dan-u-equals-u',
    title: 'ARV, Viral Load, dan U=U',
    summary: 'Pengobatan ARV dapat menekan viral load. Viral load yang tidak terdeteksi dan dipertahankan berarti HIV tidak ditularkan melalui hubungan seksual.',
    body: `## Undetectable equals Untransmittable

Obat antiretroviral (ARV) menghambat HIV berkembang biak dan membantu sistem kekebalan tubuh tetap kuat. Pemeriksaan viral load digunakan untuk melihat jumlah virus di dalam darah dan menilai keberhasilan pengobatan.

U=U berarti “tidak terdeteksi = tidak menularkan”. Bukti ilmiah menunjukkan bahwa orang dengan HIV yang menjalani ARV dan mempertahankan viral load tidak terdeteksi tidak menularkan HIV kepada pasangan seksualnya.

U=U bergantung pada pengobatan yang efektif, kepatuhan, pemantauan viral load, serta dukungan layanan kesehatan. U=U tidak mencegah infeksi menular seksual lain atau kehamilan.

Jangan mengubah pengobatan berdasarkan materi ini. Diskusikan hasil viral load dan rencana terapi dengan tenaga kesehatan.`,
    source: 'https://www.unaids.org/en/resources/documents/2024/undetectable-untransmittable',
    minutes: 3,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000006',
    categorySlug: 'pengobatan-hiv',
    slug: 'menjaga-kepatuhan-pengobatan-hiv',
    title: 'Menjaga Kepatuhan Pengobatan HIV',
    summary: 'Kepatuhan mencakup memulai terapi, minum obat sesuai resep, dan menghadiri kontrol agar pengobatan tetap bekerja dengan baik.',
    body: `## Buat pengobatan lebih mudah dijalani

Kepatuhan pengobatan HIV mencakup memulai terapi, minum obat sesuai resep, dan mengikuti jadwal kontrol. Konsistensi membantu mencegah virus berkembang biak serta mengurangi risiko resistansi obat dan kegagalan terapi.

Hambatan dapat berupa jadwal yang sibuk, efek samping, kesulitan memperoleh obat, atau kekhawatiran akan penilaian orang lain. Pengingat yang privat, kotak obat, dan mengaitkan waktu minum obat dengan rutinitas harian dapat membantu sebagian orang.

Jika lupa dosis, mengalami efek samping, atau kesulitan melanjutkan terapi, hubungi tenaga kesehatan. Jangan menggandakan dosis, menghentikan, atau mengubah obat tanpa arahan.

Materi ini untuk edukasi umum dan tidak menggantikan petunjuk resep atau nasihat tenaga kesehatan.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/hiv-treatment-adherence',
    minutes: 3,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000007',
    categorySlug: 'dukungan-psikososial',
    slug: 'mengurangi-stigma-terhadap-odhiv',
    title: 'Mengurangi Stigma terhadap ODHIV',
    summary: 'Pengetahuan yang benar, bahasa yang menghormati, dan dukungan tanpa menghakimi membantu mengurangi stigma terhadap orang dengan HIV.',
    body: `## Dukungan dimulai dari cara kita bersikap

Stigma dapat membuat orang takut melakukan tes, membuka diri kepada tenaga kesehatan, atau melanjutkan pengobatan. Informasi keliru tentang cara penularan sering memperkuat stigma.

Gunakan bahasa yang menghormati, jaga kerahasiaan, dan hindari menyalahkan seseorang atas kondisi kesehatannya. Dengarkan kebutuhan orang tersebut dan tanyakan bentuk dukungan yang mereka inginkan.

HIV tidak menular melalui pergaulan sehari-hari. Orang dengan HIV berhak memperoleh pelayanan kesehatan, dukungan sosial, dan perlakuan tanpa diskriminasi.

Materi ini untuk edukasi umum. Jika stigma memengaruhi akses perawatan atau keselamatan seseorang, mintalah bantuan dari tenaga kesehatan atau layanan pendampingan yang tepercaya.`,
    source: 'https://keslan.kemkes.go.id/view_artikel/3913/stigma-pada-penderita-hivaids',
    minutes: 3,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000008',
    categorySlug: 'dukungan-psikososial',
    slug: 'merawat-kesehatan-mental-dan-mencari-dukungan',
    title: 'Merawat Kesehatan Mental dan Mencari Dukungan',
    summary: 'Kesehatan mental adalah bagian dari kesejahteraan. Dukungan sosial dan bantuan profesional dapat membantu saat tekanan terasa sulit dikelola.',
    body: `## Anda tidak harus menghadapi semuanya sendiri

Kesehatan mental membantu seseorang menghadapi tekanan hidup, belajar, bekerja, dan berhubungan dengan komunitas. Kondisinya dapat berubah dari waktu ke waktu dan dipengaruhi faktor pribadi, keluarga, sosial, serta lingkungan.

Langkah sederhana seperti menjaga rutinitas tidur, makan teratur, bergerak sesuai kemampuan, dan berbicara dengan orang tepercaya dapat mendukung kesejahteraan. Namun, langkah ini bukan pengganti perawatan profesional ketika dibutuhkan.

Carilah bantuan tenaga kesehatan bila tekanan berlangsung lama, mengganggu aktivitas, atau terasa semakin berat. Bila Anda merasa dalam bahaya atau memiliki dorongan menyakiti diri, segera hubungi layanan darurat setempat atau orang tepercaya yang dapat mendampingi.

Materi ini untuk edukasi umum dan bukan diagnosis kesehatan mental.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response',
    minutes: 3,
    featured: false
  }
];

const videos = [
  {
    id: '33000000-0000-4000-8000-000000000001',
    title: 'Cara Penularan HIV/AIDS — Kementerian Kesehatan RI',
    description: 'Edukasi awal berbahasa Indonesia mengenai pentingnya memahami penularan HIV secara benar untuk membantu mencegah stigma.',
    url: 'https://www.youtube.com/watch?v=mLfb3mMNubc',
    thumbnailAlt: 'Video edukasi Kementerian Kesehatan RI tentang cara penularan HIV/AIDS',
    accessibility: 'Bahasa: Indonesia. Caption mengikuti ketersediaan dari penerbit di YouTube.',
    summary: 'Ringkasan isi berdasarkan deskripsi resmi: masyarakat, khususnya generasi muda, diajak memiliki pengetahuan yang benar tentang HIV/AIDS dan narkoba.'
  },
  {
    id: '33000000-0000-4000-8000-000000000002',
    title: 'Bahaya HIV/AIDS dan Pentingnya Penanganan — Kementerian Kesehatan RI',
    description: 'Arsip edukasi berbahasa Indonesia tentang perkembangan HIV menjadi AIDS dan pentingnya memperoleh penanganan kesehatan.',
    url: 'https://www.youtube.com/watch?v=iRneA5GMNW0',
    thumbnailAlt: 'Video edukasi Kementerian Kesehatan RI tentang HIV/AIDS dan penanganannya',
    accessibility: 'Bahasa: Indonesia. Caption mengikuti ketersediaan dari penerbit di YouTube.',
    summary: 'Ringkasan isi berdasarkan deskripsi resmi: infeksi HIV yang tidak ditangani dapat berkembang menjadi AIDS; pengobatan membantu mengendalikan perkembangan infeksi. Untuk informasi pengobatan mutakhir, baca juga artikel bersumber WHO di aplikasi.'
  },
  {
    id: '33000000-0000-4000-8000-000000000003',
    title: 'HIV Self-testing: Questions and Answers — WHO',
    description: 'Video berbahasa Inggris dari WHO yang menjelaskan tes HIV mandiri sebagai pilihan tes yang sederhana dan privat.',
    url: 'https://www.youtube.com/watch?v=BA5E9wsEbPw',
    thumbnailAlt: 'Video tanya jawab WHO tentang tes HIV mandiri',
    accessibility: 'Bahasa: Inggris. Caption mengikuti ketersediaan dari WHO di YouTube.',
    summary: 'Ringkasan isi berdasarkan deskripsi resmi: pakar tes HIV WHO menjelaskan cara tes mandiri dapat memperluas akses tes, terutama bagi orang yang belum pernah melakukan tes.'
  },
  {
    id: '33000000-0000-4000-8000-000000000004',
    title: 'Zero Discrimination Day: Kesehatan dan Hak Asasi',
    description: 'Wawancara berbahasa Inggris dengan Direktur Regional UNAIDS tentang kesetaraan, inklusi, martabat, kesehatan, dan hak asasi manusia.',
    url: 'https://www.youtube.com/watch?v=1Ch6l0A-35w',
    thumbnailAlt: 'Wawancara tentang Hari Nol Diskriminasi bersama Direktur Regional UNAIDS',
    accessibility: 'Bahasa: Inggris. Caption mengikuti ketersediaan dari penerbit di YouTube.',
    summary: 'Ringkasan isi berdasarkan deskripsi resmi: Hari Nol Diskriminasi menegaskan hak setiap orang untuk hidup secara penuh, produktif, dan bermartabat tanpa diskriminasi.'
  }
];

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Seed konten hanya boleh dijalankan pada development atau test.');
  }

  const now = new Date();

  // Keep synthetic Stage 2 rows for auditability, but never present them as
  // real public information once verified content is available.
  const [archivedArticles, archivedVideos, archivedStatistics, hiddenFacilities] = await prisma.$transaction([
    prisma.education_articles.updateMany({
      where: {
        OR: [
          { slug: 'contoh-edukasi-aman-data-uji' },
          { slug: 'kesehatan-reproduksi-dan-pencegahan', source_reference: null }
        ]
      },
      data: { publication_status: 'ARCHIVED', is_published: false, featured: false, updated_at: now }
    }),
    prisma.education_videos.updateMany({
      where: { id: '24000000-0000-4000-8000-000000000001' },
      data: { publication_status: 'ARCHIVED', updated_at: now }
    }),
    prisma.case_statistics.updateMany({
      where: { is_sample: true },
      data: { publication_status: 'ARCHIVED', updated_at: now }
    }),
    prisma.health_facilities.updateMany({
      where: { is_sample: true },
      data: { is_active: false, updated_at: now }
    })
  ]);

  for (const category of categories) {
    await prisma.content_categories.upsert({
      where: { slug: category.slug },
      update: { name: category.name, is_active: true, updated_at: now },
      create: { ...category, is_active: true, updated_at: now }
    });
  }

  const categoryIds = new Map(
    (await prisma.content_categories.findMany({
      where: { slug: { in: categories.map((item) => item.slug) } },
      select: { id: true, slug: true }
    })).map((category) => [category.slug, category.id])
  );

  for (const [index, article] of articles.entries()) {
    const categoryId = categoryIds.get(article.categorySlug);
    if (!categoryId) throw new Error(`Kategori tidak ditemukan: ${article.categorySlug}`);
    const publishedAt = new Date(now.getTime() - index * 60_000);
    const data = {
      title: article.title,
      summary: article.summary,
      body_markdown: article.body,
      category_id: categoryId,
      thumbnail_key: null,
      thumbnail_alt: null,
      language: 'id',
      publication_status: 'PUBLISHED' as const,
      source_reference: article.source,
      reading_minutes: article.minutes,
      featured: article.featured,
      is_published: true,
      published_at: publishedAt,
      updated_at: now
    };
    await prisma.education_articles.upsert({
      where: { slug: article.slug },
      update: data,
      create: { id: article.id, slug: article.slug, ...data, created_at: now }
    });
  }

  const videoCategoryId = categoryIds.get('dasar-hiv');
  if (!videoCategoryId) throw new Error('Kategori video tidak ditemukan: dasar-hiv');
  for (const [index, video] of videos.entries()) {
    const publishedAt = new Date(now.getTime() - (articles.length + index) * 60_000);
    const data = {
      title: video.title,
      description: video.description,
      category_id: videoCategoryId,
      source_type: 'EXTERNAL' as const,
      storage_key: null,
      external_url: video.url,
      thumbnail_key: null,
      thumbnail_alt: video.thumbnailAlt,
      duration_seconds: null,
      file_size_bytes: null,
      language: 'id',
      subtitle_text: video.accessibility,
      transcript_text: video.summary,
      speaker_type: 'GENERAL' as const,
      publication_status: 'PUBLISHED' as const,
      published_at: publishedAt,
      updated_at: now
    };
    await prisma.education_videos.upsert({
      where: { id: video.id },
      update: data,
      create: { id: video.id, ...data, created_at: now }
    });
  }

  console.log(
    `Seed konten selesai: categories=${categories.length} articles=${articles.length} videos=${videos.length} ` +
    `facilities_created=0 statistics_created=0 ` +
    `legacy_hidden=${archivedArticles.count + archivedVideos.count + archivedStatistics.count + hiddenFacilities.count}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
