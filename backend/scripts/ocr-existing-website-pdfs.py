#!/usr/bin/env python3
"""OCR downloaded image-only/sparse site PDFs with Windows' built-in OCR engine."""
import csv
import hashlib
import json
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "backend" / "data" / "website-corpus"
RAW = CORPUS / "raw"
MANIFEST = CORPUS / "manifest.json"
QUEUE = CORPUS / "review-queue.jsonl"
PS_SCRIPT = ROOT / "backend" / "scripts" / "windows-ocr-batch.ps1"
RESULTS_CSV = ROOT / "docs" / "new-website-audit" / "document-retrieval-results.csv"

def clean(value):
    return re.sub(r"[ \t]+", " ", str(value or "").replace("\x00", " ").replace("\r", "\n")).strip()

def normalize(value):
    return re.sub(r"\s+", " ", value).strip().casefold()

def content_text(value):
    return re.split(r"\nSource file: https?://", value, maxsplit=1)[0].strip()

def split_chunks(text, limit=2200):
    paragraphs = [clean(part) for part in re.split(r"\n{2,}|(?<=\.)\s{2,}", text) if clean(part)]
    chunks, current = [], ""
    for paragraph in paragraphs:
        match = re.match(r"^(\[Page \d+\])\s*", paragraph)
        marker = match.group(1) if match else ""
        if match:
            paragraph = paragraph[match.end():].strip()
        while len(paragraph) + (len(marker) + 1 if marker else 0) > limit:
            width = limit - (len(marker) + 1 if marker else 0)
            cut = paragraph.rfind(" ", 0, width)
            cut = cut if cut > width // 2 else width
            piece, paragraph = paragraph[:cut].strip(), paragraph[cut:].strip()
            if current:
                chunks.append(current)
                current = ""
            chunk = f"{marker}\n{piece}" if marker else piece
            if len(chunk) >= 40:
                chunks.append(chunk)
        value = f"{marker}\n{paragraph}" if marker else paragraph
        if current and len(current) + len(value) + 1 > limit:
            chunks.append(current)
            current = value
        else:
            current = (current + "\n" + value).strip()
    if current:
        chunks.append(current)
    return [part for part in chunks if len(part) >= 40]

def write_csv(path, rows):
    fields = sorted({key for row in rows for key in row})
    with path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value for key, value in row.items()})

def main():
    if not MANIFEST.exists() or not QUEUE.exists():
        raise SystemExit("Run extract-website-corpus.py before OCR.")
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    rows = data["manifest"]
    candidates = [row for row in rows if row.get("kind") == "asset" and
                  (row.get("extraction") == "scanned-no-text" or
                   (row.get("extraction") == "text-extracted" and row.get("chunks", 0) == 0))]
    if not candidates:
        print(json.dumps({"candidates": 0, "ocrDocuments": 0, "addedChunks": 0}, indent=2))
        return

    existing_hashes = set()
    for line in QUEUE.read_text(encoding="utf-8").splitlines():
        if line.strip():
            item = json.loads(line)
            existing_hashes.add(hashlib.sha256(normalize(content_text(item.get("text", ""))).encode("utf-8")).hexdigest())

    new_records = []
    report = []
    ocr_files = 0
    newly_text_files = 0
    for number, row in enumerate(candidates, 1):
        was_scanned = row.get("extraction") == "scanned-no-text"
        prior_chunks = int(row.get("chunks") or 0) if row.get("ocrEngine") else 0
        pdf_path = RAW / f"{row['sha256']}.pdf"
        if not pdf_path.exists():
            row["extraction"] = "ocr-missing-local-pdf"
            row["error"] = "Raw downloaded PDF is missing from the corpus cache."
            report.append({"title": row.get("title"), "url": row["url"], "status": row["extraction"], "pagesWithText": 0})
            continue

        with tempfile.TemporaryDirectory(prefix="mitra-ocr-") as temp_name:
            temp_dir = Path(temp_name)
            image_dir = temp_dir / "images"
            image_dir.mkdir()
            output_json = temp_dir / "results.json"
            rendered = 0
            with pymupdf.open(pdf_path) as pdf:
                for page_no, page in enumerate(pdf, 1):
                    image = image_dir / f"page-{page_no:04d}.png"
                    page.get_pixmap(dpi=240, colorspace=pymupdf.csGRAY, alpha=False).save(image)
                    rendered += 1
            command = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(PS_SCRIPT),
                       "-ImageDirectory", str(image_dir), "-OutputJson", str(output_json)]
            try:
                result = subprocess.run(command, capture_output=True, text=True, timeout=max(240, rendered * 30), check=False)
                if result.returncode != 0:
                    raise RuntimeError((result.stderr or result.stdout or f"PowerShell exited {result.returncode}").strip()[-1200:])
                recognized = json.loads(output_json.read_text(encoding="utf-8-sig"))
                if isinstance(recognized, dict):
                    recognized = [recognized]
            except Exception as exc:
                row["extraction"] = "ocr-failed"
                row["error"] = str(exc)[:1600]
                report.append({"title": row.get("title"), "url": row["url"], "status": row["extraction"], "pagesWithText": 0})
                print(f"OCR {number}/{len(candidates)} failed: {row.get('title')}", flush=True)
                continue

        page_texts = []
        nonempty_pages = 0
        recognized_page_numbers = set()
        for result in recognized:
            text = clean(result.get("text"))
            page_no = int(re.search(r"\d+", result.get("name", "0")).group(0))
            if len(text) >= 12:
                nonempty_pages += 1
                recognized_page_numbers.add(page_no)
                page_texts.append(f"[Page {page_no}]\n{text}")
        extracted = "\n\n".join(page_texts)
        pieces = split_chunks(extracted)
        doc_id = "DOC-" + row["sha256"][:16].upper()
        source_url = row.get("finalUrl") or row["url"]
        referring_page = row.get("referringPage", "")
        added = 0
        for i, piece in enumerate(pieces, 1):
            fingerprint = hashlib.sha256(normalize(piece).encode("utf-8")).hexdigest()
            if fingerprint in existing_hashes:
                continue
            existing_hashes.add(fingerprint)
            title = row.get("title") or "MITCORER document"
            if len(pieces) > 1:
                title = f"{title} (part {i})"
            new_records.append({
                "title": title,
                "category": "Website document review",
                "source": "MITCORER official website (linked PDF OCR; captured 2026-11-06)",
                "sourceUrl": source_url,
                "text": piece + f"\nSource file: {source_url}\nReferring page: {referring_page}\nChecksum: SHA-256 {row['sha256']}",
                "status": "Review",
                "tags": ["mitcorer", "official website", "linked document", "ocr", "review"],
                "provenance": {"documentId": doc_id, "documentVersion": row["sha256"][:16], "capturedAt": "2026-11-06", "section": title[:180]},
            })
            added += 1

        row["ocrEngine"] = "Windows.Media.Ocr/en-US"
        row["ocrPages"] = nonempty_pages
        row["ocrMissingPages"] = [page_no for page_no in range(1, int(row.get("pageCount") or 0) + 1)
                                  if page_no not in recognized_page_numbers]
        row["textPages"] = nonempty_pages
        row["extractedChars"] = len(extracted)
        row["chunks"] = prior_chunks + added
        row["extraction"] = "ocr-extracted" if added else ("ocr-duplicate-content" if pieces else "ocr-no-text")
        row.pop("error", None)
        if added:
            ocr_files += 1
            if was_scanned:
                newly_text_files += 1
        report.append({"title": row.get("title"), "url": source_url, "status": row["extraction"], "pagesWithText": nonempty_pages, "missingPages": row["ocrMissingPages"], "pageCount": row.get("pageCount"), "chunks": added})
        print(f"OCR {number}/{len(candidates)}: {row.get('title')} ({nonempty_pages}/{row.get('pageCount')} pages, {added} chunks)", flush=True)

    if new_records:
        with QUEUE.open("a", encoding="utf-8") as output:
            for record in new_records:
                output.write(json.dumps(record, ensure_ascii=False) + "\n")
    data["ocrEngine"] = "Windows.Media.Ocr/en-US"
    data["ocrCompletedAt"] = datetime.now(timezone.utc).isoformat()
    data["extractedUniqueFiles"] = data.get("extractedUniqueFiles", 0) + newly_text_files
    data["ocrIndexedFiles"] = data.get("ocrIndexedFiles", 0) + ocr_files
    data["reviewQueueRecords"] = data.get("reviewQueueRecords", 0) + len(new_records)
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(CORPUS / "manifest.csv", rows)
    write_csv(RESULTS_CSV, rows)
    (CORPUS / "ocr-report.json").write_text(json.dumps({"processed": len(candidates), "ocrDocuments": ocr_files, "addedChunks": len(new_records), "results": report}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"processed": len(candidates), "ocrDocuments": ocr_files, "addedChunks": len(new_records), "remainingWithoutText": sum(item["status"] in ("ocr-no-text", "ocr-failed", "ocr-missing-local-pdf") for item in report)}, indent=2))

if __name__ == "__main__":
    main()
