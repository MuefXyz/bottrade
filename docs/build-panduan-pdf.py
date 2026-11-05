#!/usr/bin/env python3
"""Build the PumpHunter user guide PDF from docs/panduan-penggunaan.md.

Requires reportlab:
    python3 -m venv /tmp/pdfvenv
    /tmp/pdfvenv/bin/pip install reportlab
    /tmp/pdfvenv/bin/python docs/build-panduan-pdf.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "panduan-penggunaan.md"
OUTPUT = ROOT / "Panduan-Penggunaan-PumpHunter-Bot.pdf"

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
ACCENT = colors.HexColor("#1f3b73")
MUTED = colors.HexColor("#5b6472")
LIGHT = colors.HexColor("#eef2f8")
BORDER = colors.HexColor("#c9d3e0")

PAGE_W, PAGE_H = A4
MARGIN_X = 20 * mm
MARGIN_TOP = 20 * mm
MARGIN_BOTTOM = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("DejaVu", FONT_DIR / "DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_DIR / "DejaVuSans-Bold.ttf"))
    pdfmetrics.registerFont(TTFont("DejaVuMono", FONT_DIR / "DejaVuSansMono.ttf"))
    pdfmetrics.registerFontFamily(
        "DejaVu",
        normal="DejaVu",
        bold="DejaVu-Bold",
        italic="DejaVu",
        boldItalic="DejaVu-Bold",
    )


def build_styles() -> dict[str, ParagraphStyle]:
    base = ParagraphStyle(
        "Body",
        fontName="DejaVu",
        fontSize=10.2,
        leading=15,
        textColor=colors.HexColor("#1c2430"),
        alignment=TA_LEFT,
        spaceAfter=6,
    )
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base,
            fontName="DejaVu-Bold",
            fontSize=23,
            leading=29,
            textColor=ACCENT,
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base,
            fontSize=10.5,
            leading=15,
            textColor=MUTED,
            spaceAfter=14,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base,
            fontName="DejaVu-Bold",
            fontSize=15,
            leading=20,
            textColor=ACCENT,
            spaceBefore=14,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base,
            fontName="DejaVu-Bold",
            fontSize=11.8,
            leading=16,
            textColor=colors.HexColor("#2b4a7d"),
            spaceBefore=10,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "body": base,
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base,
            leftIndent=14,
            bulletIndent=4,
            spaceAfter=3,
        ),
        "bullet2": ParagraphStyle(
            "Bullet2",
            parent=base,
            leftIndent=32,
            bulletIndent=18,
            spaceAfter=3,
        ),
        "number": ParagraphStyle(
            "Number",
            parent=base,
            leftIndent=18,
            bulletIndent=4,
            spaceAfter=3,
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=base,
            fontSize=8.8,
            leading=12.5,
            spaceAfter=0,
        ),
        "head": ParagraphStyle(
            "Head",
            parent=base,
            fontName="DejaVu-Bold",
            fontSize=8.8,
            leading=12.5,
            textColor=colors.white,
            spaceAfter=0,
        ),
    }


def inline(text: str) -> str:
    """Convert a small subset of Markdown inline formatting to ReportLab markup."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(
        r"`([^`]+)`",
        r'<font name="DejaVuMono" size="9">\1</font>',
        text,
    )
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def column_widths(rows: list[list[str]]) -> list[float]:
    cols = max(len(row) for row in rows)
    weights = []
    for index in range(cols):
        longest = max((len(row[index]) if index < len(row) else 0) for row in rows)
        weights.append(max(10, min(longest, 46)))

    total = sum(weights)
    return [CONTENT_W * weight / total for weight in weights]


def build_table(rows: list[list[str]], styles: dict[str, ParagraphStyle]) -> Table:
    header, *body = rows
    data = [
        [Paragraph(inline(cell), styles["head"]) for cell in header],
        *[
            [Paragraph(inline(cell), styles["cell"]) for cell in row]
            for row in body
        ],
    ]

    table = Table(data, colWidths=column_widths(rows), repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def parse_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def is_separator_row(line: str) -> bool:
    cells = parse_table_row(line)
    return all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def build_story(markdown: str, styles: dict[str, ParagraphStyle]) -> list:
    story: list = []
    paragraph: list[str] = []
    table_rows: list[list[str]] = []
    number = 0

    def flush_paragraph() -> None:
        nonlocal paragraph
        if not paragraph:
            return
        story.append(Paragraph(inline(" ".join(paragraph)), styles["body"]))
        paragraph = []

    def flush_table() -> None:
        nonlocal table_rows
        if not table_rows:
            return
        story.append(Spacer(1, 4))
        story.append(build_table(table_rows, styles))
        story.append(Spacer(1, 8))
        table_rows = []

    for raw in markdown.splitlines():
        line = raw.rstrip()

        if line.startswith("|"):
            flush_paragraph()
            if not is_separator_row(line):
                table_rows.append(parse_table_row(line))
            continue

        flush_table()

        if not line.strip():
            flush_paragraph()
            number = 0
            continue

        if line.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline(line[4:]), styles["h2"]))
            continue

        if line.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(inline(line[3:]), styles["h1"]))
            continue

        if line.startswith("# "):
            flush_paragraph()
            story.append(Paragraph(inline(line[2:]), styles["title"]))
            continue

        bullet = re.match(r"^(\s*)[-*] (.+)$", line)
        if bullet:
            flush_paragraph()
            nested = len(bullet.group(1)) >= 2
            story.append(
                Paragraph(
                    inline(bullet.group(2)),
                    styles["bullet2" if nested else "bullet"],
                    bulletText="\u2022",
                )
            )
            continue

        numbered = re.match(r"^(\s*)\d+\. (.+)$", line)
        if numbered:
            flush_paragraph()
            number += 1
            story.append(
                Paragraph(
                    inline(numbered.group(2)),
                    styles["number"],
                    bulletText=f"{number}.",
                )
            )
            continue

        paragraph.append(line.strip())

    flush_paragraph()
    flush_table()
    return story


def add_cover(story: list, styles: dict[str, ParagraphStyle]) -> None:
    story.insert(
        1,
        HRFlowable(
            width="100%",
            thickness=1,
            color=BORDER,
            spaceBefore=0,
            spaceAfter=10,
        ),
    )
    story.insert(
        1,
        Paragraph(
            "Dokumen ini menjelaskan cara memakai seluruh fitur bot, mulai dari "
            "membuat wallet, mengatur parameter trading, menjalankan Scanner Token, "
            "copy-trade lewat Scanning Wallet, sampai menutup posisi.",
            styles["subtitle"],
        ),
    )


def on_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("DejaVu", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN_X, PAGE_H - 12 * mm, "PumpHunter Wallet Bot")
    canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 12 * mm, "Panduan Penggunaan")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_X, PAGE_H - 14 * mm, PAGE_W - MARGIN_X, PAGE_H - 14 * mm)
    canvas.drawCentredString(PAGE_W / 2, 10 * mm, f"Halaman {doc.page}")
    canvas.restoreState()


def main() -> int:
    if not SOURCE.exists():
        print(f"Source not found: {SOURCE}", file=sys.stderr)
        return 1

    output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else OUTPUT

    register_fonts()
    styles = build_styles()
    story = build_story(SOURCE.read_text(encoding="utf-8"), styles)
    add_cover(story, styles)

    doc = BaseDocTemplate(
        str(output),
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title="Panduan Penggunaan PumpHunter Wallet Bot",
        author="PumpHunter Wallet Bot",
        subject="Panduan penggunaan bot Telegram PumpHunter",
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="content",
    )
    doc.addPageTemplates(
        [PageTemplate(id="main", frames=[frame], onPage=on_page)]
    )
    doc.build(story)

    print(f"PDF dibuat: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
