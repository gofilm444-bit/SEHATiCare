import '../src/config/env';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

const categories = [
  { id: '31000000-0000-4000-8000-000000000001', slug: 'dasar-hiv', name: 'Dasar HIV' },
  { id: '31000000-0000-4000-8000-000000000002', slug: 'pencegahan-dan-tes', name: 'Pencegahan dan Tes' },
  { id: '31000000-0000-4000-8000-000000000003', slug: 'pengobatan-hiv', name: 'Pengobatan HIV' },
  { id: '31000000-0000-4000-8000-000000000004', slug: 'dukungan-psikososial', name: 'Dukungan Psikososial' },
  { id: '31000000-0000-4000-8000-000000000005', slug: 'hak-dan-layanan', name: 'Hak dan Akses Layanan' }
];

const articles = [
  {
    id: '32000000-0000-4000-8000-000000000001',
    categorySlug: 'dasar-hiv',
    slug: 'memahami-perbedaan-hiv-dan-aids',
    title: 'Memahami Perbedaan HIV dan AIDS',
    summary: 'HIV adalah virus yang menyerang sistem kekebalan tubuh, sedangkan AIDS adalah tahap lanjut dari infeksi HIV yang tidak ditangani.',
    body: `## HIV dan AIDS Tidak Sama

HIV (Human Immunodeficiency Virus) adalah virus yang secara bertahap menyerang sel-sel kekebalan tubuh, khususnya sel limfosit CD4 yang berperan melawan infeksi. Sedangkan AIDS (Acquired Immunodeficiency Syndrome) adalah sekumpulan gejala dan infeksi oportunistik yang timbul ketika sistem kekebalan tubuh telah mengalami kerusakan berat.

Seseorang yang hidup dengan HIV tidak otomatis berada pada tahap AIDS. Dengan penegakan diagnosis sedini mungkin dan kepatuhan konsumsi terapi antiretroviral (ARV), replikasi virus dapat ditekan hingga tingkat yang tidak terdeteksi di dalam darah. Hal ini memungkinkan sistem imun pulih dan mencegah perkembangan infeksi ke tahap AIDS.

### Perjalanan Klinis dan Deteksi Dini
1. **Infeksi Akut**: Terjadi beberapa minggu pasca paparan awal. Gejala sering kali menyerupai flu ringan (demam, sakit tenggorokan, ruam) atau bahkan tanpa gejala sama sekali.
2. **Fase Asimtomatik (Laten Klinis)**: Virus terus bereplikasi secara perlahan tanpa menimbulkan gejala nyata selama bertahun-tahun.
3. **Fase Lanjut (AIDS)**: Terjadi jika infeksi tidak terdiagnosis dan tidak diobati, ditandai oleh penurunan drastis hitung CD4 (umumnya di bawah 200 sel/µL) dan munculnya infeksi oportunistik seperti tuberkulosis atau infeksi jamur berat.

Gejala fisik semata tidak pernah bisa dijadikan dasar untuk memastikan status HIV. Satu-satunya cara yang akurat dan sah adalah melalui pemeriksaan laboratorium tes HIV yang dikonfirmasi oleh tenaga kesehatan berwenang.

Materi ini disusun untuk tujuan edukasi kesehatan masyarakat dan tidak menggantikan konsultasi, diagnosis, atau nasihat medis dari tenaga kesehatan profesional.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 3,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000002',
    categorySlug: 'dasar-hiv',
    slug: 'cara-hiv-menular-dan-tidak-menular',
    title: 'Cara HIV Menular dan Tidak Menular',
    summary: 'HIV hanya dapat menular melalui cairan tubuh tertentu, bukan melalui interaksi sosial biasa, jabat tangan, atau alat makan bersama.',
    body: `## Kenali Faktanya, Hentikan Stigma

HIV adalah virus yang rapuh di luar tubuh manusia dan memerlukan jalur penularan langsung melalui cairan biologis tertentu dengan konsentrasi virus yang cukup.

### Cairan Tubuh yang DAPAT Menularkan HIV:
- **Darah**: Melalui transfusi darah yang tidak diskrining (sangat jarang dengan sistem skrining modern) atau penggunaan jarum suntik/tindik bersama yang tidak steril.
- **Air Mani (Semen) dan Cairan Pra-seminal**: Melalui hubungan seksual tanpa kondom atau tanpa perlindungan ARV efektif.
- **Cairan Vagina dan Rektal**: Melalui hubungan seksual penetratif tanpa pengaman.
- **Air Susu Ibu (ASI)**: Penularan dari ibu ke anak selama menyusui (dapat dicegah hingga risiko minimal dengan kepatuhan terapi ARV).

### HIV TIDAK Menular Melalui:
- Berjabat tangan, berpelukan, atau mencium pipi.
- Air liur, keringat, air mata, atau dahak.
- Berbagi makanan, minuman, sendok, piring, atau gelas.
- Dudukan toilet, kamar mandi, atau kolam renang umum.
- Gigitan nyamuk atau serangga lainnya (HIV tidak dapat bereplikasi dalam tubuh serangga).
- Tinggal serumah atau bekerja bersama orang dengan HIV (ODHIV).

Mengetahui fakta penularan yang benar adalah pondasi utama dalam melindungi diri, memperlakukan orang dengan HIV dengan penuh rasa hormat, dan menghapus diskriminasi di lingkungan keluarga maupun tempat kerja.

Materi ini disusun untuk tujuan edukasi kesehatan masyarakat dan tidak menggantikan nasihat medis tenaga kesehatan.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 3,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000003',
    categorySlug: 'dasar-hiv',
    slug: 'mitos-vs-fakta-tentang-hiv',
    title: 'Mitos vs Fakta: Meluruskan Kesalahpahaman Seputar HIV',
    summary: 'Bongkar mitos umum seputar penularan, harapan hidup, dan stigma moralitas dengan bukti medis mutakhir.',
    body: `## Meluruskan Informasi yang Keliru

Banyak kecemasan dan stigma di masyarakat timbul karena mitos-mitos usang yang tidak berdasar secara medis. Mari kita bandingkan mitos dan fakta ilmiahnya:

### Mitos 1: "HIV adalah vonis mati tanpa masa depan."
- **Fakta**: Terapi antiretroviral (ARV) modern telah mengubah HIV menjadi kondisi kesehatan kronis yang dapat dikelola dengan sangat baik, serupa dengan diabetes atau hipertensi. Orang dengan HIV yang patuh menjalani pengobatan memiliki angka harapan hidup dan kualitas hidup yang setara dengan populasi umum.

### Mitos 2: "HIV dapat menular lewat alat makan bersama atau gigitan nyamuk."
- **Fakta**: HIV tidak dapat hidup di luar tubuh manusia atau bereplikasi pada serangga. Air liur tidak memiliki konsentrasi virus yang cukup untuk menularkan HIV. Anda tidak akan tertular hanya karena makan bersama atau digigit nyamuk di ruangan yang sama.

### Mitos 3: "HIV adalah akibat hukuman moral atau kutukan."
- **Fakta**: HIV adalah agen infeksius biologis (virus), bukan cerminan moralitas seseorang. Siapa pun dapat terpapar virus jika mengalami kontak dengan cairan penular, termasuk bayi yang dilahirkan atau tenaga medis yang mengalami kecelakaan kerja.

### Mitos 4: "Orang dengan HIV pasti menularkan virus kepada pasangannya."
- **Fakta**: Melalui prinsip ilmiah **U=U (Undetectable = Untransmittable)**, orang dengan HIV yang rutin minum ARV dan memiliki viral load tidak terdeteksi (undetectable) tidak akan menularkan HIV kepada pasangan seksualnya.

### Mitos 5: "Ibu hamil dengan HIV pasti menularkan ke bayinya."
- **Fakta**: Program Pencegahan Penularan dari Ibu ke Anak (PPIA/PMTCT) melalui konsumsi ARV selama kehamilan dan persalinan yang terencana dapat menekan risiko penularan ke bayi hingga di bawah 1–2%.

Materi ini disusun untuk edukasi kesehatan masyarakat dan meluruskan stigma. Konsultasikan keraguan Anda kepada dokter atau konselor kesehatan terpercaya.`,
    source: 'https://p2pm.kemkes.go.id/',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000004',
    categorySlug: 'pencegahan-dan-tes',
    slug: 'tes-hiv-dan-masa-jendela',
    title: 'Tes HIV dan Masa Jendela (Window Period)',
    summary: 'Satu-satunya cara memastikan status HIV adalah melalui tes laboratorium. Pahami masa jendela agar hasil tes dapat diinterpretasikan secara akurat.',
    body: `## Mengapa Waktu Tes Begitu Menentukan?

Tes diagnostik HIV bertujuan mendeteksi keberadaan virus atau antibodi yang dihasilkan tubuh sebagai respons imun terhadap virus. Masa jendela (*window period*) adalah rentang waktu antara saat seseorang terpapar virus hingga tes laboratorium dapat mendeteksi penanda infeksi tersebut secara andal.

### Tiga Jenis Utama Tes HIV dan Masa Jendelanya:
1. **Tes Cepat Antibodi (Rapid Diagnostic Test / RDT)**:
   - Mendeteksi antibodi spesifik HIV dalam darah ujung jari atau serum.
   - Masa jendela umumnya berkisar antara **3 hingga 12 minggu** (21–84 hari). Sebagian besar orang membentuk antibodi yang cukup dalam kurun 4 minggu.
2. **Tes Kombinasi Antigen/Antibodi Generasi ke-4**:
   - Mendeteksi protein virus (antigen p24) sekaligus antibodi tubuh.
   - Masa jendela lebih singkat, yaitu sekitar **18 hingga 45 hari** dari paparan.
3. **Tes Asam Nukleat (NAT / RNA / Viral Load)**:
   - Mendeteksi langsung materi genetik virus di dalam darah.
   - Masa jendela paling singkat, yaitu **10 hingga 33 hari** pasca paparan. Biasanya digunakan untuk konfirmasi khusus atau pemantauan klinis.

### Bagaimana Bila Hasil Tes Awal Non-Reaktif (Negatif)?
Jika tes dilakukan di dalam masa jendela setelah paparan berisiko baru, hasil negatif belum sepenuhnya memastikan Anda bebas dari infeksi. Tenaga kesehatan akan menganjurkan tes ulang konfirmasi setelah masa jendela terlampaui (biasanya pada bulan ke-3 pasca insiden paparan).

Satu hasil tes reaktif (positif) pada tes cepat awal selalu memerlukan konfirmasi lanjutan sesuai algoritma strategi diagnostik nasional sebelum diagnosis ditegakkan secara resmi.

Materi ini untuk edukasi umum dan tidak menggantikan pemeriksaan medis di fasilitas pelayanan kesehatan.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000005',
    categorySlug: 'pencegahan-dan-tes',
    slug: 'pilihan-pencegahan-hiv',
    title: 'Pilihan Pencegahan HIV Komprehensif',
    summary: 'Pencegahan kombinasi mencakup kondom, penggunaan alat steril, PrEP, PEP, serta terapi ARV sebagai pencegahan (TasP).',
    body: `## Pencegahan Berbasis Bukti Ilmiah

Strategi pencegahan HIV saat ini menggunakan pendekatan kombinasi biomedis, perilaku, dan struktural untuk memberikan perlindungan optimal sesuai kebutuhan individu:

### 1. Penggunaan Pengaman Barrier (Kondom)
Penggunaan kondom secara konsisten dan benar memberikan perlindungan ganda: mencegah penularan HIV dan infeksi menular seksual (IMS) lainnya seperti sifilis, gonore, dan klamidia, serta mencegah kehamilan yang tidak direncanakan.

### 2. Pengurangan Bahaya (Harm Reduction)
Bagi pengguna napza suntik, tidak berbagi jarum, spuit, atau wadah pencampur obat secara mutlak mencegah penularan darah langsung. Layanan jarum suntik steril tersedia di puskesmas rujukan tertentu.

### 3. Profilaksis Pra-Pajanan (PrEP)
Obat antiretroviral yang dikonsumsi secara teratur oleh individu dengan status HIV negatif yang memiliki risiko paparan signifikan untuk mencegah virus menginfeksi sel tubuh.

### 4. Profilaksis Pasca-Pajanan (PEP)
Obat darurat yang harus diminum secepat mungkin (maksimal 72 jam) setelah insiden paparan berisiko tunggal untuk mencegah virus menetap di dalam tubuh.

### 5. Treatment as Prevention (TasP / U=U)
Orang dengan HIV yang rutin menjalani terapi ARV dan mencapai viral load tidak terdeteksi secara efektif tidak menularkan virus kepada pasangannya secara seksual.

Konsultasikan langkah pencegahan yang paling tepat untuk Anda bersama dokter atau konselor di fasilitas pelayanan kesehatan.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 3,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000006',
    categorySlug: 'pencegahan-dan-tes',
    slug: 'mengenal-prep-pencegahan-sebelum-paparan',
    title: 'Mengenal PrEP: Perlindungan Sebelum Paparan',
    summary: 'PrEP adalah terapi preventif harian bagi individu HIV-negatif berisiko tinggi. Ketahui syarat skrining, efektivitas, dan batasannya.',
    body: `## Apa Itu PrEP (Pre-Exposure Prophylaxis)?

PrEP adalah kombinasi obat antiretroviral yang diminum oleh orang yang **belum terinfeksi HIV (status HIV negatif)** sebelum terjadi potensi paparan, untuk mencegah virus HIV berkembang biak di dalam tubuh jika terjadi paparan.

### Fakta Kunci Mengenai PrEP:
- **Tingkat Efektivitas Tinggi**: Jika dikonsumsi sesuai petunjuk secara konsisten, PrEP dapat menurunkan risiko tertular HIV dari hubungan seksual hingga lebih dari 99%.
- **Syarat Wajib Skrining Awal**: Seseorang WAJIB menjalani tes HIV terlebih dahulu dan dipastikan berstatus HIV-negatif sebelum memulai PrEP. Mengonsumsi PrEP saat sudah terinfeksi HIV tanpa pengawasan dapat memicu resistansi obat.
- **Pemantauan Fungsi Ginjal**: Diperlukan pemeriksaan laboratorium berkala terhadap fungsi ginjal (kreatinin serum) dan skrining infeksi menular seksual (IMS) setiap 3 bulan sekali.
- **Bukan Pengganti Kondom**: PrEP HANYA mencegah penularan HIV. PrEP **TIDAK melindungi** dari infeksi menular seksual lain (seperti sifilis, gonore, hepatitis B/C) atau mencegah kehamilan.

### Siapa yang Membutuhkan PrEP?
Individu yang aktif secara seksual dengan pasangan yang status HIV-nya belum diketahui atau belum mencapai viral load tidak terdeteksi, individu yang memiliki pasangan seksual multipel, atau pengguna napza suntik yang berisiko terpapar jarum tidak steril.

Jangan membeli obat PrEP secara ilegal atau memulai tanpa resep dan pengawasan dokter. Layanan PrEP resmi kini tersedia di puskesmas dan klinik rujukan program pemerintah.`,
    source: 'https://www.cdc.gov/hiv/basics/prep.html',
    minutes: 3,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000007',
    categorySlug: 'pencegahan-dan-tes',
    slug: 'pep-profilaksis-pasca-paparan-darurat',
    title: 'PEP: Pengobatan Darurat Pasca Paparan Berisiko',
    summary: 'PEP harus dimulai maksimal 72 jam setelah insiden paparan dan diminum penuh selama 28 hari di bawah pengawasan klinis.',
    body: `## Tindakan Darurat: Waktu Sangat Menentukan

PEP (Post-Exposure Prophylaxis) adalah pengobatan darurat menggunakan obat antiretroviral (ARV) yang diberikan kepada seseorang yang berstatus HIV-negatif setelah mengalami insiden kemungkinan paparan HIV.

### Aturan Emas PEP:
1. **Waktu Emas Maksimal 72 Jam**: PEP harus dimulai secepat mungkin setelah insiden paparan terjadi, idealnya dalam kurun **2 hingga 24 jam pertama**, dan paling lambat **72 jam (3 hari)**. Semakin cepat obat diminum, semakin besar peluang mencegah virus menetap di dalam tubuh. Setelah 72 jam, PEP tidak lagi efektif.
2. **Durasi Penuh 28 Hari**: Obat PEP harus diminum setiap hari pada jam yang sama tanpa terputus selama **28 hari berturut-turut**. Menghentikan obat lebih awal dapat menggagalkan perlindungan dan memicu resistansi.
3. **Pemeriksaan dan Pendampingan Dokter**: Tenaga medis akan melakukan tes HIV awal, menilai tingkat risiko paparan, memeriksa kemungkinan efek samping, dan menjadwalkan tes HIV konfirmasi pada akhir masa terapi (bulan ke-1 dan bulan ke-3).

### Situasi yang Memerlukan Evaluasi PEP:
- Kondom bocor, robek, atau terlepas saat berhubungan seksual dengan pasangan yang diketahui atau dicurigai hidup dengan HIV dengan viral load terdeteksi.
- Korban kekerasan seksual atau pemerkosaan.
- Tenaga kesehatan yang mengalami kecelakaan kerja tertusuk jarum suntik bekas pasien terkonfirmasi HIV.

PEP adalah langkah darurat insidental, bukan pengganti metode pencegahan terencana seperti kondom atau PrEP. Jika Anda mengalami insiden paparan berisiko dalam kurun 72 jam terakhir, segera kunjungi Instalasi Gawat Darurat (IGD) rumah sakit atau Puskesmas layanan HIV terdekat.`,
    source: 'https://www.cdc.gov/hiv/basics/pep.html',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000008',
    categorySlug: 'pengobatan-hiv',
    slug: 'arv-viral-load-dan-u-equals-u',
    title: 'ARV, Viral Load, dan Revolusi Ilmiah U=U',
    summary: 'Undetectable = Untransmittable. Viral load tidak terdeteksi yang dipertahankan minimal 6 bulan berarti nol risiko penularan seksual.',
    body: `## Revolusi Ilmiah: Undetectable Equals Untransmittable

Salah satu capaian ilmiah terpenting dalam sejarah kesehatan masyarakat global adalah konsensus **U=U (Undetectable = Untransmittable)**, atau dalam bahasa Indonesia: **Tidak Terdeteksi = Tidak Menularkan**.

### Apa Dasar Ilmiah U=U?
Studi berskala global yang melibatkan puluhan ribu pasangan serodiskordan (salah satu pasangan hidup dengan HIV dan pasangannya HIV-negatif), seperti studi klinis PARTNER 1, PARTNER 2, dan Opposites Attract, membuktikan bahwa:
> **Ketika seseorang dengan HIV rutin mengonsumsi terapi ARV hingga jumlah virus di dalam darahnya ditekan sampai tingkat tidak terdeteksi (<200 kopi/mL), risiko penularan HIV kepada pasangan seksualnya adalah NOL (0%).**

### Kriteria dan Syarat Keberlakuan U=U:
1. **Pemeriksaan Viral Load Rutin**: Hasil tes viral load laboratorium menunjukkan angka di bawah 200 kopi/mL (atau di bawah batas deteksi alat, misalnya <50 kopi/mL).
2. **Durasi Kestabilan Minimal 6 Bulan**: Tingkat virus tidak terdeteksi telah tercapai dan dipertahankan secara stabil minimal selama 6 bulan berturut-turut.
3. **Kepatuhan Berkelanjutan**: Terapi ARV tetap diminum setiap hari sesuai anjuran tanpa pernah dihentikan atau dikurangi dosisnya secara sepihak.

### Batasan Penting yang Harus Dipahami:
- U=U berlaku secara spesifik untuk **penularan melalui hubungan seksual**.
- U=U **TIDAK melindungi dari infeksi menular seksual (IMS) lainnya** seperti sifilis, kencing nanah (gonore), atau herpes genital, serta tidak mencegah kehamilan.
- Untuk penularan lewat ASI atau penggunaan jarum suntik bersama, risiko penularan berkurang sangat drastis namun panduan medis menyarankan kehati-hatian ekstra dan konsultasi intensif dengan dokter spesialis.

U=U adalah bukti nyata bahwa stigma terhadap orang dengan HIV tidak lagi memiliki pijakan ilmiah. Orang dengan HIV dapat menjalin hubungan cinta, berumah tangga, dan merencanakan masa depan dengan tenang dan setara.`,
    source: 'https://www.unaids.org/en/resources/documents/2024/undetectable-untransmittable',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000009',
    categorySlug: 'pengobatan-hiv',
    slug: 'memahami-viral-load-dan-hitung-cd4',
    title: 'Memahami Perbedaan Viral Load dan Hitung CD4',
    summary: 'Ketahui peran hitung CD4 sebagai indikator kekuatan daya tahan tubuh dan Viral Load sebagai pengukur keberhasilan terapi ARV.',
    body: `## Dua Indikator Utama Pemantauan HIV

Dalam pemantauan klinis pasien yang hidup dengan HIV, dokter menggunakan dua parameter laboratorium penting: **Hitung Sel CD4** dan **Pemeriksaan Viral Load (VL)**. Keduanya memiliki fungsi yang berbeda namun saling melengkapi.

### 1. Hitung Sel CD4: Indikator Benteng Pertahanan Imun
- **Apa yang diukur?**: Jumlah sel darah putih jenis limfosit T CD4 per mikroliter darah (sel/µL). Sel ini berfungsi sebagai "komandan" yang mengoordinasikan sistem pertahanan tubuh melawan infeksi.
- **Nilai Normal**: Pada orang dewasa sehat, jumlah CD4 berkisar antara **500 hingga 1.500 sel/µL**.
- **Makna Klinis**: Jika jumlah CD4 turun di bawah 200 sel/µL, tubuh berada dalam kondisi rentan terhadap infeksi oportunistik berat (tahap AIDS). Kenaikan CD4 selama terapi ARV menandakan sistem kekebalan tubuh sedang pulih.

### 2. Viral Load (HIV RNA): Indikator Replikasi Virus
- **Apa yang diukur?**: Jumlah kopi materi genetik virus HIV per mililiter plasma darah (kopi/mL).
- **Target Terapi**: Target utama pengobatan ARV adalah mencapai **Viral Load Tidak Terdeteksi (Undetectable)**, yang umumnya didefinisikan di bawah ambang deteksi alat uji laboratorium (<50 atau <200 kopi/mL).
- **Makna Klinis**: Viral load adalah ukuran langsung keberhasilan obat. Jika viral load tidak terdeteksi, virus berhenti merusak sel CD4, sistem imun dapat pulih kembali, dan transmisi seksual dicegah sepenuhnya (U=U).

### Hubungan Keduanya dalam Terapi:
Ibaratkan infeksi HIV sebagai pertempuran: **Viral Load adalah jumlah musuh (virus)**, sedangkan **CD4 adalah jumlah prajurit benteng pertahanan tubuh Anda**. Terapi ARV bekerja melucuti musuh hingga jumlahnya mendekati nol (viral load ditekan), sehingga prajurit benteng (CD4) memiliki ruang untuk bertambah kuat kembali.

Pemeriksaan viral load dianjurkan pada bulan ke-6 setelah memulai ARV, kemudian dievaluasi secara berkala setiap 6 hingga 12 bulan sesuai petunjuk dokter.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/hiv-treatment-adherence',
    minutes: 3,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000010',
    categorySlug: 'pengobatan-hiv',
    slug: 'menjaga-kepatuhan-pengobatan-hiv',
    title: 'Menjaga Kepatuhan Terapi ARV dan Mencegah Resistansi',
    summary: 'Kepatuhan minum obat pada jam yang sama setiap hari menjaga kadar obat tetap efektif dan melindungi Anda dari risiko resistansi virus.',
    body: `## Disiplin Minum Obat: Kunci Kebugaran Jangka Panjang

Terapi Antiretroviral (ARV) bekerja dengan cara menekan kemampuan virus HIV untuk menggandakan diri di dalam tubuh. Agar obat dapat bekerja secara efektif selama 24 jam penuh, kadar zat aktif obat di dalam aliran darah harus selalu berada di atas batas minimal konsentrasi terapeutik.

### Mengapa Jam Minum Obat Harus Konsisten?
Jika Anda terlambat minum obat atau melewatkan dosis, kadar obat dalam darah akan menurun. Pada saat konsentrasi obat melemah, virus HIV yang tersisa dapat kembali bereplikasi dan berpeluang mengalami mutasi genetik. Mutasi ini menyebabkan **resistansi obat**—kondisi di mana virus menjadi kebal terhadap rejimen ARV yang sedang Anda gunakan, sehingga obat tersebut tidak lagi mempan dan dokter harus mengganti ke lini pengobatan yang lebih kompleks.

### Tips Praktis Menjaga Kepatuhan Harian:
1. **Gunakan Pengingat Pribadi**: Pasang alarm ponsel dengan label netral (misalnya "Waktu Suplemen" atau nama tanaman kesukaan) agar privasi Anda tetap terjaga di tempat umum.
2. **Kaitkan dengan Rutinitas Harian**: Jadwalkan minum obat bersamaan dengan aktivitas yang pasti Anda lakukan setiap hari, seperti setelah menggosok gigi malam atau sesudah sarapan pagi.
3. **Sediakan Dosis Cadangan yang Aman**: Simpan beberapa dosis darurat di tas kerja atau dompet obat pribadi untuk mengantisipasi jika Anda terjebak macet atau harus lembur.
4. **Kelola Efek Samping Awal**: Efek samping ringan seperti mual, pusing, atau mimpi aneh umumnya hanya terjadi pada 2 hingga 4 minggu pertama saat tubuh beradaptasi, kemudian akan mereda dengan sendirinya.

### Apa yang Harus Dilakukan Jika Lupa Dosis?
- Jika Anda ingat beberapa jam setelah jadwal rutin, segera minum dosis yang terlupa begitu teringat.
- Jika waktu sudah mendekati jadwal dosis berikutnya, **JANGAN menggandakan dosis**. Cukup minum satu dosis sesuai jadwal normal dan lanjutkan seperti biasa.
- Jangan pernah menghentikan atau mengubah dosis obat secara mandiri tanpa berdiskusi terlebih dahulu dengan dokter penanggung jawab Anda.

Materi ini untuk edukasi kepatuhan terapi dan tidak menggantikan instruksi resep dokter.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/hiv-treatment-adherence',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000011',
    categorySlug: 'dukungan-psikososial',
    slug: 'mengurangi-stigma-terhadap-odhiv',
    title: 'Membangun Empati: Menghapus Stigma terhadap ODHIV',
    summary: 'Stigma dan diskriminasi menghambat akses pengobatan dan merusak kesejahteraan mental. Gunakan bahasa yang memanusiakan.',
    body: `## Bahasa yang Menghormati Martabat

Stigma sosial sering kali menjadi beban yang jauh lebih berat bagi orang dengan HIV dibandingkan kondisi medis virus itu sendiri. Stigma internal (rasa bersalah berlebihan) dan stigma eksternal (penolakan sosial) terbukti menjadi penyebab utama seseorang menunda tes kesehatan, takut mengambil obat di puskesmas, atau menghentikan terapi.

### Prinsip Komunikasi Anti-Stigma:
1. **Gunakan Terminologi Humanis**: Gunakan sebutan **"Orang dengan HIV" (ODHIV)**, bukan "penderita", "korban", atau label yang merendahkan martabat. Mereka adalah manusia seutuhnya yang sedang mengelola kondisi kesehatannya.
2. **Hindari Bahasa Menghakimi atau Moralis**: Jangan mengaitkan infeksi dengan dosa, kutukan, atau penilaian karakter pribadi. HIV adalah isu kesehatan masyarakat, bukan ujian moralitas.
3. **Hormati Kerahasiaan Medis**: Status kesehatan seseorang adalah informasi pribadi yang sangat sensitif. Jangan pernah membicarakan atau menyebarkan diagnosis seseorang tanpa izin tertulis dari yang bersangkutan.
4. **Dukungan Tanpa Sikap Berlebihan**: Perlakukan teman, rekan kerja, atau anggota keluarga yang hidup dengan HIV secara wajar dan hangat. Ajak makan bersama, jabat tangannya, dan libatkan dalam kegiatan sehari-hari tanpa perlakuan diskriminatif.

Hukum di Indonesia melalui **Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan** dan **Permenkes Nomor 3 Tahun 2026 tentang Penanggulangan Penyakit** secara tegas menjamin hak setiap orang untuk memperoleh pelayanan kesehatan tanpa diskriminasi serta melarang penolakan pelayanan atas dasar kondisi kesehatan.

Materi ini disusun untuk edukasi publik dan penguatan empati sosial.`,
    source: 'https://keslan.kemkes.go.id/view_artikel/3913/stigma-pada-penderita-hivaids',
    minutes: 3,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000012',
    categorySlug: 'dukungan-psikososial',
    slug: 'merawat-kesehatan-mental-dan-mencari-dukungan',
    title: 'Merawat Kesehatan Mental dan Mengelola Kecemasan',
    summary: 'Menerima diagnosis memerlukan waktu dan ruang aman. Ketahui langkah menjaga kesehatan emosional dan kapan mencari bantuan profesional.',
    body: `## Kesejahteraan Emosional Anda Berharga

Menerima hasil diagnosis reaktif atau mendampingi seseorang yang baru terdiagnosis sering kali memicu gelombang emosi yang intens: syok, rasa takut akan masa depan, kesedihan mendalam, hingga kemarahan. Reaksi emosional ini sangat wajar dan manusiawi.

### Langkah Praktis Merawat Diri:
- **Beri Waktu untuk Bernapas**: Anda tidak harus menyelesaikan semua kekhawatiran dalam satu hari. Fokuslah pada satu langkah kecil pada satu waktu: penuhi jadwal minum obat hari ini, istirahat yang cukup, dan konsumsi makanan bernutrisi.
- **Saring Informasi yang Masuk**: Hindari membaca forum daring anonim atau artikel lama yang memuat informasi kedaluwarsa dan menakut-nakuti. Carilah rujukan resmi terverifikasi seperti situs Kementerian Kesehatan RI atau WHO.
- **Batasi Lingkaran Berbagi**: Anda tidak berkewajiban menceritakan status kesehatan Anda kepada semua orang. Bagikan hanya kepada orang yang benar-benar Anda percayai dan mampu memberikan dukungan tanpa menghakimi.
- **Terhubung dengan Komunitas Sebaya**: Berbicara dengan sesama teman yang telah menjalani hidup sehat dengan ARV selama bertahun-tahun dapat memberikan harapan nyata dan panduan praktis yang menenangkan.

### Kapan Harus Menghubungi Tenaga Profesional?
Jika rasa cemas atau kesedihan berlangsung lebih dari dua minggu, mengganggu pola tidur dan makan secara parah, atau jika muncul dorongan untuk menyakiti diri sendiri, segera hubungi konselor psikologis, psikolog klinis, atau layanan pendampingan di faskes Anda.

SEHATiCare menyediakan ruang curhat aman dan privat bersama konselor terlatih tanpa mewajibkan Anda membuka identitas asli.

Materi ini untuk edukasi kesehatan mental dan tidak menggantikan evaluasi klinis psikiater atau psikolog.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response',
    minutes: 3,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000013',
    categorySlug: 'dukungan-psikososial',
    slug: 'proses-penerimaan-diri-dan-dukungan-sebaya',
    title: 'Proses Penerimaan Diri dan Kekuatan Dukungan Sebaya',
    summary: 'Memahami fase penyesuaian diri setelah diagnosis dan menemukan kekuatan melalui pendampingan komunitas yang suportif.',
    body: `## Menemukan Kembali Kendali Hidup

Perjalanan hidup setelah terdiagnosis HIV bukanlah garis lurus. Banyak individu melewati tahapan penyesuaian psikososial sebelum mencapai titik penerimaan diri yang utuh:

### Tahapan Penyesuaian Emosional yang Umum Dialami:
1. **Fase Syok dan Penyangkalan**: Merasa hasil tes pasti keliru atau mimpi buruk yang akan segera berlalu.
2. **Fase Kemarahan dan Rasa Bersalah**: Menanyakan "Mengapa harus saya?" atau menyalahkan diri sendiri dan masa lalu.
3. **Fase Negosiasi dan Pencarian Makna**: Mulai mencari informasi medis yang benar dan mencari jalan keluar terbaik.
4. **Fase Adaptasi dan Penerimaan**: Menyadari bahwa HIV hanyalah satu aspek kecil dari tubuh fisik Anda, bukan keseluruhan identitas atau masa depan Anda.

### Peran Kunci Pendamping Sebaya (Peer Navigator)
Pendamping sebaya adalah orang yang hidup dengan HIV atau individu terlatih dari komunitas yang telah berhasil beradaptasi dan siap berjalan bersama Anda. Mereka dapat membantu:
- Menemani saat kunjungan pertama ke poli VCT/PDP di rumah sakit atau puskesmas.
- Berbagi pengalaman nyata mengatasi rasa mual atau pusing di minggu-minggu awal minum ARV.
- Membantu menyusun strategi pengingat obat yang aman dari pandangan rekan kerja.
- Menjadi tempat bercerita tanpa rasa takut dihakimi atau dinilai secara moral.

Ingatlah: diagnosis HIV tidak membatalkan impian karier Anda, tidak menutup peluang untuk memiliki pasangan hidup yang saling menyayangi, dan tidak menghalangi Anda untuk memiliki keturunan yang sehat bebas HIV.

Materi ini untuk edukasi psikososial masyarakat.`,
    source: 'https://keslan.kemkes.go.id/view_artikel/3913/stigma-pada-penderita-hivaids',
    minutes: 4,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000014',
    categorySlug: 'dukungan-psikososial',
    slug: 'ilustrasi-komposit-perjalanan-menuju-u-equals-u',
    title: 'Ilustrasi Komposit Edukatif: Perjalanan Menuju Tidak Terdeteksi',
    summary: 'Kisah komposit berdasarkan rangkuman pengalaman komunitas sebaya dalam melewati masa transisi awal hingga mencapai viral load tersupresi.',
    body: `## Catatan Penting Mengenai Tulisan Ini
> **PEMBERITAHUAN TRANSPARAN**: Tulisan ini merupakan **Ilustrasi Komposit Edukatif** yang dirangkum dari berbagai pola pengalaman nyata komunitas sebaya dalam forum diskusi kelompok terarah (FGD). Tidak ada nama asli, data pribadi, atau identitas individu nyata yang digunakan dalam narasi ini. Tujuannya adalah memberikan gambaran manusiawi dan realistis mengenai tahapan yang dilalui seseorang setelah menerima hasil tes.

---

### Hari-Hari Pertama: Menghadapi Badai Pikiran
Saat pertama kali menerima hasil tes darah yang terkonfirmasi reaktif di klinik, perasaan yang paling mendominasi adalah kekosongan dan ketakutan akan stigma lingkungan. Pikiran dipenuhi bayangan masa lalu tentang vonis penyakit yang menakutkan.

Namun, konselor di klinik menjelaskan dengan tenang bahwa ilmu kedokteran telah berkembang sangat jauh. ARV bukan obat pereda rasa sakit sementara, melainkan terapi yang dapat menghentikan replikasi virus sepenuhnya jika diminum secara teratur.

### Bulan Pertama: Membangun Rutinitas dan Mengatasi Efek Samping Awal
Minggu pertama memulai satu butir obat kombinasi dosis tetap (FDC) setiap pukul 21.00 malam tidak sepenuhnya mulus. Ada rasa pusing ringan dan mimpi yang terasa sangat nyata. Namun, pendamping sebaya mengingatkan bahwa reaksi tersebut adalah adaptasi normal tubuh yang biasanya berangsur hilang dalam 2 hingga 3 minggu.

Menyetel alarm dengan nada dering santai dan menyimpan air minum di dekat tempat tidur menjadi kebiasaan baru yang dibangun dengan penuh komitmen. Pada akhir bulan pertama, efek samping berangsur reda dan energi tubuh mulai kembali bugar.

### Bulan Keenam: Hasil Tes Viral Load dan Kebebasan dari Rasa Takut
Memasuki bulan keenam pengobatan, dokter menjadwalkan pemeriksaan darah untuk uji Viral Load. Ketika lembar hasil laboratorium keluar dengan tulisan **"Target Not Detected" (<50 copies/mL)**, beban kecemasan yang selama ini menekan terasa terangkat sepenuhnya.

Prinsip ilmiah **U=U (Undetectable = Untransmittable)** bukan sekadar teori jurnal medis—ia adalah kenyataan hidup. Dengan virus yang tidak lagi terdeteksi di dalam darah, risiko menularkan HIV kepada pasangan secara seksual adalah nol. 

### Pesan untuk Anda yang Baru Memulai
Kunci dari perjalanan ini adalah konsistensi, kesabaran dalam menghadapi proses adaptasi, dan tidak ragu untuk mencari dukungan dari konselor serta komunitas sebaya. Anda tidak sedang berjuang sendirian.

Materi ini disusun sebagai ilustrasi komposit edukatif untuk tujuan pendampingan dan penumbuhan harapan.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 5,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000015',
    categorySlug: 'hak-dan-layanan',
    slug: 'hak-pasien-dan-kerahasiaan-medis',
    title: 'Hak Pasien, Kerahasiaan Medis, dan Landasan Regulasi',
    summary: 'Ketahui perlindungan hak atas privasi data medis dan larangan diskriminasi berdasarkan UU No. 17/2023, Permenkes No. 24/2022, dan Permenkes No. 3/2026.',
    body: `## Jaminan Hukum bagi Pasien dan Batasan Kerahasiaan

Privasi dan perlindungan data kesehatan adalah hak asasi yang dijamin secara kuat dalam sistem perundang-undangan kesehatan Republik Indonesia. Memahami hak-hak ini membantu setiap warga negara mengakses layanan kesehatan tanpa rasa takut akan pelanggaran privasi.

### 1. Landasan Hukum Perlindungan Pasien
- **Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan**: Menegaskan hak setiap pasien atas kerahasiaan kondisi kesehatan pribadinya yang telah diungkapkan kepada tenaga medis, hak atas persetujuan tindakan medis (*informed consent*), serta hak memperoleh pelayanan kesehatan yang bermutu, aman, dan tanpa perlakuan diskriminatif.
- **Peraturan Menteri Kesehatan Nomor 24 Tahun 2022 tentang Rekam Medis**: Mengatur kewajiban fasilitas pelayanan kesehatan untuk menjaga keamanan, kerahasiaan, dan keutuhan data rekam medis elektronik. Akses terhadap isi rekam medis dibatasi secara ketat hanya untuk tenaga kesehatan yang merawat dan kepentingan hukum yang diatur secara limitatif.
- **Peraturan Menteri Kesehatan Nomor 3 Tahun 2026 tentang Penanggulangan Penyakit**: Mengintegrasikan penanggulangan penyakit menular (termasuk HIV dan IMS) dengan penegasan prinsip anti-stigma, perlindungan kerahasiaan identitas orang yang dites, serta kewajiban penyediaan layanan pengobatan terpadu yang mudah diakses masyarakat.

### 2. Batasan Hukum Pembukaan Informasi Medis
Sebagai bentuk transparansi dan kepatuhan hukum, SEHATiCare menegaskan bahwa kerahasiaan data medis dilindungi dalam batas-batas yang ditentukan oleh peraturan perundang-undangan. Berdasarkan Pasal 28 Permenkes No. 24/2022 dan UU No. 17/2023, pembukaan data medis HANYA dapat dilakukan dalam situasi tertentu yang sah secara hukum:
- Atas persetujuan tertulis dari pasien yang bersangkutan.
- Untuk kepentingan pemeliharaan kesehatan dan pengobatan pasien oleh tim medis yang merawat.
- Pemenuhan permintaan penegak hukum dalam rangka penegakan hukum berdasarkan surat perintah yang sah.
- Pelaporan epidemiologi dan surveilans penyakit menular kepada Kementerian Kesehatan yang dilakukan secara teragregasi atau terenkripsi tanpa mempublikasikan identitas pribadi kepada khalayak umum.

### 3. Komitmen Privasi di SEHATiCare
SEHATiCare **tidak memberikan janji perlindungan absolut yang melampaui ketentuan hukum**, melainkan menerapkan pengamanan teknis terbaik untuk melindungi privasi Anda:
- Kemudahan menggunakan ID login anonim tanpa mewajibkan nama asli atau nomor telepon pribadi.
- Fitur *Quick Exit* untuk menutup layar secara instan jika ada orang lain mendekat.
- Isolasi token sesi dan penghapusan riwayat penelusuran lokal yang sensitif.
- Kebijakan *deny-by-default* yang melarang pencatatan kata kunci pencarian pribadi ke dalam penyimpanan luring publik.

Materi ini disusun untuk edukasi hak hukum pasien dan tidak menggantikan nasihat hukum formal.`,
    source: 'https://kemkes.go.id/',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000016',
    categorySlug: 'hak-dan-layanan',
    slug: 'panduan-mengakses-layanan-vct-dan-arv-di-faskes',
    title: 'Panduan Mengakses Layanan Tes VCT dan ARV di Faskes',
    summary: 'Langkah praktis mengakses layanan tes sukarela, alur konseling, dan pengambilan obat ARV di Puskesmas atau Rumah Sakit.',
    body: `## Langkah Praktis Menuju Fasilitas Pelayanan Kesehatan

Mengakses tes HIV dan pengobatan ARV di fasilitas pelayanan kesehatan (Puskesmas, Klinik, atau Rumah Sakit) saat ini telah dirancang untuk mudah, terjangkau, dan menjaga kerahasiaan pasien.

### 1. Dua Jenis Layanan Tes di Faskes:
- **VCT (Voluntary Counseling and Testing / KTS - Konseling dan Tes Sukarela)**: Anda berinisiatif datang sendiri untuk memeriksakan status HIV karena merasa memiliki risiko atau ingin memastikan kesehatan sebelum menikah/merencanakan kehamilan.
- **PITC (Provider-Initiated Testing and Counseling / KTIP - Konseling dan Tes atas Inisiatif Petugas)**: Tenaga kesehatan menawarkan tes HIV sebagai bagian dari pemeriksaan kesehatan rutin, misalnya pada ibu hamil saat antenatal care (ANC), pasien tuberkulosis (TB), atau pasien dengan gejala infeksi tertentu.

### 2. Alur Pemeriksaan di Faskes:
1. **Pendaftaran**: Datang ke loket pendaftaran Puskesmas atau Rumah Sakit. Anda dapat mendaftar untuk poli umum atau langsung menanyakan poli VCT / Konseling Kesehatan Reproduksi.
2. **Konseling Pra-Tes**: Anda akan berdialog empat mata dengan konselor terlatih di ruang tertutup. Konselor akan menjelaskan apa itu tes HIV, menilai faktor risiko tanpa menghakimi, menjelaskan arti hasil tes, dan meminta persetujuan Anda (*informed consent*).
3. **Pengambilan Sampel Darah**: Darah diambil sedikit (bisa melalui ujung jari atau pembuluh darah lengan) untuk diuji menggunakan alat tes cepat (*rapid test*). Hasil umumnya dapat diketahui dalam waktu 15 hingga 30 menit.
4. **Konseling Pasca-Tes**: Konselor membuka hasil bersama Anda secara privat. Jika non-reaktif, konselor memberikan panduan pencegahan dan masa jendela. Jika reaktif, konselor memberikan dukungan penguatan mental dan menjelaskan langkah memulai pengobatan ARV.

### 3. Memulai Pengobatan ARV:
- **Pemeriksaan Baseline**: Dokter akan memeriksa kondisi fisik umum, kemungkinan infeksi penyerta (seperti TB atau hepatitis), dan memeriksa fungsi organ dasar.
- **Skema "Test and Treat"**: Berdasarkan panduan nasional Kemenkes RI, terapi ARV dianjurkan untuk dimulai segera pada hari yang sama atau sesegera mungkin setelah diagnosis terkonfirmasi, tanpa harus menunggu hitung CD4 turun.
- **Pembiayaan dan Akses Obat**: Obat ARV disediakan secara **gratis** oleh program pemerintah Republik Indonesia di fasilitas pelayanan kesehatan yang ditunjuk. Pemeriksaan laboratorium dan administrasi faskes dapat dijamin oleh BPJS Kesehatan.

Gunakan fitur pencarian fasilitas layanan di SEHATiCare untuk menemukan faskes ramah terdekat tanpa perlu mengaktifkan GPS.

Materi ini untuk edukasi navigasi layanan kesehatan publik.`,
    source: 'https://p2pm.kemkes.go.id/',
    minutes: 4,
    featured: true
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
