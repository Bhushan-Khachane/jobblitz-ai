from __future__ import annotations

from pathlib import Path

import pdfplumber
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def parse_pdf(file_path: str | Path) -> str:
    """Extract text from a PDF file."""
    text_parts: list[str] = []
    with pdfplumber.open(str(file_path)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def generate_tailored_pdf(text: str, output_path: str | Path) -> str:
    """Generate a clean PDF from tailored resume text and return the path."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    heading_style = ParagraphStyle(
        "ResumeHeading",
        parent=styles["Heading2"],
        fontSize=13,
        spaceAfter=6,
        spaceBefore=10,
        textColor="#1a1a1a",
    )
    body_style = ParagraphStyle(
        "ResumeBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        spaceAfter=4,
    )

    story: list = []
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            story.append(Spacer(1, 6))
            continue
        # Heuristic: lines that are all-caps or start with special chars are headings
        if line.isupper() or (len(line) < 80 and line.endswith(":")) or line.startswith("#"):
            clean = line.lstrip("#").strip().rstrip(":")
            story.append(Paragraph(clean, heading_style))
        else:
            safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(safe, body_style))

    doc.build(story)
    return str(output_path)


def pdf_to_text(file_path: str | Path) -> str:
    """Alias for parse_pdf for clarity."""
    return parse_pdf(file_path)
