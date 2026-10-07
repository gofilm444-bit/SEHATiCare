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
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "skema-portal-depan-sehaticare.pdf"


class LayoutBox(Flowable):
    def __init__(self, text, width=15.5 * cm):
        super().__init__()
        self.lines = text.strip("\n").splitlines()
        self.width = width
        self.line_height = 10
        self.padding = 8
        self.height = len(self.lines) * self.line_height + self.padding * 2

    def wrap(self, avail_width, avail_height):
        self.width = min(self.width, avail_width)
        return self.width, self.height

    def draw(self):
        self.canv.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.canv.setFillColor(colors.HexColor("#F8FAFC"))
        self.canv.roundRect(0, 0, self.width, self.height, 6, fill=1, stroke=1)
        self.canv.setFillColor(colors.HexColor("#0F172A"))
        self.canv.setFont("Courier", 7.4)
        y = self.height - self.padding - 7
        for line in self.lines:
            self.canv.drawString(self.padding, y, line[:108])
            y -= self.line_height


def styles():
    s = getSampleStyleSheet()
    s.add(
        ParagraphStyle(
            name="TitleCenter",
            parent=s["Title"],
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=27,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=8,
        )
    )
    s.add(
        ParagraphStyle(
            name="SubtitleCenter",
            parent=s["BodyText"],
            alignment=TA_CENTER,
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#475569"),
            spaceAfter=16,
        )
    )
    s.add(
        ParagraphStyle(
            name="Section",
            parent=s["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0F766E"),
            spaceBefore=12,
            spaceAfter=7,
        )
    )
    s.add(
        ParagraphStyle(
            name="Small",
            parent=s["BodyText"],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#334155"),
        )
    )
    s.add(
        ParagraphStyle(
            name="Note",
            parent=s["BodyText"],
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
    return s


def bullets(items, s):
    return ListFlowable(
        [ListItem(Paragraph(item, s["Small"]), leftIndent=8) for item in items],
        bulletType="bullet",
        leftIndent=16,
        bulletFontSize=7,
        bulletColor=colors.HexColor("#0F766E"),
    )


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(2 * cm, 1.1 * cm, "SEHATiCare - Skema Portal Depan")
    canvas.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Halaman {doc.page}")
    canvas.restoreState()


def route_table(s):
    data = [
        [Paragraph("<b>Route</b>", s["Small"]), Paragraph("<b>Fungsi Tampilan</b>", s["Small"])],
        ["/", "Portal publik sebelum login. Berisi edukasi, CTA login, carousel, mitos/fakta, FAQ, dan footer."],
        ["/edukasi", "Halaman daftar materi edukasi publik: artikel, infografik, dan video."],
        ["/login", "Halaman login khusus form autentikasi. Tidak berisi konten edukasi."],
    ]
    table = Table(data, colWidths=[3.2 * cm, 12.3 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#CCFBF1")),
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


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    s = styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.7 * cm,
        bottomMargin=1.7 * cm,
        title="Skema Portal Depan SEHATiCare",
        author="SEHATiCare",
    )

    story = [
        Paragraph("Skema Tampilan Portal Depan SEHATiCare", s["TitleCenter"]),
        Paragraph(
            "Dokumen ini menjabarkan tampilan awal aplikasi sebelum pengguna login, khususnya portal publik yang berisi konten edukasi.",
            s["SubtitleCenter"],
        ),
        Paragraph("Pemisahan Halaman", s["Section"]),
        route_table(s),
        Paragraph(
            "Catatan: konten edukasi tidak ditempatkan di halaman /login. Konten edukasi berada di portal publik / dan halaman /edukasi.",
            s["Note"],
        ),
        Paragraph("1. Skema Portal Publik /", s["Section"]),
        Paragraph(
            "Halaman ini adalah tampilan utama ketika user membuka aplikasi. Tujuannya memberi edukasi awal, mengurangi stigma, dan menyediakan akses menuju login.",
            s["Small"],
        ),
        Spacer(1, 6),
        LayoutBox(
            """
+------------------------------------------------------+
| Portal Publik SEHATiCare                             |
| Logo + label Portal Publik                           |
| Headline: Informasi HIV yang jelas dan aman          |
| Deskripsi singkat                                    |
| [Baca Edukasi] [Login] [Daftar]                      |
+------------------------------------------------------+
| Carousel Sorotan Edukasi & Informasi                 |
| Slide gambar/konten prioritas                        |
| [Prev] [Next] [Indicator]                            |
+------------------------------------------------------+
| Kartu Edukasi Ringkas                                |
| +-----------------------+ +------------------------+ |
| | Apa itu HIV?          | | Langkah aman pertama   | |
| | Ringkasan tanpa stigma| | 4 langkah awal         | |
| +-----------------------+ +------------------------+ |
+------------------------------------------------------+
| Mitos vs Fakta                                       |
| 4 kartu pembanding informasi yang sering keliru      |
+------------------------------------------------------+
| Edukasi Awal                                         |
| Kartu artikel edukasi published                      |
+------------------------------------------------------+
| Video, Foto, dan Info                                |
| Konten multimedia published                          |
+------------------------------------------------------+
| FAQ                                                  |
| Pertanyaan umum dan jawaban ringkas                  |
+------------------------------------------------------+
| Footer                                               |
| Kebijakan privasi, kontak, hotline, disclaimer       |
+------------------------------------------------------+
"""
        ),
        Spacer(1, 6),
        bullets(
            [
                "Tombol Baca Edukasi mengarah ke halaman /edukasi.",
                "Tombol Login membuka modal login di halaman portal.",
                "Tombol Daftar saat ini mengarah ke /login.",
                "Konten carousel, edukasi awal, video, infografis, dan FAQ diambil dari portal content frontend.",
            ],
            s,
        ),
        Paragraph("2. Skema Modal Login di Portal", s["Section"]),
        Paragraph(
            "Pada portal publik, login dapat muncul sebagai modal tanpa meninggalkan halaman depan.",
            s["Small"],
        ),
        Spacer(1, 6),
        LayoutBox(
            """
+------------------------------------------------------+
| Overlay gelap di atas Portal Publik                  |
+--------------------- Modal Login --------------------+
| Masuk ke SEHATiCare                            [X]   |
| Gunakan akun yang sudah disediakan                   |
|                                                      |
| Email                                                |
| [____________________________________]               |
| Password                                             |
| [____________________________________]               |
|                                                      |
| [Masuk]                                              |
+------------------------------------------------------+
"""
        ),
        Spacer(1, 6),
        bullets(
            [
                "Jika login berhasil, user diarahkan ke dashboard sesuai role.",
                "Jika modal ditutup, user tetap berada di portal publik.",
                "Halaman /login tetap tersedia sebagai halaman login penuh.",
            ],
            s,
        ),
        Paragraph("3. Skema Halaman Edukasi /edukasi", s["Section"]),
        Paragraph(
            "Halaman /edukasi menampilkan daftar materi yang bisa dibaca sebelum login.",
            s["Small"],
        ),
        Spacer(1, 6),
        LayoutBox(
            """
+------------------------------------------------------+
| Portal Publik                                        |
| Edukasi HIV/AIDS                  [Kembali ke Portal] |
| Daftar materi edukasi awal dan multimedia            |
+------------------------------------------------------+
| Grid Kartu Edukasi                                   |
| +-----------------------+ +------------------------+ |
| | Judul artikel         | | Judul infografik       | |
| | Label: Artikel        | | Label: Infografik      | |
| | Ringkasan             | | Ringkasan              | |
| | [Lihat detail]        | | [Lihat detail]         | |
| +-----------------------+ +------------------------+ |
| +-----------------------+                            |
| | Judul video           |                            |
| | Label: Video          |                            |
| | Ringkasan             |                            |
| | [Lihat detail]        |                            |
| +-----------------------+                            |
+------------------------------------------------------+
"""
        ),
        Spacer(1, 6),
        bullets(
            [
                "Materi disusun dari edukasi awal, infografis, dan video yang berstatus Published.",
                "Ringkasan panjang dapat dibuka atau ditutup.",
                "Tombol Lihat detail sudah tampil, tetapi belum terlihat mengarah ke detail artikel backend.",
            ],
            s,
        ),
        Paragraph("4. Alur Pengguna Portal Depan", s["Section"]),
        LayoutBox(
            """
User membuka aplikasi
        |
        v
Portal Publik /
        |
        +-- Membaca edukasi singkat
        +-- Melihat carousel informasi
        +-- Membaca mitos vs fakta
        +-- Membuka /edukasi
        +-- Membuka modal login
                |
                v
          Login berhasil
                |
                v
          Dashboard sesuai role
"""
        ),
        Paragraph("5. Kesimpulan", s["Section"]),
        Paragraph(
            "Aplikasi sudah memiliki tampilan portal depan yang berisi konten edukasi sebelum login. Halaman /login hanya untuk autentikasi, sedangkan dashboard edukasi publik berada pada route / dan /edukasi.",
            s["Small"],
        ),
    ]

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
