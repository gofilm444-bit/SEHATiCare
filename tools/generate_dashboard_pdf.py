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
OUTPUT = ROOT / "output" / "pdf" / "skema-dashboard-sehaticare.pdf"


class FlowBox(Flowable):
    def __init__(self, text, width=15.5 * cm, fill=colors.HexColor("#F8FAFC")):
        super().__init__()
        self.lines = text.strip("\n").splitlines()
        self.width = width
        self.line_height = 10
        self.padding = 8
        self.fill = fill
        self.height = (len(self.lines) * self.line_height) + (self.padding * 2)

    def wrap(self, avail_width, avail_height):
        self.width = min(self.width, avail_width)
        return self.width, self.height

    def draw(self):
        self.canv.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.canv.setFillColor(self.fill)
        self.canv.roundRect(0, 0, self.width, self.height, 6, fill=1, stroke=1)
        self.canv.setFillColor(colors.HexColor("#0F172A"))
        self.canv.setFont("Courier", 7.5)
        y = self.height - self.padding - 7
        for line in self.lines:
            self.canv.drawString(self.padding, y, line[:105])
            y -= self.line_height


def make_styles():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="TitleCenter",
            parent=base["Title"],
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=27,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="SubtitleCenter",
            parent=base["BodyText"],
            alignment=TA_CENTER,
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#475569"),
            spaceAfter=16,
        )
    )
    base.add(
        ParagraphStyle(
            name="Section",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0F766E"),
            spaceBefore=12,
            spaceAfter=7,
        )
    )
    base.add(
        ParagraphStyle(
            name="Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#334155"),
        )
    )
    base.add(
        ParagraphStyle(
            name="Note",
            parent=base["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#92400E"),
            backColor=colors.HexColor("#FFFBEB"),
            borderColor=colors.HexColor("#FCD34D"),
            borderWidth=0.6,
            borderPadding=6,
            spaceBefore=6,
            spaceAfter=8,
        )
    )
    return base


def bullet_list(items, styles):
    return ListFlowable(
        [ListItem(Paragraph(item, styles["Small"]), leftIndent=8) for item in items],
        bulletType="bullet",
        leftIndent=16,
        bulletFontName="Helvetica",
        bulletFontSize=7,
        bulletColor=colors.HexColor("#0F766E"),
    )


def role_table(styles):
    data = [
        [
            Paragraph("<b>Role</b>", styles["Small"]),
            Paragraph("<b>Fungsi Dashboard</b>", styles["Small"]),
            Paragraph("<b>Status Implementasi</b>", styles["Small"]),
        ],
        ["PASIEN", "Mulai konsultasi, consent, chat, voice note, edukasi.", "Aktif"],
        ["DOKTER", "Melihat antrean, mengambil konsultasi, chat, menyelesaikan konsultasi.", "Aktif"],
        ["ADMIN", "Verifikasi dokter, audit log, monitoring, force close.", "Aktif"],
        ["PENDAMPING", "Dashboard tugas, red-flag, edukasi, rujukan, check-in.", "Placeholder frontend"],
    ]
    table = Table(data, colWidths=[3 * cm, 8 * cm, 4.5 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#CCFBF1")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def dashboard_block(title, description, layout, bullets, styles):
    story = [Paragraph(title, styles["Section"]), Paragraph(description, styles["Small"]), Spacer(1, 6)]
    story.append(FlowBox(layout))
    story.append(Spacer(1, 6))
    story.append(bullet_list(bullets, styles))
    return story


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(2 * cm, 1.1 * cm, "SEHATiCare - Skema Tampilan Dashboard")
    canvas.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Halaman {doc.page}")
    canvas.restoreState()


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = make_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.7 * cm,
        bottomMargin=1.7 * cm,
        title="Skema Tampilan Dashboard SEHATiCare",
        author="SEHATiCare",
    )

    story = [
        Paragraph("Skema Tampilan Dashboard SEHATiCare", styles["TitleCenter"]),
        Paragraph(
            "Dokumen ini menjabarkan struktur tampilan dashboard berdasarkan role pengguna pada aplikasi SEHATiCare.",
            styles["SubtitleCenter"],
        ),
        Paragraph("Gambaran Role", styles["Section"]),
        role_table(styles),
        Paragraph(
            "Catatan: role PENDAMPING sudah ada di frontend, tetapi belum tersedia di schema backend/database. "
            "Karena itu dashboard pendamping sebaiknya ditulis sebagai fitur rencana atau placeholder.",
            styles["Note"],
        ),
    ]

    story += dashboard_block(
        "1. Dashboard Pasien",
        "Dashboard pasien berfokus pada status konsultasi aktif, akses edukasi, dan aksi mulai atau lanjut konsultasi.",
        """
+------------------------------------------------------+
| Header / Navbar                                      |
| Logo SEHATiCare        Menu          Profil / Logout |
+------------------------------------------------------+
| Ringkasan Pasien                         [PASIEN]    |
| Selamat datang kembali                               |
+-------------------+-------------------+--------------+
| Konsultasi        | Artikel Edukasi   | Progress     |
| Status terkini    | Terakhir dibaca   | Kesehatan    |
| 0 / 1 aktif       | Segera hadir      | Belum ada    |
+-------------------+-------------------+--------------+
| Apa langkah selanjutnya?                             |
| [Mulai Konsultasi] / [Lanjutkan Konsultasi]          |
+------------------------------------------------------+
""",
        [
            "Jika tidak ada konsultasi aktif, pasien menekan tombol Mulai Konsultasi.",
            "Jika ada konsultasi aktif, tombol berubah menjadi Lanjutkan Konsultasi.",
            "Konsultasi dimulai dengan pengisian keluhan awal minimal 10 karakter.",
        ],
        styles,
    )

    story += dashboard_block(
        "2. Detail Konsultasi Pasien",
        "Halaman ini menjadi ruang utama pasien untuk memberi persetujuan, chat, voice note, dan meminta penutupan konsultasi.",
        """
+------------------------------------------------------+
| Sesi Konsultasi                                      |
| ID Konsultasi                         [STATUS]       |
|                                      [Minta Akhiri]  |
+------------------------------------------------------+
| Keluhan Awal                                         |
| Dibuka pada: tanggal dan jam                         |
| Isi keluhan pasien                                   |
+------------------------------------------------------+
| Chat Konsultasi                                      |
| Info: AI pendamping awal, bukan pengganti dokter     |
+------------------------------------------------------+
| Persetujuan Sebelum Chat                             |
| [ ] Saya memahami AI bukan diagnosis medis           |
| [Saya Setuju & Mulai Chat]                           |
+------------------------------------------------------+
| Area Pesan                                           |
| Pasien: ...   AI: ...   Dokter: ...                  |
+------------------------------------------------------+
| [Voice Note] [Input pesan...]              [Kirim]   |
+------------------------------------------------------+
""",
        [
            "Consent wajib diberikan sebelum pasien mulai chat.",
            "AI dapat membalas saat belum ada dokter, consent sudah ada, dan tidak ada red-flag.",
            "Jika dokter sudah mengambil konsultasi, AI tidak aktif lagi.",
            "Pasien bisa meminta konsultasi diakhiri, tetapi dokter yang menyelesaikan.",
        ],
        styles,
    )

    story.append(PageBreak())

    story += dashboard_block(
        "3. Dashboard Dokter",
        "Dashboard dokter menampilkan konsultasi aktif milik dokter dan antrean konsultasi yang bisa diambil.",
        """
+------------------------------------------------------+
| Panel Dokter                              [DOKTER]   |
| Antrian konsultasi                         [Refresh] |
+------------------------------------------------------+
| Konsultasi Saya                                      |
| +--------------------------------------------------+ |
| | Keluhan pasien                                  | |
| | Dibuka: tanggal, Pasien: nama pasien            | |
| | [Sedang Berlangsung] [Lanjutkan]                | |
| +--------------------------------------------------+ |
+------------------------------------------------------+
| Antrean Konsultasi                                  |
| +--------------------------------------------------+ |
| | Keluhan awal pasien                             | |
| | Aktivitas terakhir: tanggal                     | |
| | [Menunggu Dokter / Aktif dengan Asisten] [Ambil]| |
| +--------------------------------------------------+ |
+------------------------------------------------------+
""",
        [
            "Dokter harus memiliki profil VERIFIED untuk melihat antrean.",
            "Antrean berisi status MENUNGGU_DOKTER atau AI_AKTIF.",
            "Kasus red-flag ditandai sebagai Prioritas.",
            "Setelah tombol Ambil ditekan, konsultasi berpindah ke Konsultasi Saya.",
        ],
        styles,
    )

    story += dashboard_block(
        "4. Detail Konsultasi Dokter",
        "Halaman ini dipakai dokter untuk membaca keluhan, membalas chat, melihat prioritas, dan menyelesaikan konsultasi.",
        """
+------------------------------------------------------+
| Sesi Konsultasi                                      |
| ID Konsultasi                         [STATUS]       |
| Pasien: Nama Pasien                   [Selesaikan]   |
+------------------------------------------------------+
| Jika Red-Flag                                        |
| [Prioritas Darurat Terdeteksi]                       |
+------------------------------------------------------+
| Jika Pasien Minta Ditutup                            |
| Pasien meminta konsultasi ditutup                    |
+------------------------------------------------------+
| Keluhan Awal                                         |
| Isi keluhan awal pasien                              |
+------------------------------------------------------+
| Chat Konsultasi                                      |
| Pasien: ...   AI: ...   Dokter: ...                  |
+------------------------------------------------------+
| [Voice Note] [Input pesan...]              [Kirim]   |
+------------------------------------------------------+
""",
        [
            "Dokter dapat mengirim pesan teks dan voice note.",
            "Jika konsultasi selesai, chat menjadi read-only.",
            "Tombol utama dokter adalah Selesaikan Konsultasi.",
            "Status akhir konsultasi adalah SELESAI.",
        ],
        styles,
    )

    story.append(PageBreak())

    story += dashboard_block(
        "5. Dashboard Admin",
        "Dashboard admin berfungsi sebagai pusat pengelolaan sistem, dokter, audit, monitoring, dan konten.",
        """
+------------------------------------------------------+
| Dashboard Admin                           [ADMIN]    |
| Ringkasan pengelolaan sistem                         |
+-------------------+-------------------+--------------+
| Portal            | Edukasi           | Users        |
| Konten portal     | Artikel edukasi   | Data user    |
+-------------------+-------------------+--------------+
| Audit Log         | Monitoring        | Dokter       |
| Riwayat aktivitas | Pantau sistem     | Verifikasi   |
+-------------------+-------------------+--------------+
""",
        [
            "Admin dapat memverifikasi dokter.",
            "Admin dapat melihat audit log dan audit event.",
            "Admin dapat melakukan monitoring.",
            "Admin dapat melakukan force close konsultasi.",
        ],
        styles,
    )

    story += dashboard_block(
        "6. Dashboard Pendamping",
        "Dashboard pendamping sudah tersedia sebagai tampilan frontend, tetapi belum aktif secara backend.",
        """
+------------------------------------------------------+
| Dashboard Pendamping                    [PENDAMPING] |
+-------------------+-------------------+--------------+
| Antrian Tugas     | Pilih Pasien      | Red-Flag     |
| Belum ada tugas   | Data belum ada    | Tidak ada    |
+-------------------+-------------------+--------------+
| Aksi Cepat                                           |
+-------------------+-------------------+--------------+
| Kirim Edukasi     | Rujukan Jadwal    | Kepatuhan    |
| [Disabled]        | [Disabled]        | [Disabled]   |
+-------------------+-------------------+--------------+
| Check-in Chat: [Disabled]                            |
+------------------------------------------------------+
""",
        [
            "Role PENDAMPING belum ada di enum database backend.",
            "Semua aksi cepat masih disabled.",
            "Untuk laporan, tuliskan sebagai fitur pengembangan berikutnya.",
        ],
        styles,
    )

    story += [
        Paragraph("Ringkasan Alur Dashboard", styles["Section"]),
        FlowBox(
            """
Login
 |
 +-- Pasien      -> Dashboard -> Mulai/Lanjut Konsultasi -> Chat AI/Dokter
 +-- Dokter      -> Antrean -> Ambil Konsultasi -> Chat -> Selesaikan
 +-- Admin       -> Kelola Dokter -> Audit -> Monitoring -> Force Close
 +-- Pendamping  -> Placeholder frontend, belum aktif di backend
"""
        ),
    ]

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
