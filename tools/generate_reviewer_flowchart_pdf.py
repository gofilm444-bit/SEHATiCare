from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Flowable,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "revisi-flowchart-sehaticare-masukan-penguji.pdf"


ACCENT = colors.HexColor("#0F766E")
TEXT = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#475569")
BORDER = colors.HexColor("#CBD5E1")
SOFT = colors.HexColor("#F8FAFC")
WARN_BG = colors.HexColor("#FFFBEB")
WARN = colors.HexColor("#92400E")


class FlowBox(Flowable):
    def __init__(self, text, width=15.6 * cm, font_size=7.1):
        super().__init__()
        self.lines = text.strip("\n").splitlines()
        self.width = width
        self.font_size = font_size
        self.line_height = font_size + 2.4
        self.padding = 8
        self.height = len(self.lines) * self.line_height + self.padding * 2

    def wrap(self, avail_width, avail_height):
        self.width = min(self.width, avail_width)
        return self.width, self.height

    def draw(self):
        self.canv.setStrokeColor(BORDER)
        self.canv.setFillColor(SOFT)
        self.canv.roundRect(0, 0, self.width, self.height, 6, fill=1, stroke=1)
        self.canv.setFillColor(TEXT)
        self.canv.setFont("Courier", self.font_size)
        y = self.height - self.padding - self.font_size
        max_chars = int((self.width - 2 * self.padding) / (self.font_size * 0.58))
        for line in self.lines:
            self.canv.drawString(self.padding, y, line[:max_chars])
            y -= self.line_height


def make_styles():
    s = getSampleStyleSheet()
    s.add(
        ParagraphStyle(
            name="TitleCenter",
            parent=s["Title"],
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=26,
            textColor=TEXT,
            spaceAfter=8,
        )
    )
    s.add(
        ParagraphStyle(
            name="SubtitleCenter",
            parent=s["BodyText"],
            alignment=TA_CENTER,
            fontSize=10,
            leading=14,
            textColor=MUTED,
            spaceAfter=15,
        )
    )
    s.add(
        ParagraphStyle(
            name="Section",
            parent=s["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=17,
            textColor=ACCENT,
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    s.add(
        ParagraphStyle(
            name="Subsection",
            parent=s["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=TEXT,
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    s.add(
        ParagraphStyle(
            name="Small",
            parent=s["BodyText"],
            fontSize=8.7,
            leading=12.4,
            textColor=colors.HexColor("#334155"),
        )
    )
    s.add(
        ParagraphStyle(
            name="Tiny",
            parent=s["BodyText"],
            fontSize=7.8,
            leading=10.8,
            textColor=colors.HexColor("#334155"),
        )
    )
    s.add(
        ParagraphStyle(
            name="Note",
            parent=s["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8.7,
            leading=12.4,
            textColor=WARN,
            backColor=WARN_BG,
            borderColor=colors.HexColor("#FCD34D"),
            borderWidth=0.6,
            borderPadding=6,
            spaceBefore=5,
            spaceAfter=7,
        )
    )
    return s


def bullets(items, styles):
    return ListFlowable(
        [ListItem(Paragraph(item, styles["Small"]), leftIndent=8) for item in items],
        bulletType="bullet",
        leftIndent=16,
        bulletFontName="Helvetica",
        bulletFontSize=7,
        bulletColor=ACCENT,
    )


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(2 * cm, 1.1 * cm, "SEHATiCare - Revisi Flowchart Berdasarkan Masukan Penguji")
    canvas.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Halaman {doc.page}")
    canvas.restoreState()


def table(data, widths, styles, header=True, font_size=8.0):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [colors.white, SOFT]),
    ]
    if header:
        commands += [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#CCFBF1")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 0), (-1, 0), TEXT),
        ]
    t.setStyle(TableStyle(commands))
    return t


def p(text, styles, style="Tiny"):
    return Paragraph(text, styles[style])


def symbol_legend(styles):
    data = [
        [p("<b>Simbol</b>", styles), p("<b>Makna</b>", styles), p("<b>Penggunaan dalam SEHATiCare</b>", styles)],
        [p("Terminator", styles), p("Awal atau akhir proses.", styles), p("Mulai aplikasi, selesai login, konsultasi selesai.", styles)],
        [p("Process", styles), p("Aktivitas yang dilakukan sistem atau pengguna.", styles), p("Mengisi form, menyimpan data, mengirim pesan.", styles)],
        [p("Decision", styles), p("Percabangan Ya/Tidak atau kondisi valid/tidak valid.", styles), p("OTP valid?, role user?, dokter verified?", styles)],
        [p("Input/Output", styles), p("Data masuk atau keluar.", styles), p("Input email/password, nomor HP, keluhan, output respons AI.", styles)],
        [p("Data Store", styles), p("Penyimpanan data.", styles), p("Database users, consultations, messages, OTP, audit log.", styles)],
        [p("Connector", styles), p("Penghubung alur agar garis tidak saling bertabrakan.", styles), p("Menghubungkan sub-flow login, OTP, AI, dan dashboard.", styles)],
    ]
    return table(data, [3.0 * cm, 4.8 * cm, 7.8 * cm], styles, font_size=7.6)


def flow_table(title, rows, styles):
    story = [Paragraph(title, styles["Subsection"])]
    data = [[p("<b>No</b>", styles), p("<b>Simbol</b>", styles), p("<b>Aktivitas/Kondisi</b>", styles), p("<b>Output / Lanjutan</b>", styles)]]
    for i, (symbol, activity, output) in enumerate(rows, start=1):
        data.append([str(i), p(symbol, styles), p(activity, styles), p(output, styles)])
    story.append(table(data, [1.0 * cm, 2.8 * cm, 7.0 * cm, 4.8 * cm], styles, font_size=7.5))
    return story


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = make_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.7 * cm,
        bottomMargin=1.7 * cm,
        title="Revisi Flowchart SEHATiCare Berdasarkan Masukan Penguji",
        author="SEHATiCare",
    )
    story = []

    story += [
        Paragraph("Revisi Flowchart SEHATiCare", styles["TitleCenter"]),
        Paragraph(
            "Dokumen kerja berdasarkan masukan penguji tanggal 10 Juni 2026. Fokus revisi: standar simbol flowchart, detail alur per aktor, modul AI, landing page, login, registrasi, dan OTP.",
            styles["SubtitleCenter"],
        ),
        Paragraph("A. Prinsip Penyusunan Flowchart", styles["Section"]),
        bullets(
            [
                "Setiap flowchart memiliki terminator awal dan akhir yang jelas.",
                "Setiap percabangan menggunakan simbol decision dengan label kondisi, misalnya Ya/Tidak atau Valid/Tidak Valid.",
                "Setiap input dan output dipisahkan dari proses agar alur lebih mudah diaudit.",
                "Setiap akses data menggunakan simbol data store, misalnya database user, OTP, konsultasi, pesan, dan audit log.",
                "Setiap garis alur harus tersambung ke simbol atau connector, tidak bercabang di tengah garis.",
            ],
            styles,
        ),
        Paragraph("B. Legenda Simbol", styles["Section"]),
        symbol_legend(styles),
        Paragraph(
            "Catatan implementasi: backend aplikasi saat ini aktif untuk role PASIEN, DOKTER, ADMIN, dan AI. Role PENDAMPING ada di frontend sebagai placeholder. Role petugas kesehatan dan penjangkau belum tampak sebagai role backend, sehingga pada flowchart ditandai sebagai rancangan pengembangan.",
            styles["Note"],
        ),
    ]

    story.append(PageBreak())

    story += [
        Paragraph("C. Flowchart Utama Sistem", styles["Section"]),
        FlowBox(
            """
(Start)
   |
   v
[User membuka aplikasi]
   |
   v
<Halaman yang diakses?>
   |-- Portal publik / edukasi --> [Tampilkan konten edukasi] --> (End)
   |
   |-- Login / Registrasi
          |
          v
      [Autentikasi user]
          |
          v
      <Autentikasi berhasil?>
          |-- Tidak --> [Tampilkan pesan gagal dan opsi ulang] --> (End)
          |
          |-- Ya
                |
                v
             <Role user?>
                |-- PASIEN --> [Dashboard Pasien]
                |-- DOKTER --> [Dashboard Dokter]
                |-- ADMIN --> [Dashboard Admin]
                |-- PENDAMPING/PETUGAS/PENJANGKAU --> [Dashboard rancangan]
                |
                v
              (End)
"""
        ),
        Paragraph("Penjabaran Flow Utama", styles["Subsection"]),
    ]
    story += flow_table(
        "",
        [
            ("Terminator", "User memulai akses aplikasi melalui browser.", "Masuk ke portal publik."),
            ("Decision", "Sistem memeriksa tujuan akses: portal, edukasi, login, atau registrasi.", "Mengarah ke flow terkait."),
            ("Process", "Jika publik, sistem menampilkan landing page dan materi edukasi.", "User dapat membaca edukasi atau membuka login."),
            ("Process", "Jika login/registrasi, sistem menjalankan autentikasi.", "Masuk ke decision berhasil/gagal."),
            ("Decision", "Jika autentikasi berhasil, sistem membaca role user.", "Redirect ke dashboard sesuai role."),
            ("Terminator", "Jika gagal, sistem menampilkan pesan dan memberi opsi ulang.", "Proses berakhir atau ulang input."),
        ],
        styles,
    )

    story.append(PageBreak())

    story += [
        Paragraph("D. Flowchart Landing Page, Login, Registrasi, dan OTP", styles["Section"]),
        Paragraph("D1. Landing Page dan Akses Edukasi", styles["Subsection"]),
        FlowBox(
            """
(Start)
   |
   v
[Tampilkan landing page]
   |
   +--> [Carousel edukasi]
   +--> [Konten Apa itu HIV]
   +--> [Mitos vs Fakta]
   +--> [Edukasi awal / multimedia / FAQ]
   |
   v
<User memilih aksi?>
   |-- Baca Edukasi --> [Buka /edukasi] --> [Tampilkan daftar artikel] --> (End)
   |-- Login        --> [Buka modal login atau /login] --> (Connector Login)
   |-- Daftar       --> [Buka form registrasi] --> (Connector Registrasi)
"""
        ),
    ]
    story += flow_table(
        "D2. Login Email dan Password",
        [
            ("Input/Output", "User mengisi email dan password.", "Data dikirim ke sistem."),
            ("Process", "Sistem validasi format email dan password tidak kosong.", "Jika salah, tampil pesan validasi."),
            ("Data Store", "Sistem mencari user di database users.", "Jika user tidak ditemukan, login gagal."),
            ("Decision", "Password sesuai dengan password_hash?", "Ya lanjut, Tidak tampil pesan gagal."),
            ("Decision", "Akun aktif dan terverifikasi?", "Ya buat token, Tidak tampil instruksi verifikasi."),
            ("Process", "Sistem membuat access token dan refresh token.", "User diarahkan ke dashboard sesuai role."),
        ],
        styles,
    )
    story += flow_table(
        "D3. Registrasi dan Verifikasi OTP",
        [
            ("Input/Output", "User mengisi nama, email/nomor HP, password, dan persetujuan privasi.", "Data dikirim ke sistem."),
            ("Decision", "Format input valid?", "Tidak: tampilkan error field yang salah."),
            ("Data Store", "Sistem cek email atau nomor HP di database users.", "Jika sudah terdaftar, tampil pesan sudah terdaftar."),
            ("Process", "Sistem membuat akun status belum terverifikasi.", "Simpan user dan permintaan OTP."),
            ("Process", "Sistem mengirim OTP ke email atau nomor HP.", "User masuk ke form input OTP."),
            ("Decision", "OTP diterima user?", "Tidak: tampilkan tombol kirim ulang OTP."),
            ("Input/Output", "User memasukkan OTP.", "Sistem validasi OTP."),
            ("Decision", "OTP benar dan belum kedaluwarsa?", "Ya verifikasi akun; Tidak tampil error OTP salah/kedaluwarsa."),
            ("Process", "Sistem mengaktifkan akun dan membuat token login.", "Redirect ke dashboard sesuai role."),
        ],
        styles,
    )
    story += [
        Paragraph(
            "Catatan gap aplikasi: backend sudah memiliki endpoint OTP request dan OTP verify. Namun tampilan frontend yang aktif saat ini masih dominan email dan password. Form registrasi dan flow OTP penuh perlu ditambahkan atau dijelaskan sebagai rancangan pengembangan.",
            styles["Note"],
        )
    ]

    story.append(PageBreak())

    story += [
        Paragraph("E. Flowchart Modul Pasien dan AI", styles["Section"]),
        Paragraph("E1. Alur Dashboard dan Konsultasi Pasien", styles["Subsection"]),
        FlowBox(
            """
(Start Pasien)
   |
   v
[Dashboard Pasien]
   |
   v
<Ada konsultasi aktif?>
   |-- Ya    --> [Buka detail konsultasi]
   |-- Tidak --> [Isi keluhan awal] --> [Simpan konsultasi MENUNGGU_DOKTER]
                                      |
                                      v
                                [Buka detail konsultasi]
                                      |
                                      v
                              [User memberi consent]
                                      |
                                      v
                               [Chat teks / voice note]
                                      |
                                      v
                             <Dokter sudah mengambil?>
                                 |-- Tidak --> (Connector AI)
                                 |-- Ya    --> [Chat dengan dokter]
                                                  |
                                                  v
                                         [Minta akhiri bila perlu]
                                                  |
                                                  v
                                                (End)
"""
        ),
        Paragraph("E2. Alur Penjawab Otomatis AI", styles["Subsection"]),
        FlowBox(
            """
(Connector AI)
   |
   v
[Pasien mengirim pertanyaan]
   |
   v
<Consent tersedia?>
   |-- Tidak --> [Minta user memberi consent] --> (End)
   |
   |-- Ya
        |
        v
    [Deteksi red-flag]
        |
        v
    <Red-flag terdeteksi?>
        |-- Ya --> [Set priority tinggi dan AI berhenti]
        |          [Eskalasi ke dokter/tenaga kesehatan] --> (End)
        |
        |-- Tidak
              |
              v
          [Ambil konteks konsultasi dan basis pengetahuan]
              |
              v
          [AI memproses pertanyaan]
              |
              v
          <AI mampu menjawab?>
              |-- Ya    --> [Simpan dan tampilkan respons AI] --> (End)
              |-- Tidak --> [Eskalasi ke tenaga kesehatan] --> (End)
"""
        ),
    ]
    story += flow_table(
        "E3. Detail Keputusan AI dan Eskalasi",
        [
            ("Input/Output", "Pasien mengirim pertanyaan atau keluhan lanjutan.", "Pesan masuk ke sistem chat."),
            ("Decision", "Consent sudah diberikan?", "Jika belum, sistem menolak chat dan meminta consent."),
            ("Process", "Sistem memeriksa kata kunci red-flag seperti risiko menyakiti diri.", "Jika terdeteksi, priority dinaikkan."),
            ("Data Store", "Sistem membaca data konsultasi, pesan sebelumnya, dan basis pengetahuan.", "Konteks dikirim ke AI."),
            ("Process", "AI membuat respons edukatif dan pendampingan awal.", "Respons disimpan sebagai pesan AI."),
            ("Decision", "Jika AI tidak dapat menjawab atau risiko tinggi.", "Sistem eskalasi ke dokter/tenaga kesehatan."),
            ("Data Store", "Audit event disimpan untuk red-flag, AI skipped, dan consent.", "Admin dapat memonitor audit."),
        ],
        styles,
    )

    story.append(PageBreak())

    story += [
        Paragraph("F. Flowchart Dokter", styles["Section"]),
        FlowBox(
            """
(Start Dokter)
   |
   v
[Login sebagai dokter]
   |
   v
<Profil dokter VERIFIED?>
   |-- Tidak --> [Tampilkan akses ditolak / menunggu verifikasi] --> (End)
   |
   |-- Ya
        |
        v
   [Tampilkan dashboard dokter]
        |
        +--> [Konsultasi Saya]
        +--> [Antrean MENUNGGU_DOKTER / AI_AKTIF]
        |
        v
   [Dokter memilih konsultasi]
        |
        v
   [Claim konsultasi]
        |
        v
   <Berhasil claim?>
        |-- Tidak --> [Tampilkan sudah diambil dokter lain] --> [Refresh antrean]
        |-- Ya    --> [Status DOKTER_AKTIF]
                         |
                         v
                   [Chat pasien / voice note]
                         |
                         v
                   <Konsultasi selesai?>
                         |-- Tidak --> [Lanjutkan chat]
                         |-- Ya    --> [Selesaikan konsultasi] --> (End)
"""
        ),
    ]
    story += flow_table(
        "F1. Detail Alur Dokter",
        [
            ("Decision", "Sistem memeriksa profil dokter VERIFIED.", "Dokter belum verified tidak bisa melihat antrean."),
            ("Data Store", "Sistem membaca antrean konsultasi aktif.", "Menampilkan prioritas dan red-flag."),
            ("Process", "Dokter mengambil konsultasi.", "Konsultasi di-assign ke dokter tersebut."),
            ("Decision", "Jika konsultasi sudah diambil dokter lain.", "Tampilkan pesan konflik dan refresh antrean."),
            ("Process", "Dokter melakukan chat dan voice note.", "Pesan disimpan di database."),
            ("Process", "Dokter menyelesaikan konsultasi.", "Status menjadi SELESAI dan chat read-only."),
        ],
        styles,
    )

    story.append(PageBreak())

    story += [
        Paragraph("G. Flowchart Admin dan Aktor Pengembangan", styles["Section"]),
        Paragraph("G1. Admin", styles["Subsection"]),
        FlowBox(
            """
(Start Admin)
   |
   v
[Login sebagai admin]
   |
   v
[Dashboard Admin]
   |
   +--> [Verifikasi dokter] --> [Update doctor_profile] --> [Simpan audit log]
   |
   +--> [Monitoring konsultasi] --> <Perlu force close?>
   |                                  |-- Ya --> [Force close konsultasi] --> [Simpan audit]
   |                                  |-- Tidak --> [Lanjut monitoring]
   |
   +--> [Lihat audit log dan audit event]
   |
   v
(End)
"""
        ),
    ]
    story += flow_table(
        "G2. Pendamping, Petugas Kesehatan, dan Penjangkau",
        [
            ("Terminator", "Aktor login ke sistem.", "Masuk ke validasi role."),
            ("Decision", "Role tersedia di backend?", "Jika belum, masuk status rancangan pengembangan."),
            ("Process", "Pendamping memantau tugas, pasien, red-flag, edukasi, rujukan, check-in.", "Saat ini dashboard pendamping masih placeholder frontend."),
            ("Process", "Petugas kesehatan memantau kasus, memberi edukasi, dan menerima eskalasi dari AI.", "Perlu definisi role dan endpoint backend."),
            ("Process", "Penjangkau melakukan outreach, follow-up, dan pendampingan komunitas.", "Perlu definisi hak akses dan modul data."),
            ("Data Store", "Semua aksi penting harus masuk audit log.", "Mendukung akuntabilitas dan monitoring."),
        ],
        styles,
    )
    story += [
        Paragraph(
            "Rekomendasi untuk disertasi: bedakan dengan jelas antara modul yang sudah terimplementasi dan modul yang masih rancangan. Pendamping, petugas kesehatan, dan penjangkau dapat dimasukkan sebagai future workflow bila belum tersedia di aplikasi.",
            styles["Note"],
        )
    ]

    story.append(PageBreak())

    story += [
        Paragraph("H. Matriks Revisi Berdasarkan Masukan Penguji", styles["Section"]),
    ]
    matrix = [
        [p("<b>Masukan Penguji</b>", styles), p("<b>Tindak Lanjut pada Flowchart</b>", styles), p("<b>Status Aplikasi Saat Ini</b>", styles)],
        [
            p("Flowchart mengikuti standar simbol seperti ISO 5807.", styles),
            p("Tambahkan legenda simbol dan gunakan terminator, process, decision, input/output, data store, connector.", styles),
            p("Perlu diterapkan pada dokumen final disertasi.", styles),
        ],
        [
            p("Garis alur harus tersambung utuh dan tidak bercabang di tengah garis.", styles),
            p("Gunakan connector dan decision node untuk semua percabangan.", styles),
            p("PDF ini menggunakan connector tekstual; versi gambar final perlu digambar ulang rapi.", styles),
        ],
        [
            p("Flowchart detail untuk dokter, pasien, petugas kesehatan, pendamping, penjangkau.", styles),
            p("Pisahkan flow per aktor dan jelaskan hak akses.", styles),
            p("Pasien, dokter, admin aktif; pendamping placeholder; petugas/penjangkau belum ada backend.", styles),
        ],
        [
            p("Modul pasien perlu flow AI otomatis dan eskalasi.", styles),
            p("Tambahkan alur consent, red-flag, basis pengetahuan, respons AI, dan eskalasi.", styles),
            p("Sebagian sudah ada: AI, consent, red-flag, audit. Eskalasi formal perlu diperkuat.", styles),
        ],
        [
            p("Landing page, registrasi, login, OTP, dan kondisi gagal harus detail.", styles),
            p("Tambahkan flow normal dan gagal: OTP tidak diterima, kedaluwarsa, input salah, akun belum verified.", styles),
            p("Backend OTP ada; frontend registrasi + OTP penuh belum aktif.", styles),
        ],
        [
            p("Desain depan perlu studi referensi aplikasi sejenis.", styles),
            p("Tambahkan bab/tabel benchmark UI pada disertasi.", styles),
            p("Perlu dikerjakan sebagai analisis desain, bukan hanya kode.", styles),
        ],
    ]
    story.append(table(matrix, [5.1 * cm, 5.4 * cm, 5.1 * cm], styles, font_size=7.1))
    story += [
        Paragraph("I. Rekomendasi Perbaikan Aplikasi", styles["Section"]),
        bullets(
            [
                "Tambahkan frontend registrasi dan verifikasi OTP agar sesuai masukan penguji.",
                "Tambahkan role backend untuk pendamping, petugas kesehatan, dan penjangkau jika benar-benar menjadi aktor penelitian.",
                "Tambahkan mekanisme eskalasi eksplisit dari AI ke tenaga kesehatan, misalnya status, notifikasi antrean, dan audit event.",
                "Tambahkan halaman atau tabel referensi desain landing page dalam dokumen disertasi.",
                "Buat versi final flowchart visual dengan aplikasi diagram seperti draw.io, Visio, atau Mermaid yang kemudian diekspor ke PNG/SVG untuk Word.",
            ],
            styles,
        ),
        Paragraph("J. Penutup", styles["Section"]),
        Paragraph(
            "Dokumen ini dapat digunakan sebagai dasar revisi flowchart disertasi. Untuk lampiran final, setiap flow sebaiknya digambar ulang dalam bentuk visual dengan simbol standar dan garis siku yang rapi, kemudian diekspor sebagai gambar beresolusi tinggi.",
            styles["Small"],
        ),
    ]

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
