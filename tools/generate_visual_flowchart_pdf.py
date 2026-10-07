from math import atan2, cos, sin, pi
from pathlib import Path
import textwrap

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "flowchart-visual-sehaticare-penguji.pdf"

PAGE_W, PAGE_H = landscape(A4)
MARGIN = 34
ACCENT = colors.HexColor("#0F766E")
TEXT = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#475569")
BORDER = colors.HexColor("#334155")
FILL = colors.HexColor("#F8FAFC")
DECISION_FILL = colors.HexColor("#ECFDF5")
IO_FILL = colors.HexColor("#EFF6FF")
DB_FILL = colors.HexColor("#FFF7ED")
WARN_FILL = colors.HexColor("#FFFBEB")


def wrap_lines(c, text, max_width, font="Helvetica", size=8):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines[:5]


def centered_text(c, x, y, w, h, text, size=8, color=TEXT):
    c.setFillColor(color)
    c.setFont("Helvetica", size)
    lines = wrap_lines(c, text, w - 14, size=size)
    total_h = len(lines) * (size + 2)
    ty = y + h / 2 + total_h / 2 - size
    for line in lines:
        c.drawCentredString(x + w / 2, ty, line)
        ty -= size + 2


def title(c, text, subtitle=None):
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(MARGIN, PAGE_H - 30, text)
    if subtitle:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8.5)
        c.drawString(MARGIN, PAGE_H - 45, subtitle)
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.line(MARGIN, PAGE_H - 55, PAGE_W - MARGIN, PAGE_H - 55)


def footer(c, page_no):
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 18, "SEHATiCare - Flowchart Visual Berdasarkan Masukan Penguji")
    c.drawRightString(PAGE_W - MARGIN, 18, f"Halaman {page_no}")


def box(c, x, y, w, h, text, kind="process", size=8):
    c.setStrokeColor(BORDER)
    fill = FILL
    if kind == "terminator":
        fill = colors.HexColor("#E0F2FE")
        c.setFillColor(fill)
        c.roundRect(x, y, w, h, h / 2, stroke=1, fill=1)
    elif kind == "process":
        c.setFillColor(fill)
        c.roundRect(x, y, w, h, 6, stroke=1, fill=1)
    elif kind == "io":
        fill = IO_FILL
        c.setFillColor(fill)
        skew = 14
        p = c.beginPath()
        p.moveTo(x + skew, y)
        p.lineTo(x + w, y)
        p.lineTo(x + w - skew, y + h)
        p.lineTo(x, y + h)
        p.close()
        c.drawPath(p, stroke=1, fill=1)
    elif kind == "decision":
        fill = DECISION_FILL
        c.setFillColor(fill)
        p = c.beginPath()
        p.moveTo(x + w / 2, y + h)
        p.lineTo(x + w, y + h / 2)
        p.lineTo(x + w / 2, y)
        p.lineTo(x, y + h / 2)
        p.close()
        c.drawPath(p, stroke=1, fill=1)
    elif kind == "db":
        fill = DB_FILL
        c.setFillColor(fill)
        c.roundRect(x, y, w, h, 5, stroke=1, fill=1)
        c.ellipse(x, y + h - 12, x + w, y + h + 4, stroke=1, fill=0)
        c.arc(x, y - 4, x + w, y + 12, 180, 180)
    elif kind == "warning":
        fill = WARN_FILL
        c.setFillColor(fill)
        c.roundRect(x, y, w, h, 6, stroke=1, fill=1)
    centered_text(c, x, y, w, h, text, size=size)


def arrow(c, x1, y1, x2, y2, label=None):
    c.setStrokeColor(BORDER)
    c.setFillColor(BORDER)
    c.setLineWidth(1)
    c.line(x1, y1, x2, y2)
    angle = atan2(y2 - y1, x2 - x1)
    size = 6
    p1 = (x2 - size * cos(angle - pi / 6), y2 - size * sin(angle - pi / 6))
    p2 = (x2 - size * cos(angle + pi / 6), y2 - size * sin(angle + pi / 6))
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(*p1)
    path.lineTo(*p2)
    path.close()
    c.drawPath(path, stroke=1, fill=1)
    if label:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.2)
        c.drawCentredString((x1 + x2) / 2, (y1 + y2) / 2 + 4, label)


def elbow(c, points, label=None):
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        if i == len(points) - 2:
            arrow(c, x1, y1, x2, y2, label if i == 0 else None)
        else:
            c.setStrokeColor(BORDER)
            c.line(x1, y1, x2, y2)
            if label and i == 0:
                c.setFillColor(MUTED)
                c.setFont("Helvetica", 7.2)
                c.drawCentredString((x1 + x2) / 2, (y1 + y2) / 2 + 4, label)


def legend(c):
    y = PAGE_H - 90
    x = MARGIN
    items = [
        ("Mulai/Selesai", "terminator"),
        ("Proses", "process"),
        ("Keputusan", "decision"),
        ("Input/Output", "io"),
        ("Database", "db"),
    ]
    for label, kind in items:
        box(c, x, y, 92, 34, label, kind, size=7.3)
        x += 112


def page_main(c):
    title(c, "1. Flowchart Utama Sistem SEHATiCare", "Alur dari portal publik menuju dashboard sesuai role.")
    legend(c)
    x = PAGE_W / 2 - 70
    y = PAGE_H - 155
    w, h = 140, 34
    box(c, x, y, w, h, "Mulai: user membuka aplikasi", "terminator")
    box(c, x, y - 58, w, h, "Tampilkan portal publik", "process")
    box(c, x - 10, y - 128, w + 20, 52, "User memilih aksi?", "decision")
    arrow(c, x + w / 2, y, x + w / 2, y - 24)
    arrow(c, x + w / 2, y - 58, x + w / 2, y - 76)
    box(c, 80, y - 205, 135, 42, "Baca edukasi / konten publik", "process")
    box(c, 330, y - 205, 135, 42, "Login / registrasi", "process")
    box(c, 580, y - 205, 135, 42, "Keluar aplikasi", "terminator")
    elbow(c, [(x + 10, y - 102), (147, y - 102), (147, y - 163)], "Edukasi")
    elbow(c, [(x + w / 2, y - 128), (x + w / 2, y - 163)], "Login")
    elbow(c, [(x + w + 10, y - 102), (647, y - 102), (647, y - 163)], "Keluar")
    box(c, 330, y - 270, 135, 46, "Validasi akun dan kredensial", "process")
    box(c, 325, y - 348, 145, 58, "Autentikasi berhasil?", "decision")
    arrow(c, 397, y - 205, 397, y - 224)
    arrow(c, 397, y - 270, 397, y - 290)
    box(c, 130, y - 360, 135, 42, "Tampilkan pesan gagal dan ulangi", "process")
    box(c, 535, y - 360, 135, 42, "Baca role user", "process")
    elbow(c, [(325, y - 319), (265, y - 319)], "Tidak")
    elbow(c, [(470, y - 319), (535, y - 319)], "Ya")
    box(c, 110, 58, 115, 36, "Dashboard Pasien", "process")
    box(c, 260, 58, 115, 36, "Dashboard Dokter", "process")
    box(c, 410, 58, 115, 36, "Dashboard Admin", "process")
    box(c, 560, 58, 140, 36, "Dashboard rancangan aktor lain", "warning", size=7.2)
    yrole = y - 360
    arrow(c, 603, yrole, 603, 106)
    elbow(c, [(603, 106), (167, 106), (167, 94)], "PASIEN")
    elbow(c, [(603, 106), (317, 106), (317, 94)], "DOKTER")
    elbow(c, [(603, 106), (467, 106), (467, 94)], "ADMIN")
    arrow(c, 603, 106, 630, 94, "Lainnya")


def page_landing_login(c):
    title(c, "2. Flowchart Landing Page dan Login", "Menjelaskan akses konten edukasi, modal login, dan kegagalan autentikasi.")
    x = 80
    y = PAGE_H - 92
    box(c, x, y, 135, 34, "Mulai: akses /", "terminator")
    box(c, x, y - 58, 135, 40, "Tampilkan landing page edukasi", "process")
    box(c, x, y - 130, 135, 52, "Pilih aksi?", "decision")
    arrow(c, x + 67, y, x + 67, y - 18)
    arrow(c, x + 67, y - 58, x + 67, y - 78)
    box(c, 45, y - 215, 130, 42, "Buka /edukasi dan tampilkan materi", "process")
    box(c, 235, y - 215, 130, 42, "Buka modal login atau /login", "process")
    box(c, 425, y - 215, 130, 42, "Buka form registrasi", "process")
    elbow(c, [(x + 22, y - 104), (110, y - 104), (110, y - 173)], "Baca")
    elbow(c, [(x + 68, y - 130), (300, y - 130), (300, y - 173)], "Login")
    elbow(c, [(x + 112, y - 104), (490, y - 104), (490, y - 173)], "Daftar")
    box(c, 235, y - 285, 130, 42, "Input email dan password", "io")
    box(c, 235, y - 350, 130, 42, "Cek user dan password_hash", "db")
    box(c, 230, y - 430, 140, 58, "Login valid?", "decision")
    arrow(c, 300, y - 215, 300, y - 243)
    arrow(c, 300, y - 285, 300, y - 308)
    arrow(c, 300, y - 350, 300, y - 372)
    box(c, 50, y - 445, 140, 45, "Pesan: email/password salah atau akun belum aktif", "process", size=7.2)
    box(c, 455, y - 445, 140, 45, "Generate token dan redirect dashboard", "process", size=7.2)
    elbow(c, [(230, y - 401), (190, y - 401)], "Tidak")
    elbow(c, [(370, y - 401), (455, y - 401)], "Ya")
    box(c, 635, y - 215, 125, 42, "Connector ke flow registrasi OTP", "warning", size=7.2)
    arrow(c, 555, y - 194, 635, y - 194)
    box(c, 455, 45, 140, 34, "Selesai", "terminator")
    arrow(c, 525, y - 445, 525, 79)


def page_registration(c):
    title(c, "3. Flowchart Registrasi dan Verifikasi OTP", "Mencakup kondisi gagal: data salah, sudah terdaftar, OTP tidak diterima, OTP kedaluwarsa.")
    x = 90
    ys = [500, 445, 390, 335, 280, 225, 170, 115, 60]
    labels = [
        ("Mulai registrasi", "terminator"),
        ("Input nama, email/nomor HP, password", "io"),
        ("Validasi format input", "process"),
        ("Input valid?", "decision"),
        ("Cek email/nomor di database users", "db"),
        ("Sudah terdaftar?", "decision"),
        ("Buat akun belum verified dan OTP", "process"),
        ("Kirim OTP", "process"),
        ("User input OTP", "io"),
    ]
    for y, (text, kind) in zip(ys, labels):
        h = 46 if kind == "decision" else 34
        box(c, x, y, 170, h, text, kind, size=7.5)
    for i in range(len(ys) - 1):
        y1 = ys[i]
        y2 = ys[i + 1] + (46 if labels[i + 1][1] == "decision" else 34)
        arrow(c, x + 85, y1, x + 85, y2)
    box(c, 330, 335, 145, 40, "Tampilkan error input dan minta perbaiki", "process", size=7.3)
    elbow(c, [(260, 358), (330, 358)], "Tidak")
    box(c, 330, 225, 145, 40, "Tampilkan pesan akun sudah terdaftar", "process", size=7.3)
    elbow(c, [(260, 248), (330, 248)], "Ya")
    box(c, 330, 170, 145, 40, "OTP tidak diterima: kirim ulang", "process", size=7.3)
    elbow(c, [(260, 242), (300, 242), (300, 190), (330, 190)], "Tidak diterima")
    box(c, 555, 170, 150, 52, "OTP valid dan belum kedaluwarsa?", "decision", size=7.1)
    arrow(c, x + 170, 77, 555, 196)
    box(c, 555, 90, 150, 42, "Aktifkan akun dan buat token", "process", size=7.3)
    box(c, 555, 35, 150, 34, "Redirect dashboard", "terminator", size=7.3)
    arrow(c, 630, 170, 630, 132, "Ya")
    arrow(c, 630, 90, 630, 69)
    box(c, 700, 245, 105, 50, "OTP salah / kedaluwarsa: tampilkan error", "process", size=7.0)
    elbow(c, [(705, 196), (752, 196), (752, 245)], "Tidak")


def page_patient_ai(c):
    title(c, "4. Flowchart Pasien dan Penjawab Otomatis AI", "Alur konsultasi pasien, consent, red-flag, AI, dan eskalasi.")
    x = 55
    box(c, x, 500, 140, 34, "Mulai: dashboard pasien", "terminator")
    box(c, x, 445, 140, 48, "Ada konsultasi aktif?", "decision")
    arrow(c, x + 70, 500, x + 70, 493)
    box(c, 20, 365, 140, 40, "Isi keluhan awal", "io")
    box(c, 190, 365, 145, 40, "Buka detail konsultasi", "process")
    elbow(c, [(55, 469), (90, 405)], "Tidak")
    elbow(c, [(195, 469), (263, 405)], "Ya")
    arrow(c, 160, 385, 190, 385)
    box(c, 190, 305, 145, 48, "Consent diberikan?", "decision")
    arrow(c, 263, 365, 263, 353)
    box(c, 20, 285, 140, 40, "Minta persetujuan sebelum chat", "process", size=7.2)
    elbow(c, [(190, 329), (160, 329)], "Tidak")
    box(c, 190, 235, 145, 40, "Input pesan / voice note", "io")
    arrow(c, 263, 305, 263, 275, "Ya")
    box(c, 190, 175, 145, 48, "Dokter sudah ambil?", "decision")
    arrow(c, 263, 235, 263, 223)
    box(c, 20, 95, 140, 40, "Chat dengan dokter", "process")
    box(c, 20, 40, 140, 34, "Konsultasi selesai", "terminator")
    elbow(c, [(190, 199), (90, 199), (90, 135)], "Ya")
    arrow(c, 90, 95, 90, 74)

    box(c, 425, 495, 145, 40, "AI menerima pertanyaan", "process")
    box(c, 425, 435, 145, 48, "Red-flag terdeteksi?", "decision", size=7.2)
    box(c, 620, 425, 150, 48, "Set prioritas tinggi dan eskalasi tenaga kesehatan", "process", size=7.0)
    box(c, 425, 365, 145, 40, "Ambil konteks dan basis pengetahuan", "db", size=7.0)
    box(c, 425, 305, 145, 40, "AI memproses jawaban", "process")
    box(c, 425, 235, 145, 48, "AI mampu menjawab?", "decision", size=7.2)
    box(c, 425, 165, 145, 40, "Simpan dan tampilkan respons AI", "process", size=7.0)
    box(c, 620, 225, 150, 48, "Eskalasi ke dokter / petugas kesehatan", "process", size=7.0)
    box(c, 425, 95, 145, 34, "Selesai / lanjut chat", "terminator")
    elbow(c, [(335, 199), (425, 515)], "Tidak")
    arrow(c, 498, 495, 498, 483)
    elbow(c, [(570, 459), (620, 449)], "Ya")
    arrow(c, 498, 435, 498, 405, "Tidak")
    arrow(c, 498, 365, 498, 345)
    arrow(c, 498, 305, 498, 283)
    arrow(c, 498, 235, 498, 205, "Ya")
    arrow(c, 498, 165, 498, 129)
    elbow(c, [(570, 259), (620, 249)], "Tidak")


def page_doctor_admin(c):
    title(c, "5. Flowchart Dokter dan Admin", "Alur dokter terverifikasi, antrean konsultasi, penyelesaian, dan kontrol admin.")
    box(c, 45, 500, 135, 34, "Mulai dokter login", "terminator")
    box(c, 45, 445, 135, 48, "Dokter VERIFIED?", "decision")
    arrow(c, 112, 500, 112, 493)
    box(c, 25, 365, 135, 40, "Tolak akses antrean", "process")
    box(c, 210, 365, 135, 40, "Tampilkan antrean", "process")
    elbow(c, [(45, 469), (92, 405)], "Tidak")
    elbow(c, [(180, 469), (278, 405)], "Ya")
    box(c, 210, 305, 135, 40, "Claim konsultasi", "process")
    arrow(c, 278, 365, 278, 345)
    box(c, 210, 235, 135, 48, "Claim berhasil?", "decision")
    arrow(c, 278, 305, 278, 283)
    box(c, 35, 225, 135, 45, "Pesan: sudah diambil dokter lain", "process", size=7.1)
    elbow(c, [(210, 259), (170, 259)], "Tidak")
    box(c, 210, 160, 135, 40, "Chat pasien / voice note", "process")
    arrow(c, 278, 235, 278, 200, "Ya")
    box(c, 210, 95, 135, 40, "Selesaikan konsultasi", "process")
    box(c, 210, 40, 135, 34, "Status SELESAI", "terminator")
    arrow(c, 278, 160, 278, 135)
    arrow(c, 278, 95, 278, 74)

    box(c, 500, 500, 135, 34, "Mulai admin login", "terminator")
    box(c, 500, 445, 135, 40, "Dashboard admin", "process")
    arrow(c, 567, 500, 567, 485)
    box(c, 420, 360, 135, 45, "Verifikasi dokter", "process")
    box(c, 585, 360, 135, 45, "Monitoring konsultasi", "process")
    elbow(c, [(567, 445), (487, 405)])
    elbow(c, [(567, 445), (652, 405)])
    box(c, 420, 290, 135, 40, "Update doctor_profile", "db", size=7.1)
    box(c, 585, 290, 135, 48, "Perlu force close?", "decision", size=7.1)
    arrow(c, 487, 360, 487, 330)
    arrow(c, 652, 360, 652, 338)
    box(c, 585, 220, 135, 40, "Force close konsultasi", "process", size=7.1)
    box(c, 420, 160, 300, 40, "Simpan audit log / audit event", "db")
    arrow(c, 652, 290, 652, 260, "Ya")
    arrow(c, 652, 220, 652, 200)
    arrow(c, 487, 290, 487, 200)
    box(c, 500, 90, 135, 34, "Selesai admin", "terminator")
    arrow(c, 570, 160, 570, 124)


def page_roles_gap(c):
    title(c, "6. Flowchart Aktor Pengembangan dan Catatan Gap", "Pendamping, petugas kesehatan, dan penjangkau perlu dipastikan role dan hak aksesnya.")
    box(c, 70, 500, 150, 34, "Mulai aktor login", "terminator")
    box(c, 70, 435, 150, 54, "Role tersedia di backend?", "decision")
    arrow(c, 145, 500, 145, 489)
    box(c, 300, 445, 165, 40, "Masuk dashboard sesuai role", "process")
    elbow(c, [(220, 462), (300, 465)], "Ya")
    box(c, 300, 360, 165, 55, "Pendamping: tugas, pasien, red-flag, edukasi, rujukan", "warning", size=7.0)
    box(c, 520, 360, 165, 55, "Petugas kesehatan: menerima eskalasi AI dan monitoring", "warning", size=7.0)
    box(c, 300, 270, 165, 55, "Penjangkau: outreach, follow-up, pendampingan komunitas", "warning", size=7.0)
    box(c, 520, 270, 165, 55, "Semua aksi masuk audit log", "db", size=7.0)
    arrow(c, 382, 445, 382, 415)
    elbow(c, [(382, 360), (382, 325)])
    elbow(c, [(465, 388), (520, 388)])
    elbow(c, [(465, 297), (520, 297)])
    box(c, 70, 320, 150, 55, "Tandai sebagai rancangan dan tambah definisi role", "process", size=7.0)
    arrow(c, 145, 435, 145, 375, "Tidak")
    box(c, 300, 165, 385, 65, "Rekomendasi: tambahkan role backend, endpoint, hak akses, notifikasi eskalasi, dan audit untuk aktor baru.", "process", size=7.4)
    arrow(c, 492, 270, 492, 230)
    box(c, 420, 90, 150, 34, "Selesai", "terminator")
    arrow(c, 492, 165, 492, 124)


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=landscape(A4))
    pages = [page_main, page_landing_login, page_registration, page_patient_ai, page_doctor_admin, page_roles_gap]
    for i, page in enumerate(pages, start=1):
        page(c)
        footer(c, i)
        c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
