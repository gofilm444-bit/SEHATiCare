from pathlib import Path
from math import atan2, cos, sin, pi

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "flowcharts"
PNG_OUT = OUT_DIR / "flow-utama-iso-style.png"

W, H = 1800, 1650
BG = "white"
TEXT = "#111827"
BORDER = "#1f2937"
MUTED = "#475569"
PROCESS = "#f8fafc"
TERMINATOR = "#e0f2fe"
DECISION = "#ecfdf5"
CONNECTOR = "#fef3c7"


def font(size=30, bold=False):
    paths = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf",
    ]
    for path in paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


FONT = font(30)
FONT_SMALL = font(24)
FONT_TITLE = font(42, True)
FONT_BOLD = font(34, True)


def wrap(draw, text, max_width, fnt):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        bbox = draw.textbbox((0, 0), trial, font=fnt)
        if bbox[2] - bbox[0] <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def text_center(draw, box, text, fnt=FONT):
    x, y, w, h = box
    lines = wrap(draw, text, w - 28, fnt)
    lh = fnt.size + 6
    total = lh * len(lines)
    ty = y + (h - total) / 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=fnt)
        tw = bbox[2] - bbox[0]
        draw.text((x + (w - tw) / 2, ty), line, fill=TEXT, font=fnt)
        ty += lh


def process(draw, box, text, fill=PROCESS, fnt=FONT):
    x, y, w, h = box
    draw.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=fill, outline=BORDER, width=3)
    text_center(draw, box, text, fnt)


def terminator(draw, box, text):
    x, y, w, h = box
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=TERMINATOR, outline=BORDER, width=3)
    text_center(draw, box, text)


def decision(draw, box, text):
    x, y, w, h = box
    pts = [(x + w / 2, y), (x + w, y + h / 2), (x + w / 2, y + h), (x, y + h / 2)]
    draw.polygon(pts, fill=DECISION, outline=BORDER)
    draw.line(pts + [pts[0]], fill=BORDER, width=3)
    text_center(draw, box, text)


def connector(draw, box, text):
    x, y, w, h = box
    draw.ellipse([x, y, x + w, y + h], fill=CONNECTOR, outline=BORDER, width=3)
    text_center(draw, box, text, FONT_BOLD)


def point(box, side):
    x, y, w, h = box
    return {
        "top": (x + w / 2, y),
        "bottom": (x + w / 2, y + h),
        "left": (x, y + h / 2),
        "right": (x + w, y + h / 2),
    }[side]


def arrow_head(draw, a, b):
    x1, y1 = a
    x2, y2 = b
    angle = atan2(y2 - y1, x2 - x1)
    size = 15
    p1 = (x2 - size * cos(angle - pi / 6), y2 - size * sin(angle - pi / 6))
    p2 = (x2 - size * cos(angle + pi / 6), y2 - size * sin(angle + pi / 6))
    draw.polygon([(x2, y2), p1, p2], fill=BORDER)


def label(draw, pos, text):
    x, y = pos
    bbox = draw.textbbox((0, 0), text, font=FONT_SMALL)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.rounded_rectangle([x - tw / 2 - 8, y - th / 2 - 5, x + tw / 2 + 8, y + th / 2 + 5], radius=4, fill="white")
    draw.text((x - tw / 2, y - th / 2 - 1), text, fill=TEXT, font=FONT_SMALL)


def arrow(draw, pts, text=None, text_at=None):
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=BORDER, width=3)
    arrow_head(draw, pts[-2], pts[-1])
    if text:
        if text_at is None:
            x1, y1 = pts[0]
            x2, y2 = pts[1]
            text_at = ((x1 + x2) / 2, (y1 + y2) / 2)
        label(draw, text_at, text)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    draw.text((70, 45), "Flowchart Utama Sistem SEHATiCare", fill=TEXT, font=FONT_TITLE)
    draw.text((70, 98), "Versi ringkas untuk menghubungkan portal publik, login, registrasi, dan dashboard.", fill=MUTED, font=FONT_SMALL)
    draw.line([(70, 135), (W - 70, 135)], fill="#cbd5e1", width=3)

    n = {
        "start": (760, 170, 280, 70),
        "open": (690, 285, 420, 95),
        "page": (670, 445, 460, 150),
        "landing": (170, 640, 390, 95),
        "action": (180, 805, 370, 145),
        "edu": (80, 1060, 340, 95),
        "end_edu": (110, 1215, 280, 70),
        "login_c": (760, 670, 90, 90),
        "login": (690, 825, 330, 90),
        "login_ok": (675, 985, 360, 145),
        "error": (1080, 1015, 330, 90),
        "role": (675, 1200, 360, 145),
        "dash": (690, 1410, 330, 90),
        "end_dash": (715, 1545, 280, 70),
        "reg_c": (1370, 670, 90, 90),
        "reg": (1260, 825, 330, 90),
        "otp": (1260, 990, 330, 90),
        "end_reg": (1285, 1145, 280, 70),
    }

    terminator(draw, n["start"], "Mulai")
    process(draw, n["open"], "User membuka aplikasi SEHATiCare")
    decision(draw, n["page"], "Halaman yang diakses?")
    process(draw, n["landing"], "Tampilkan landing page edukasi")
    decision(draw, n["action"], "Aksi user?")
    process(draw, n["edu"], "Tampilkan halaman edukasi publik")
    terminator(draw, n["end_edu"], "Selesai edukasi")
    connector(draw, n["login_c"], "L")
    process(draw, n["login"], "Masuk ke proses login")
    decision(draw, n["login_ok"], "Login berhasil?")
    process(draw, n["error"], "Tampilkan pesan gagal dan opsi ulang", fnt=FONT_SMALL)
    decision(draw, n["role"], "Role user?")
    process(draw, n["dash"], "Redirect ke dashboard sesuai role")
    terminator(draw, n["end_dash"], "Selesai dashboard")
    connector(draw, n["reg_c"], "R")
    process(draw, n["reg"], "Masuk ke proses registrasi")
    process(draw, n["otp"], "Lanjut ke flow Registrasi dan OTP", fnt=FONT_SMALL)
    terminator(draw, n["end_reg"], "Selesai registrasi")

    arrow(draw, [point(n["start"], "bottom"), point(n["open"], "top")])
    arrow(draw, [point(n["open"], "bottom"), point(n["page"], "top")])

    arrow(draw, [point(n["page"], "left"), (365, 520), (365, 640)], "Portal publik", (340, 520))
    arrow(draw, [point(n["page"], "bottom"), point(n["login_c"], "top")], "Login langsung", (815, 635))
    arrow(draw, [point(n["page"], "right"), (1415, 520), (1415, 670)], "Registrasi langsung", (1420, 520))

    arrow(draw, [point(n["landing"], "bottom"), point(n["action"], "top")])
    arrow(draw, [point(n["action"], "left"), (250, 1010), (250, 1060)], "Baca edukasi", (235, 1010))
    arrow(draw, [point(n["edu"], "bottom"), point(n["end_edu"], "top")])
    arrow(draw, [point(n["action"], "right"), (805, 878), point(n["login_c"], "bottom")], "Login", (620, 875))
    arrow(draw, [(550, 905), (1415, 905), point(n["reg_c"], "bottom")], "Registrasi", (1265, 905))
    arrow(draw, [(365, 950), (365, 1285), (675, 1285)], "Keluar", (365, 980))

    arrow(draw, [point(n["login_c"], "bottom"), point(n["login"], "top")])
    arrow(draw, [point(n["login"], "bottom"), point(n["login_ok"], "top")])
    arrow(draw, [point(n["login_ok"], "right"), point(n["error"], "left")], "Tidak", (1055, 1058))
    arrow(draw, [point(n["error"], "top"), (1245, 950), (855, 950), point(n["login"], "bottom")])
    arrow(draw, [point(n["login_ok"], "bottom"), point(n["role"], "top")], "Ya", (855, 1160))
    arrow(draw, [point(n["role"], "bottom"), point(n["dash"], "top")])
    arrow(draw, [point(n["dash"], "bottom"), point(n["end_dash"], "top")])

    arrow(draw, [point(n["reg_c"], "bottom"), point(n["reg"], "top")])
    arrow(draw, [point(n["reg"], "bottom"), point(n["otp"], "top")])
    arrow(draw, [point(n["otp"], "bottom"), point(n["end_reg"], "top")])

    # Explanation box
    x, y = 70, 1420
    draw.rounded_rectangle([x, y, x + 500, y + 140], radius=12, fill="#f8fafc", outline="#cbd5e1", width=2)
    draw.text((x + 24, y + 18), "Keterangan", fill=TEXT, font=font(28, True))
    draw.text((x + 24, y + 55), "L = connector ke sub-flow Login", fill=TEXT, font=FONT_SMALL)
    draw.text((x + 24, y + 88), "R = connector ke sub-flow Registrasi/OTP", fill=TEXT, font=FONT_SMALL)
    draw.text((x + 24, y + 121), "Detail role dijabarkan pada flow terpisah.", fill=TEXT, font=FONT_SMALL)

    img.save(PNG_OUT)
    print(PNG_OUT)


if __name__ == "__main__":
    main()
