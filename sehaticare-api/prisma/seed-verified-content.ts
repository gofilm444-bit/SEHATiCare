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

HIV (Human Immunodeficiency Virus) adalah virus yang secara bertahap menyerang sel-sel kekebalan tubuh, khususnya sel limfosit CD4 yang berperan melawan infeksi. Sedangkan AIDS (Acquired Immunodeficiency Syndrome) adalah sekumpulan gejala dan infeksi oportunistik yang timbul ketika sistem kekebalan tubuh telah mengalami kerusakan berat akibat infeksi HIV yang tidak diobati.

Seseorang yang hidup dengan HIV tidak otomatis berada pada tahap AIDS. Dengan penegakan diagnosis sedini mungkin dan kepatuhan konsumsi terapi antiretroviral (ARV), replikasi virus dapat ditekan hingga tingkat yang tidak terdeteksi di dalam darah. Hal ini memungkinkan sistem imun pulih dan mencegah perkembangan infeksi ke tahap AIDS.

### Perjalanan Klinis dan Deteksi Dini
1. **Infeksi Akut**: Terjadi beberapa minggu pasca paparan awal. Gejala sering kali menyerupai flu ringan (demam, sakit tenggorokan, ruam) atau bahkan tanpa gejala sama sekali.
2. **Fase Asimtomatik (Laten Klinis)**: Virus terus bereplikasi secara perlahan tanpa menimbulkan gejala nyata selama bertahun-tahun.
3. **Fase Lanjut (AIDS)**: Terjadi jika infeksi tidak terdiagnosis dan tidak diobati, ditandai oleh penurunan drastis hitung CD4 (umumnya di bawah 200 sel/µL) dan munculnya infeksi oportunistik seperti tuberkulosis atau infeksi jamur berat.

Gejala fisik semata tidak pernah bisa dijadikan dasar untuk memastikan status HIV. Satu-satunya cara yang akurat dan sah adalah melalui pemeriksaan laboratorium tes HIV yang dikonfirmasi oleh tenaga kesehatan berwenang.

Materi ini disusun untuk tujuan edukasi kesehatan masyarakat dan tidak menggantikan konsultasi, diagnosis, atau rencana perawatan medis dari tenaga kesehatan profesional.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 3,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000002',
    categorySlug: 'dasar-hiv',
    slug: 'cara-hiv-menular-dan-tidak-menular',
    title: 'Cara HIV Menular dan Tidak Menular',
    summary: 'HIV hanya dapat menular melalui cairan tubuh tertentu dengan konsentrasi virus yang cukup, bukan melalui interaksi sosial biasa atau gigitan serangga.',
    body: `## Kenali Faktanya, Hentikan Stigma

HIV adalah virus yang rapuh di luar tubuh manusia dan memerlukan jalur penularan langsung melalui cairan biologis tertentu dengan konsentrasi virus yang cukup.

### Cairan Tubuh yang DAPAT Menularkan HIV:
- **Darah**: Melalui transfusi darah yang tidak diskrining (sangat jarang dengan sistem skrining modern) atau penggunaan jarum suntik/tindik bersama yang tidak steril.
- **Air Mani (Semen) dan Cairan Pra-seminal**: Melalui hubungan seksual tanpa kondom atau tanpa perlindungan ARV efektif.
- **Cairan Vagina dan Rektal**: Melalui hubungan seksual penetratif tanpa pengaman.
- **Air Susu Ibu (ASI)**: Penularan dari ibu ke anak selama menyusui (dapat ditekan hingga risiko minimal dengan kepatuhan terapi ARV teratur).

### HIV TIDAK Menular Melalui:
- Berjabat tangan, berpelukan, atau mencium pipi.
- Air liur, keringat, air mata, atau dahak.
- Berbagi makanan, minuman, sendok, piring, atau gelas.
- Dudukan toilet, kamar mandi, atau kolam renang umum.
- Gigitan nyamuk atau serangga lainnya (HIV tidak dapat bereplikasi dalam tubuh serangga).
- Tinggal serumah, bersekolah, atau bekerja bersama orang dengan HIV (ODHIV).

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
    summary: 'Bongkar mitos umum seputar penularan, harapan hidup, dan stigma moralitas dengan bukti medis ilmiah terkini.',
    body: `## Meluruskan Informasi yang Keliru

Banyak kecemasan dan stigma di masyarakat timbul karena mitos-mitos usang yang tidak berdasar secara medis. Mari kita bandingkan mitos dan fakta ilmiahnya:

### Mitos 1: "HIV adalah vonis mati tanpa masa depan."
- **Fakta**: Terapi antiretroviral (ARV) modern telah mengubah HIV menjadi kondisi kesehatan kronis yang dapat dikelola dengan sangat baik, serupa dengan diabetes atau hipertensi. Orang dengan HIV yang patuh menjalani pengobatan memiliki angka harapan hidup dan kualitas hidup yang setara dengan populasi umum.

### Mitos 2: "HIV dapat menular lewat alat makan bersama atau gigitan nyamuk."
- **Fakta**: HIV tidak dapat hidup di luar tubuh manusia atau bereplikasi pada serangga. Air liur tidak memiliki konsentrasi virus yang cukup untuk menularkan HIV. Anda tidak akan tertular hanya karena makan bersama atau berada di ruangan yang sama.

### Mitos 3: "HIV adalah akibat hukuman moral atau kutukan."
- **Fakta**: HIV adalah agen infeksius biologis (virus), bukan cerminan moralitas seseorang. Siapa pun dapat terpapar virus jika mengalami kontak dengan cairan penular, termasuk bayi yang dilahirkan atau tenaga medis yang mengalami kecelakaan kerja.

### Mitos 4: "Orang dengan HIV pasti menularkan virus kepada pasangan seksualnya."
- **Fakta**: Berdasarkan konsensus ilmiah global **U=U (Undetectable = Untransmittable)**, orang dengan HIV yang rutin meminum ARV dan mempertahankan viral load tersupresi (<200 kopi/mL) secara stabil tidak dapat menularkan HIV kepada pasangan seksualnya.

### Mitos 5: "Ibu hamil dengan HIV pasti menularkan virus ke bayinya."
- **Fakta**: Program Pencegahan Penularan dari Ibu ke Anak (PPIA/PMTCT) melalui konsumsi ARV selama kehamilan dan persalinan terencana dapat menekan risiko penularan ke bayi hingga di bawah 1–2%.

Materi ini disusun untuk edukasi kesehatan masyarakat dan meluruskan stigma. Konsultasikan keraguan Anda kepada dokter atau konselor kesehatan terpercaya.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
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
Jika tes dilakukan di dalam masa jendela setelah paparan berisiko baru, hasil negatif belum sepenuhnya memastikan Anda bebas dari infeksi. Tenaga kesehatan akan menganjurkan tes ulang konfirmasi setelah masa jendela terlampaui sesuai protokol klinis.

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
    summary: 'Pencegahan kombinasi mencakup kondom, penggunaan alat steril, PrEP, PEP, serta terapi ARV sebagai pencegahan penularan seksual (TasP/U=U).',
    body: `## Pencegahan Berbasis Bukti Ilmiah

Strategi pencegahan HIV saat ini menggunakan pendekatan kombinasi biomedis, perilaku, dan struktural untuk memberikan perlindungan optimal sesuai kebutuhan individu:

### 1. Penggunaan Pengaman Barrier (Kondom)
Penggunaan kondom secara konsisten dan benar memberikan perlindungan ganda: mencegah penularan HIV dan infeksi menular seksual (IMS) lainnya seperti sifilis, gonore, dan klamidia, serta mencegah kehamilan yang tidak direncanakan.

### 2. Pengurangan Bahaya (Harm Reduction)
Bagi pengguna napza suntik, tidak berbagi jarum, spuit, atau wadah pencampur obat secara mutlak mencegah penularan darah langsung. Layanan alat suntik steril tersedia di puskesmas rujukan tertentu.

### 3. Profilaksis Pra-Pajanan (PrEP)
Obat antiretroviral yang dikonsumsi secara teratur oleh individu dengan status HIV negatif yang memiliki risiko paparan signifikan untuk mencegah virus menginfeksi sel tubuh.

### 4. Profilaksis Pasca-Pajanan (PEP)
Obat darurat yang harus diminum secepat mungkin (maksimal 72 jam) setelah insiden paparan berisiko tunggal untuk mencegah virus menetap di dalam tubuh.

### 5. Treatment as Prevention (TasP / U=U)
Orang dengan HIV yang rutin menjalani terapi ARV dan mempertahankan viral load tersupresi (<200 kopi/mL) secara stabil tidak dapat menularkan virus kepada pasangan seksualnya.

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
    summary: 'PrEP adalah terapi preventif bagi individu HIV-negatif berisiko tinggi. Ketahui modalitas, syarat skrining, efektivitas, dan batasannya.',
    body: `## Apa Itu PrEP (Pre-Exposure Prophylaxis)?

PrEP adalah obat antiretroviral yang dikonsumsi oleh individu yang **belum terinfeksi HIV (status HIV negatif)** sebelum terjadi potensi paparan, untuk mencegah virus HIV berkembang biak di dalam tubuh jika terjadi paparan.

### Modalitas dan Ketersediaan PrEP:
- **Oral PrEP**: Bentuk yang paling umum tersedia di Indonesia melalui fasilitas pelayanan kesehatan rujukan dan program percontohan pemerintah, umumnya berupa kombinasi tenofovir disoproxil fumarate dan emtricitabine (TDF/FTC).
- **Long-Acting Injectable PrEP**: Di beberapa negara, modalitas suntik berkala (seperti cabotegravir LA) telah disetujui sebagai opsi preventif jangka panjang.
- Di Indonesia, akses dan rejimen PrEP mengikuti panduan teknis program penanggulangan HIV Kementerian Kesehatan RI di fasilitas kesehatan yang ditunjuk.

### Syarat Skrining dan Pemantauan Klinis:
- **Syarat Wajib Skrining Awal**: Seseorang WAJIB menjalani tes HIV terlebih dahulu dan dipastikan berstatus HIV-negatif sebelum memulai PrEP. Mengonsumsi PrEP saat seseorang sudah terinfeksi HIV dapat memicu mutasi resistansi obat.
- **Pemantauan Klinis Terjadwal**: Pengguna PrEP memerlukan kunjungan tindak lanjut berkala untuk tes HIV ulang (memastikan status tetap negatif), skrining infeksi menular seksual (IMS), serta evaluasi fungsi ginjal berdasarkan usia, riwayat klinis, dan protokol fasilitas pelayanan kesehatan yang merawat.
- **Bukan Pengganti Perlindungan IMS Lain**: PrEP secara khusus dirancang untuk mencegah infeksi HIV. PrEP **TIDAK melindungi** dari infeksi menular seksual lain (seperti sifilis, gonore, hepatitis) atau mencegah kehamilan.

### Siapa yang Membutuhkan PrEP?
Individu dengan status HIV negatif yang memiliki pasangan seksual dengan viral load belum tersupresi, memiliki pasangan seksual multipel tanpa pengaman konsisten, atau populasi yang berisiko terpapar jarum suntik tidak steril.

Konsultasikan kebutuhan PrEP Anda kepada dokter atau konselor di fasilitas pelayanan kesehatan terdekat. Jangan mengonsumsi obat antiretroviral tanpa evaluasi dan pengawasan medis resmi.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/pre-exposure-prophylaxis-prep',
    minutes: 4,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000007',
    categorySlug: 'pencegahan-dan-tes',
    slug: 'pep-profilaksis-pasca-paparan-darurat',
    title: 'PEP: Profilaksis Pasca-Paparan Darurat',
    summary: 'PEP adalah pengobatan darurat yang harus dimulai dalam kurun 72 jam pertama setelah insiden paparan dan diminum selama 28 hari di bawah pengawasan dokter.',
    body: `## Tindakan Darurat: Waktu Sangat Menentukan

PEP (Post-Exposure Prophylaxis) adalah pengobatan darurat menggunakan obat antiretroviral (ARV) yang diberikan kepada seseorang yang berstatus HIV-negatif setelah mengalami insiden kemungkinan paparan HIV.

### Aturan Kunci PEP:
1. **Jendela Inisiasi Maksimal 72 Jam**: PEP harus dimulai sesegera mungkin setelah insiden paparan terjadi, idealnya dalam kurun **2 hingga 24 jam pertama**, dan paling lambat **72 jam (3 hari)**. Panduan klinis menetapkan batas 72 jam karena setelah rentang waktu tersebut virus telah mulai menyebar dan membentuk reservoir dalam sistem imun, sehingga efektivitas profilaksis menurun sangat drastis. Evaluasi klinis dokter tetap diperlukan untuk menilai situasi paparan.
2. **Durasi Penuh 28 Hari**: Obat PEP harus diminum setiap hari tanpa terputus selama **28 hari berturut-turut**. Menghentikan konsumsi lebih awal dapat menggagalkan perlindungan dan memicu resistansi obat.
3. **Pemeriksaan dan Pendampingan Dokter**: Tenaga medis akan melakukan tes HIV awal, menilai derajat risiko paparan, meresepkan rejimen yang sesuai, memantau efek samping, dan menjadwalkan tes konfirmasi tindak lanjut sesuai protokol klinis dokter yang merawat.

### Situasi yang Memerlukan Evaluasi PEP:
- Hubungan seksual tanpa pengaman atau kegagalan kondom dengan seseorang yang diketahui atau dicurigai berstatus HIV dengan viral load belum tersupresi.
- Korban kekerasan seksual atau pemerkosaan.
- Tenaga kesehatan yang mengalami kecelakaan kerja tertusuk jarum suntik atau terpapar darah pasien terkonfirmasi HIV.

PEP adalah langkah darurat insidental, bukan pengganti metode pencegahan terencana seperti kondom atau PrEP. Jika Anda mengalami insiden paparan berisiko dalam kurun 72 jam terakhir, segera kunjungi Instalasi Gawat Darurat (IGD) rumah sakit atau Puskesmas layanan HIV terdekat.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/post-exposure-prophylaxis-pep',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000008',
    categorySlug: 'pengobatan-hiv',
    slug: 'arv-viral-load-dan-u-equals-u',
    title: 'ARV, Viral Load, dan Revolusi Ilmiah U=U',
    summary: 'Undetectable = Untransmittable. Menjaga viral load tersupresi (<200 kopi/mL) secara stabil berarti risiko penularan seksual adalah nol.',
    body: `## Revolusi Ilmiah: Undetectable Equals Untransmittable

Salah satu capaian ilmiah terpenting dalam sejarah kesehatan masyarakat global adalah konsensus **U=U (Undetectable = Untransmittable)**, atau dalam bahasa Indonesia: **Tidak Terdeteksi = Tidak Menularkan**.

### Apa Dasar Ilmiah U=U?
Studi berskala global yang melibatkan puluhan ribu pasangan serodiskordan (salah satu pasangan hidup dengan HIV dan pasangannya HIV-negatif), seperti studi klinis PARTNER 1, PARTNER 2, dan Opposites Attract, membuktikan bahwa:
> **Ketika seseorang dengan HIV rutin mengonsumsi terapi ARV hingga kadar virus di dalam darah tersupresi di bawah 200 kopi/mL secara stabil, risiko penularan HIV kepada pasangan seksualnya adalah NOL (0%).**

### Poin Kunci dan Kriteria Keberlakuan U=U:
1. **Penekanan Virus (<200 kopi/mL)**: Berdasarkan pedoman internasional (WHO, NIH, CDC), supresi virus klinis didefinisikan sebagai viral load di bawah 200 kopi/mL darah. Sebagian alat laboratorium memiliki ambang batas deteksi lebih rendah (misalnya <50 atau <20 kopi/mL), namun untuk pencegahan penularan seksual, angka <200 kopi/mL telah terbukti memberikan perlindungan penuh.
2. **Kestabilan dan Periode Awal Terapi**: Ketika seseorang baru memulai ARV, penurunan jumlah virus memerlukan waktu beberapa minggu hingga bulan tergantung kondisi awal dan kepatuhan. Selama periode awal pengobatan, individu dianjurkan tetap menggunakan pengaman tambahan (seperti kondom) hingga hasil tes laboratorium berkala mengonfirmasi supresi stabil.
3. **Kepatuhan Berkelanjutan**: Satu hasil tes viral load tunggal tidak menjadi jaminan seumur hidup. Supresi virus memerlukan kepatuhan minum obat harian secara konsisten dan pemantauan laboratorium berkala sesuai rekomendasi dokter.

### Batasan Medis yang Wajib Dipahami:
- U=U **berlaku spesifik untuk penularan melalui hubungan seksual**.
- U=U **TIDAK melindungi dari infeksi menular seksual (IMS) lainnya** seperti sifilis, gonore, atau klamidia, serta tidak mencegah kehamilan.
- U=U **tidak berlaku tanpa kualifikasi untuk penularan melalui darah atau jarum suntik bersama**, dan untuk pemberian ASI memerlukan evaluasi serta konsultasi intensif bersama dokter spesialis.

U=U adalah bukti nyata bahwa stigma terhadap orang dengan HIV tidak lagi memiliki pijakan ilmiah. Orang dengan HIV dapat menjalin hubungan asmara, membina keluarga, dan merencanakan masa depan dengan tenang dan bermartabat.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/undetectable-untransmittable',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000009',
    categorySlug: 'pengobatan-hiv',
    slug: 'memahami-viral-load-dan-hitung-cd4',
    title: 'Memahami Perbedaan Viral Load dan Hitung CD4',
    summary: 'Ketahui peran hitung CD4 sebagai indikator kekuatan sistem imun dan Viral Load sebagai pengukur keberhasilan penekanan virus dengan ARV.',
    body: `## Dua Indikator Utama Pemantauan HIV

Dalam pemantauan klinis pasien yang hidup dengan HIV, dokter menggunakan dua parameter laboratorium penting: **Hitung Sel CD4** dan **Pemeriksaan Viral Load (VL)**. Keduanya memiliki fungsi yang berbeda namun saling melengkapi.

### 1. Hitung Sel CD4: Indikator Kekuatan Sistem Imun
- **Apa yang diukur?**: Jumlah sel darah putih limfosit T CD4 per mikroliter darah (sel/µL). Sel ini berfungsi mengoordinasikan sistem pertahanan tubuh melawan infeksi.
- **Rentang Normal**: Pada orang dewasa sehat, jumlah CD4 umumnya berkisar antara **500 hingga 1.500 sel/µL**.
- **Makna Klinis**: Jika jumlah CD4 turun di bawah 200 sel/µL, tubuh berada dalam risiko tinggi mengalami infeksi oportunistik berat. Kenaikan bertahap CD4 selama terapi ARV menandakan sistem kekebalan tubuh sedang mengalami pemulihan.

### 2. Viral Load (HIV RNA): Indikator Replikasi Virus
- **Apa yang diukur?**: Jumlah kopi materi genetik virus HIV per mililiter plasma darah (kopi/mL).
- **Target Terapi**: Target utama pengobatan ARV adalah mencapai supresi virus (viral load <200 kopi/mL atau di bawah ambang deteksi alat laboratorium).
- **Makna Klinis**: Viral load adalah ukuran langsung efektivitas obat. Jika virus tersupresi, kerusakan sel CD4 terhenti, daya tahan tubuh dapat pulih, dan penularan seksual dicegah (U=U).

### Hubungan Keduanya dalam Pemantauan:
Secara sederhana: **Viral Load mengukur jumlah virus**, sedangkan **CD4 mengukur pertahanan tubuh Anda**. Dengan menekan viral load serendah mungkin, sel CD4 memiliki kesempatan untuk bertambah dan melindungi tubuh dari berbagai penyakit.

Jadwal evaluasi viral load dan CD4 ditentukan oleh dokter penanggung jawab Anda berdasarkan kondisi klinis dan pedoman tatalaksana yang berlaku.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/hiv-treatment-basics',
    minutes: 3,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000010',
    categorySlug: 'pengobatan-hiv',
    slug: 'menjaga-kepatuhan-pengobatan-hiv',
    title: 'Menjaga Kepatuhan Terapi ARV dan Mencegah Resistansi',
    summary: 'Kepatuhan minum obat harian menjaga kadar zat aktif tetap optimal dalam darah dan melindungi Anda dari risiko resistansi virus.',
    body: `## Disiplin Minum Obat: Kunci Kesehatan Jangka Panjang

Terapi Antiretroviral (ARV) bekerja dengan cara menekan kemampuan virus HIV untuk menggandakan diri di dalam tubuh. Agar obat dapat bekerja secara efektif selama 24 jam penuh, kadar zat aktif obat di dalam aliran darah harus selalu berada di atas batas minimal konsentrasi terapeutik.

### Mengapa Jadwal Minum Obat Perlu Konsisten?
Jika Anda sering terlambat atau melewatkan dosis, konsentrasi obat dalam darah akan menurun. Ketika konsentrasi obat melemah, virus HIV yang tersisa dapat kembali bereplikasi dan berpeluang mengalami mutasi genetik. Mutasi ini menyebabkan **resistansi obat**—kondisi di mana virus menjadi kebal terhadap rejimen ARV yang sedang digunakan, sehingga obat tersebut tidak lagi efektif dan dokter harus mempertimbangkan lini pengobatan alternatif.

### Tips Praktis Menjaga Kepatuhan Harian:
1. **Pengingat Pribadi yang Nyaman**: Pasang alarm ponsel dengan label netral (misalnya "Waktu Suplemen" atau nama pengingat pribadi) untuk menjaga privasi di tempat umum.
2. **Integrasikan dengan Rutinitas Harian**: Kaitkan jadwal minum obat dengan kebiasaan yang rutin Anda lakukan setiap hari, seperti setelah makan malam atau menjelang istirahat malam.
3. **Persiapkan Dosis Cadangan**: Simpan cadangan obat di tempat aman saat bepergian untuk mengantisipasi keterlambatan pulang atau kondisi darurat.
4. **Konsultasikan Efek Samping**: Sebagian orang mengalami efek adaptasi ringan di awal terapi (seperti pusing atau mual ringan). Bicarakan efek samping tersebut kepada dokter; jangan pernah menghentikan obat secara mendadak tanpa panduan medis.

### Bagaimana Bila Terlupa Minum Obat?
- Jika Anda teringat beberapa jam kemudian, segera minum dosis yang terlupa.
- Namun jika sudah mendekati jadwal dosis berikutnya, ikuti anjuran dokter Anda: umumnya jangan menggandakan dosis dalam satu waktu.
- Diskusikan strategi kepatuhan dengan tim medis Anda agar rencana terapi tetap berjalan aman dan teratur.

Materi ini disusun untuk edukasi kepatuhan terapi dan tidak menggantikan resep atau instruksi dokter Anda.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/hiv-treatment-adherence',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000011',
    categorySlug: 'dukungan-psikososial',
    slug: 'mengurangi-stigma-terhadap-odhiv',
    title: 'Membangun Empati: Menghapus Stigma terhadap ODHIV',
    summary: 'Stigma dan diskriminasi menghambat akses pengobatan dan merusak kesejahteraan mental. Gunakan bahasa yang menghormati martabat.',
    body: `## Bahasa yang Menghormati Martabat

Stigma sosial sering kali menjadi beban psikologis yang berat bagi orang dengan HIV. Stigma internal (rasa bersalah dan isolasi diri) serta stigma eksternal (penolakan lingkungan) dapat menjadi penghambat seseorang untuk memeriksakan diri, mengambil obat di fasilitas kesehatan, atau mempertahankan pengobatan.

### Prinsip Komunikasi Anti-Stigma:
1. **Gunakan Terminologi Humanis**: Gunakan sebutan **"Orang dengan HIV" (ODHIV)**, bukan label yang merendahkan martabat. Fokuskan pada kemanusiaan seseorang, bukan status kesehatannya semata.
2. **Hindari Bahasa Menghakimi atau Moralis**: Jangan mengaitkan infeksi dengan penilaian moral atau kesalahan karakter. HIV adalah kondisi medis yang dapat dialami siapa saja.
3. **Hormati Kerahasiaan Medis**: Status kesehatan seseorang adalah informasi pribadi. Jangan pernah membagikan diagnosis orang lain tanpa persetujuan eksplisit dari yang bersangkutan.
4. **Dukungan Wajar dan Setara**: Perlakukan rekan kerja, teman, atau keluarga yang hidup dengan HIV secara hangat dan setara. Interaksi sosial biasa sama sekali tidak berisiko menularkan HIV.

Hukum di Indonesia melalui **Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan** dan **Permenkes Nomor 3 Tahun 2026 tentang Penanggulangan Penyakit** secara tegas melarang diskriminasi dalam pelayanan kesehatan dan menegaskan hak setiap warga negara untuk mendapatkan layanan kesehatan yang aman dan bermartabat.

Materi ini disusun untuk edukasi publik dan penguatan empati sosial.`,
    source: 'https://www.unaids.org/en/resources/documents/2024/zero-discrimination',
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

Menerima hasil diagnosis reaktif atau mendampingi orang terdekat sering kali memicu respons emosional yang mendalam: rasa cemas akan masa depan, kesedihan, atau kebingungan. Perasaan tersebut adalah reaksi manusiawi yang wajar.

### Langkah Praktis Merawat Diri:
- **Beri Waktu untuk Beradaptasi**: Anda tidak harus menyelesaikan semua hal dalam satu waktu. Fokuslah pada langkah-langkah nyata hari ini: menjaga jadwal minum obat, istirahat cukup, dan mengonsumsi makanan bergizi.
- **Saring Informasi yang Masuk**: Hindari membaca sumber yang tidak jelas kredibilitasnya atau memuat narasi yang menakut-nakuti. Rujuklah informasi resmi dari Kementerian Kesehatan RI atau WHO.
- **Batasi Lingkaran Berbagi**: Anda berhak memilih kepada siapa Anda ingin bercerita. Utamakan orang-orang yang suportif dan dapat dipercaya menjaga rahasia Anda.
- **Terhubung dengan Dukungan Sebaya**: Berbagi dengan teman yang telah beradaptasi dengan baik menjalani terapi ARV dapat memberikan perspektif yang realistis dan menenangkan.

### Kapan Harus Menghubungi Tenaga Profesional?
Jika perasaan cemas, murung, atau putus asa berlangsung terus-menerus, mengganggu fungsi sehari-hari secara signifikan, atau memicu pikiran untuk menyakiti diri sendiri, segera hubungi psikolog klinis, dokter, atau layanan konseling terdekat.

Materi ini untuk edukasi kesehatan mental dan tidak menggantikan evaluasi klinis psikiater atau psikolog.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response',
    minutes: 3,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000013',
    categorySlug: 'dukungan-psikososial',
    slug: 'proses-penerimaan-diri-dan-dukungan-sebaya',
    title: 'Proses Penerimaan Diri dan Peran Pendamping Sebaya',
    summary: 'Memahami proses adaptasi emosional setelah diagnosis dan menemukan kekuatan melalui pendampingan komunitas yang suportif.',
    body: `## Menemukan Kembali Harapan dan Kekuatan Diri

Perjalanan adaptasi setelah terdiagnosis HIV membutuhkan proses psikososial bertahap:

### Tahapan Penyesuaian Emosional:
1. **Fase Kaget atau Penyangkalan**: Perasaan tidak percaya atau berharap diagnosis tersebut adalah kekeliruan.
2. **Fase Emosi Intens**: Munculnya kekhawatiran, rasa sedih, atau mempertanyakan situasi.
3. **Fase Eksplorasi Informasi**: Mulai mencari informasi medis yang valid mengenai cara kerja ARV dan kualitas hidup.
4. **Fase Penerimaan dan Integrasi**: Menyadari bahwa HIV adalah kondisi kesehatan yang dapat dikelola, dan tidak membatasi impian, karier, maupun kehidupan berkeluarga.

### Peran Pendamping Sebaya (Peer Support)
Pendamping sebaya yang terlatih dari komunitas dapat mendampingi Anda dalam:
- Mengurangi rasa cemas saat kunjungan awal ke fasilitas pelayanan kesehatan.
- Berbagi pengalaman praktis dalam membangun rutinitas kepatuhan minum obat.
- Memberikan ruang berbagi cerita yang bebas dari penghakiman.

Diagnosis HIV bukanlah akhir dari cita-cita hidup Anda. Dengan pengobatan yang tepat dan dukungan yang hangat, setiap orang berhak hidup sehat, produktif, dan bahagia.

Materi ini disusun untuk tujuan edukasi psikososial masyarakat.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    minutes: 4,
    featured: false
  },
  {
    id: '32000000-0000-4000-8000-000000000014',
    categorySlug: 'dukungan-psikososial',
    slug: 'ilustrasi-komposit-perjalanan-menuju-u-equals-u',
    title: 'Ilustrasi Komposit Edukatif: Perjalanan Menuju Penekanan Virus',
    summary: 'Rangkuman pola pengalaman komunitas sebaya dalam melewati masa transisi awal terapi hingga mencapai supresi virus di bawah pengawasan medis.',
    body: `## Catatan Transparansi Mengenai Tulisan Ini

> **PEMBERITAHUAN TRANSPARAN**: Tulisan ini merupakan **Ilustrasi Komposit Edukatif** yang dirangkum dari berbagai pola pengalaman umum komunitas sebaya dalam forum diskusi kelompok terarah (FGD). Tulisan ini disusun untuk tujuan penumbuhan harapan dan edukasi, **BUKAN testimoni pasien nyata tunggal, rekam medis individu tertentu, atau kisah peserta FGD spesifik**. Waktu minum obat, pemilihan rejimen ARV, ada tidaknya efek adaptasi, dan durasi mencapai supresi virus bervariasi bagi setiap individu serta memerlukan pemantauan medis berkala oleh dokter.

---

### Hari-Hari Pertama: Menata Pikiran
Saat pertama kali menerima hasil tes yang terkonfirmasi reaktif di klinik, perasaan yang paling mendominasi umumnya adalah kekhawatiran akan masa depan dan stigma lingkungan.

Namun, dialog bersama konselor dan dokter membantu meluruskan bahwa terapi ARV modern bekerja menekan replikasi virus secara efektif. Pengobatan adalah langkah nyata untuk memulihkan daya tahan tubuh dan menjaga kualitas hidup.

### Masa Adaptasi: Membangun Rutinitas Baru
Memulai rejimen terapi memerlukan penyesuaian jadwal harian. Menentukan waktu minum obat yang paling cocok bersama dokter dan memanfaatkan pengingat pribadi membantu membangun konsistensi. Jika terjadi efek adaptasi awal, mendiskusikannya dengan tim medis serta pendamping sebaya membantu individu melewatinya dengan tenang tanpa menghentikan obat secara mandiri.

### Pemantauan Berkala: Menuju Penekanan Virus
Di bawah pengawasan dokter, pemeriksaan laboratorium rutin (seperti viral load) dilakukan untuk mengevaluasi keberhasilan terapi. Ketika hasil evaluasi menunjukkan bahwa viral load telah tersupresi (<200 kopi/mL darah) secara stabil, prinsip **U=U (Undetectable = Untransmittable)** terwujud: risiko penularan seksual kepada pasangan menjadi nol.

### Pesan Reflektif
Kunci dari perjalanan adaptasi ini adalah kepatuhan terapi, komunikasi terbuka dengan tenaga kesehatan, dan kesediaan mencari dukungan positif saat membutuhkan teman bercerita. Anda tidak harus melewati proses ini sendirian.

Materi ini disusun sebagai ilustrasi komposit edukatif untuk tujuan pendampingan dan penumbuhan harapan.`,
    source: 'https://hivinfo.nih.gov/understanding-hiv/fact-sheets/undetectable-untransmittable',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000015',
    categorySlug: 'hak-dan-layanan',
    slug: 'hak-pasien-dan-kerahasiaan-medis',
    title: 'Hak Pasien, Kerahasiaan Medis, dan Landasan Regulasi',
    summary: 'Ketahui perlindungan hak atas privasi data medis dan larangan diskriminasi berdasarkan UU No. 17/2023, Permenkes No. 24/2022 Pasal 28, dan Permenkes No. 3/2026.',
    body: `## Jaminan Hukum bagi Pasien dan Batasan Kerahasiaan

Privasi dan perlindungan data kesehatan adalah hak asasi yang diatur dalam sistem perundang-undangan kesehatan Republik Indonesia. Memahami hak-hak ini membantu setiap warga negara mengakses layanan kesehatan tanpa rasa takut akan pelanggaran privasi atau diskriminasi.

### 1. Landasan Hukum Perlindungan Pasien
- **Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan**: Menegaskan hak setiap pasien atas kerahasiaan kondisi kesehatan pribadinya yang telah diungkapkan kepada tenaga medis, hak atas persetujuan tindakan medis (*informed consent*), serta hak memperoleh pelayanan kesehatan yang bermutu, aman, dan tanpa perlakuan diskriminatif.
- **Peraturan Menteri Kesehatan Nomor 24 Tahun 2022 tentang Rekam Medis**: Mengatur kewajiban fasilitas pelayanan kesehatan untuk menjaga keamanan, kerahasiaan, dan keutuhan data rekam medis. Berdasarkan Pasal 28, pembukaan isi rekam medis dilakukan atas persetujuan pasien, atau dalam batas-batas tertentu yang ditentukan hukum (seperti kepentingan pemeliharaan kesehatan oleh tim medis pemeriksa, pemenuhan permintaan penegak hukum atas perintah yang sah, serta pelaporan surveilans dan penelitian perundang-undangan).
- **Peraturan Menteri Kesehatan Nomor 3 Tahun 2026 tentang Penanggulangan Penyakit**: Mengintegrasikan penanggulangan penyakit menular (termasuk HIV dan IMS) dengan penegasan prinsip anti-stigma, perlindungan kerahasiaan identitas orang yang diskrining, serta kewajiban penyediaan layanan pengobatan terpadu yang mudah diakses masyarakat.

### 2. Batasan Hukum Pembukaan Informasi Medis
Sebagai bentuk transparansi dan kepatuhan hukum, SEHATiCare menegaskan bahwa kerahasiaan data medis dilindungi dalam batas-batas yang ditentukan oleh peraturan perundang-undangan. Berdasarkan Pasal 28 Permenkes No. 24/2022 dan UU No. 17/2023, pembukaan data medis HANYA dapat dilakukan dalam situasi tertentu yang sah secara hukum:
- Atas persetujuan tertulis dari pasien yang bersangkutan.
- Untuk kepentingan pemeliharaan kesehatan dan pengobatan pasien oleh tim medis yang merawat.
- Pemenuhan permintaan penegak hukum dalam rangka penegakan hukum berdasarkan surat perintah yang sah.
- Pelaporan epidemiologi dan surveilans penyakit menular kepada Kementerian Kesehatan yang dilakukan secara teragregasi atau terenkripsi tanpa mempublikasikan identitas pribadi kepada khalayak umum.

### 3. Komitmen Privasi Teknis di SEHATiCare
SEHATiCare **tidak memberikan janji perlindungan absolut yang melampaui ketentuan hukum**, melainkan menerapkan pengamanan teknis terbaik untuk melindungi privasi Anda:
- Kemudahan menggunakan ID login anonim tanpa kewajiban mencantumkan nama asli untuk konsultasi pendampingan.
- Fitur *Quick Exit* untuk menutup dan mengalihkan layar secara cepat jika privasi Anda terganggu di tempat umum.
- Isolasi token sesi di memori aplikasi (RAM) dan larangan penyimpanan data sensitif di penyimpanan luring tanpa enkripsi.
- **Catatan Riwayat Peramban**: Aplikasi web tidak memiliki kemampuan teknis untuk menghapus riwayat peramban eksternal (*browser history*) secara otomatis. Jika Anda menggunakan perangkat bersama, disarankan menggunakan mode penyamaran (*Private/Incognito Browsing*) dan menutup jendela peramban setelah selesai.

Materi ini disusun untuk edukasi hak hukum pasien dan tidak menggantikan nasihat hukum formal.`,
    source: 'https://jdih.kemkes.go.id/peraturan/detail/permenkes-nomor-24-tahun-2022-tentang-rekam-medis',
    minutes: 4,
    featured: true
  },
  {
    id: '32000000-0000-4000-8000-000000000016',
    categorySlug: 'hak-dan-layanan',
    slug: 'panduan-mengakses-layanan-vct-dan-arv-di-faskes',
    title: 'Panduan Mengakses Layanan Tes VCT dan ARV di Faskes',
    summary: 'Langkah praktis mengakses layanan tes sukarela, alur konseling rahasia, dan pengambilan obat ARV di Puskesmas atau Rumah Sakit.',
    body: `## Langkah Praktis Menuju Fasilitas Pelayanan Kesehatan

Mengakses layanan tes HIV dan pengobatan adalah hak setiap warga negara. Pelayanan kesehatan dirancang untuk memberikan pendampingan yang ramah, rahasia, dan bebas dari penghakiman.

### Alur Layanan Konseling dan Tes Sukarela (VCT):
1. **Pendaftaran dan Konseling Pra-Tes**: Anda akan bertemu konselor terlatih di ruang privat untuk mendiskusikan alasan pemeriksaan, riwayat paparan, dan pemahaman dasar mengenai tes.
2. **Pemeriksaan Darah (Pengambilan Sampel)**: Petugas laboratorium mengambil sedikit sampel darah (melalui ujung jari atau pembuluh darah vena) menggunakan alat steril sekali pakai.
3. **Penyampaian Hasil dan Konseling Pasca-Tes**: Hasil tes disampaikan langsung secara tertutup oleh konselor kepada Anda. Konselor akan menjelaskan makna hasil dan langkah lanjutan yang perlu diambil.

### Jika Hasil Tes Non-Reaktif (Negatif):
Konselor akan mendiskusikan masa jendela dan menyarankan perlindungan kombinasi (seperti kondom atau PrEP) agar status Anda tetap terlindungi.

### Jika Hasil Tes Reaktif (Positif):
- Diagnosis dikonfirmasi sesuai algoritma pemeriksaan nasional.
- Anda akan segera dirujuk ke layanan PDP (Perawatan, Dukungan, dan Pengobatan) di puskesmas atau rumah sakit rujukan.
- Dokter akan memeriksa kondisi fisik dasar dan meresepkan terapi ARV yang disediakan melalui program pemerintah.

Jangan ragu untuk mencari bantuan medis. Mengambil langkah pertama untuk mengetahui status kesehatan adalah wujud kepedulian terbesar pada diri Anda dan orang-orang yang Anda sayangi.

Materi ini disusun untuk panduan akses layanan kesehatan masyarakat.`,
    source: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
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
    thumbnailAlt: 'Video edukasi Kementerian Kesehatan RI tentang cara penularan HIV/AIDS'
  },
  {
    id: '33000000-0000-4000-8000-000000000002',
    title: 'Bahaya HIV/AIDS dan Pentingnya Penanganan — Kementerian Kesehatan RI',
    description: 'Arsip edukasi berbahasa Indonesia tentang perkembangan HIV menjadi AIDS dan pentingnya memperoleh penanganan kesehatan.',
    url: 'https://www.youtube.com/watch?v=iRneA5GMNW0',
    thumbnailAlt: 'Video edukasi Kementerian Kesehatan RI tentang HIV/AIDS dan penanganannya'
  },
  {
    id: '33000000-0000-4000-8000-000000000003',
    title: 'HIV Self-testing: Questions and Answers — WHO',
    description: 'Video berbahasa Inggris dari WHO yang menjelaskan tes HIV mandiri sebagai pilihan tes yang sederhana dan privat.',
    url: 'https://www.youtube.com/watch?v=BA5E9wsEbPw',
    thumbnailAlt: 'Video tanya jawab WHO tentang tes HIV mandiri'
  },
  {
    id: '33000000-0000-4000-8000-000000000004',
    title: 'Zero Discrimination Day: Kesehatan dan Hak Asasi',
    description: 'Wawancara berbahasa Inggris dengan Direktur Regional UNAIDS tentang kesetaraan, inklusi, martabat, kesehatan, dan hak asasi manusia.',
    url: 'https://www.youtube.com/watch?v=1Ch6l0A-35w',
    thumbnailAlt: 'Wawancara tentang Hari Nol Diskriminasi bersama Direktur Regional UNAIDS'
  }
];

export async function runVerifiedContentSeed() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Seed konten hanya boleh dijalankan pada development atau test.');
  }

  const now = new Date();

  // 1. Archive legacy sample rows safely
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

  // 2. Categories: create if absent, preserve manual deactivation if existing
  let categoriesCreated = 0;
  let categoriesSkipped = 0;
  for (const category of categories) {
    const existing = await prisma.content_categories.findFirst({
      where: { OR: [{ id: category.id }, { slug: category.slug }] }
    });
    if (!existing) {
      await prisma.content_categories.create({
        data: { ...category, is_active: true, updated_at: now }
      });
      categoriesCreated++;
    } else {
      categoriesSkipped++;
    }
  }

  const categoryIds = new Map(
    (await prisma.content_categories.findMany({
      where: { slug: { in: categories.map((item) => item.slug) } },
      select: { id: true, slug: true }
    })).map((category) => [category.slug, category.id])
  );

  // 3. Articles: Nondestructive, Idempotent, Never overwrite human edits, Set unreviewed to REVIEW
  let articlesCreated = 0;
  let articlesUpdated = 0;
  let articlesPreserved = 0;
  let articlesConflicted = 0;

  for (const article of articles) {
    const categoryId = categoryIds.get(article.categorySlug);
    if (!categoryId) throw new Error(`Kategori tidak ditemukan: ${article.categorySlug}`);

    const existing = await prisma.education_articles.findFirst({
      where: { OR: [{ id: article.id }, { slug: article.slug }] }
    });

    if (!existing) {
      // Create new baseline article in REVIEW status (Medical content governance)
      await prisma.education_articles.create({
        data: {
          id: article.id,
          slug: article.slug,
          title: article.title,
          summary: article.summary,
          body_markdown: article.body,
          category_id: categoryId,
          thumbnail_key: null,
          thumbnail_alt: null,
          language: 'id',
          publication_status: 'REVIEW',
          source_reference: article.source,
          reading_minutes: article.minutes,
          featured: article.featured,
          is_published: false,
          published_at: null,
          reviewer_id: null,
          publisher_id: null,
          created_by: null,
          updated_by: null,
          created_at: now,
          updated_at: now
        }
      });
      articlesCreated++;
    } else {
      // Conflict check: slug matches a different ID
      if (existing.id !== article.id) {
        console.warn(`[SEED CONFLICT] Slug '${article.slug}' belongs to existing article id '${existing.id}'. Skipping to protect data.`);
        articlesConflicted++;
        continue;
      }

      // Safe ownership check: Has this record been edited or reviewed by a human?
      const isHumanEdited = Boolean(existing.created_by || existing.updated_by || existing.reviewer_id);
      if (isHumanEdited) {
        // PRESERVE human editorial work, publication status, and timestamps completely
        articlesPreserved++;
        continue;
      }

      // Safe transition for unreviewed seed-owned record:
      // Update medical text and valid authoritative sources, transition unreviewed material to REVIEW, preserve auditability
      await prisma.education_articles.update({
        where: { id: existing.id },
        data: {
          title: article.title,
          summary: article.summary,
          body_markdown: article.body,
          category_id: categoryId,
          source_reference: article.source,
          reading_minutes: article.minutes,
          featured: article.featured,
          publication_status: 'REVIEW',
          is_published: false,
          published_at: null,
          updated_at: now
        }
      });
      articlesUpdated++;
    }
  }

  // 4. Videos: Nondestructive, Idempotent, No fake transcripts, Set unreviewed to REVIEW
  const videoCategoryId = categoryIds.get('dasar-hiv');
  if (!videoCategoryId) throw new Error('Kategori video tidak ditemukan: dasar-hiv');

  let videosCreated = 0;
  let videosUpdated = 0;
  let videosPreserved = 0;

  for (const video of videos) {
    const existing = await prisma.education_videos.findUnique({
      where: { id: video.id }
    });

    if (!existing) {
      await prisma.education_videos.create({
        data: {
          id: video.id,
          title: video.title,
          description: video.description,
          category_id: videoCategoryId,
          source_type: 'EXTERNAL',
          storage_key: null,
          external_url: video.url,
          thumbnail_key: null,
          thumbnail_alt: video.thumbnailAlt,
          duration_seconds: null,
          file_size_bytes: null,
          language: 'id',
          subtitle_text: '', // Verbatim subtitles unverified
          transcript_text: '', // Verbatim transcript unverified
          speaker_type: 'GENERAL',
          publication_status: 'REVIEW',
          published_at: null,
          created_by: null,
          created_at: now,
          updated_at: now
        }
      });
      videosCreated++;
    } else {
      const isHumanEdited = Boolean(existing.created_by || existing.publisher_id);
      if (isHumanEdited) {
        videosPreserved++;
        continue;
      }

      await prisma.education_videos.update({
        where: { id: existing.id },
        data: {
          title: video.title,
          description: video.description,
          subtitle_text: '',
          transcript_text: '',
          publication_status: 'REVIEW',
          published_at: null,
          updated_at: now
        }
      });
      videosUpdated++;
    }
  }

  const result = {
    categories: { created: categoriesCreated, skipped: categoriesSkipped },
    articles: { created: articlesCreated, updated: articlesUpdated, preserved: articlesPreserved, conflicts: articlesConflicted },
    videos: { created: videosCreated, updated: videosUpdated, preserved: videosPreserved },
    archivedLegacy: archivedArticles.count + archivedVideos.count + archivedStatistics.count + hiddenFacilities.count
  };

  console.log('Seed konten selesai:', JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  runVerifiedContentSeed()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
