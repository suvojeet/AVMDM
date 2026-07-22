# -*- coding: utf-8 -*-
"""
Convert USPTO_PATENT_APPLICATION.docx to USPTO_PATENT_APPLICATION.pdf
Overwrites the existing PDF every time it runs.

Requirements (Windows):
  Microsoft Word must be installed (uses Word COM interface via pywin32).
  pywin32 is already installed as a dependency of docx2pdf.
"""

import sys
import comtypes.client
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
DOCX_PATH  = SCRIPT_DIR / "USPTO_PATENT_APPLICATION.docx"
PDF_PATH   = SCRIPT_DIR / "USPTO_PATENT_APPLICATION.pdf"

WD_FORMAT_PDF = 17


def convert_with_word_com():
    print("[convert_to_pdf] Opening Word via COM ...")
    word = comtypes.client.CreateObject("Word.Application")
    word.Visible = False
    try:
        doc = word.Documents.Open(str(DOCX_PATH))
        print("[convert_to_pdf] Exporting to PDF ...")
        doc.SaveAs(str(PDF_PATH), FileFormat=WD_FORMAT_PDF)
        doc.Close()
        print("[convert_to_pdf] Done - PDF written to: " + str(PDF_PATH))
    finally:
        word.Quit()


if __name__ == "__main__":
    if not DOCX_PATH.exists():
        print("[convert_to_pdf] ERROR: DOCX not found at " + str(DOCX_PATH))
        print("[convert_to_pdf] Run build_docx_with_figures.py first.")
        sys.exit(1)

    try:
        convert_with_word_com()
    except Exception as e:
        print("[convert_to_pdf] ERROR: " + str(e))
        print("[convert_to_pdf] Make sure Microsoft Word is installed.")
        sys.exit(1)
