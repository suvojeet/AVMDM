"""
Averio Patent Update Agent
--------------------------
Run this script whenever USPTO_PATENT_APPLICATION.md is updated.
It rebuilds the DOCX (with figures) and converts to PDF in one step.

Usage:
    python update_patent.py
"""

import sys
import subprocess
from pathlib import Path

PATENT_DIR = Path(__file__).parent.resolve()
MD_FILE    = PATENT_DIR / "USPTO_PATENT_APPLICATION.md"
DOCX_FILE  = PATENT_DIR / "USPTO_PATENT_APPLICATION.docx"
PDF_FILE   = PATENT_DIR / "USPTO_PATENT_APPLICATION.pdf"


def banner(msg: str):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def run_step(label: str, script: str):
    banner(label)
    result = subprocess.run(
        [sys.executable, str(PATENT_DIR / script)],
        capture_output=False
    )
    if result.returncode != 0:
        print(f"\n[ERROR] {label} failed (exit {result.returncode}). Aborting.")
        sys.exit(result.returncode)
    print(f"\n[OK] {label} complete.")


def check_source():
    if not MD_FILE.exists():
        print(f"[ERROR] Patent source not found: {MD_FILE}")
        sys.exit(1)
    size = MD_FILE.stat().st_size
    print(f"[INFO] Source: {MD_FILE.name}  ({size:,} bytes)")


if __name__ == "__main__":
    banner("Averio Patent Update Agent — AVERIO-001-US")
    print(f"  Docket  : AVERIO-001-US")
    print(f"  Source  : {MD_FILE.name}")
    print(f"  Output  : {DOCX_FILE.name}, {PDF_FILE.name}")

    check_source()

    run_step("Step 1 of 2 — Building DOCX with figures", "build_docx_with_figures.py")
    run_step("Step 2 of 2 - Converting DOCX to PDF",     "convert_to_pdf.py")

    banner("Patent export complete")
    print(f"  DOCX : {DOCX_FILE}")
    print(f"  PDF  : {PDF_FILE}")
    print()
