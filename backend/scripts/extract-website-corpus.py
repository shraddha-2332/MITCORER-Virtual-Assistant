#!/usr/bin/env python3
"""Retry failed MITCORER routes and extract linked PDF/XLSX content into a review queue."""
import concurrent.futures
import csv
import hashlib
import json
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, unquote

import pymupdf as fitz
import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / "docs" / "new-website-audit"
OUT = ROOT / "backend" / "data" / "website-corpus"
RAW = OUT / "raw"
DOWNLOADS = OUT / "downloads"
MAX_BYTES = 100 * 1024 * 1024
TIMEOUT = (15, 60)
HEADERS = {"User-Agent": "MITCORER-MitraKnowledgeImport/1.0 (public institutional website content retrieval)"}

def canonical(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme.lower(), p.netloc.lower().removeprefix("www."), p.path.rstrip("/") or "/", "", ""))

def digest(b):
    return hashlib.sha256(b).hexdigest()

def clean_text(s):
    s = s.replace("\x00", " ").replace("\r", "\n")
    return re.sub(r"[ \t]+", " ", s).strip()

def split_chunks(text, limit=2200):
    paras = [clean_text(x) for x in re.split(r"\n{2,}|(?<=\.)\s{2,}", text) if clean_text(x)]
    chunks, current = [], ""
    for para in paras:
        page_marker = re.match(r"^(\[Page \d+\])\s*", para)
        marker = page_marker.group(1) if page_marker else ""
        if page_marker:
            para = para[page_marker.end():].strip()
        while len(para) > limit:
            available = limit - (len(marker) + 1 if marker else 0)
            cut = para.rfind(" ", 0, available)
            cut = cut if cut > available // 2 else available
            piece, para = para[:cut].strip(), para[cut:].strip()
            if current:
                chunks.append(current)
                current = ""
            piece = f"{marker}\n{piece}" if marker else piece
            if len(piece) >= 40:
                chunks.append(piece)
        if len((current + "\n" + para).strip()) > limit and current:
            chunks.append(current)
            current = f"{marker}\n{para}" if marker else para
        else:
            value = f"{marker}\n{para}" if marker else para
            current = (current + "\n" + value).strip()
    if current:
        chunks.append(current)
    return [x for x in chunks if len(x) >= 40]

def fetch(url):
    error = ""
    temp_path = DOWNLOADS / (hashlib.sha256(url.encode("utf-8")).hexdigest() + ".part")
    for attempt in range(1, 4):
        try:
            with requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True) as r:
                if r.status_code >= 500:
                    error = f"HTTP {r.status_code}"
                    time.sleep(attempt)
                    continue
                if r.status_code != 200:
                    return {"url": url, "status": r.status_code, "finalUrl": r.url, "error": f"HTTP {r.status_code}"}
                hasher, size = hashlib.sha256(), 0
                with temp_path.open("wb") as target:
                    for part in r.iter_content(1024 * 256):
                        if not part:
                            continue
                        size += len(part)
                        if size > MAX_BYTES:
                            target.close()
                            temp_path.unlink(missing_ok=True)
                            return {"url": url, "status": 200, "finalUrl": r.url, "error": "exceeds 100 MiB safety limit"}
                        target.write(part)
                        hasher.update(part)
                return {"url": url, "status": 200, "finalUrl": r.url, "contentType": r.headers.get("content-type", ""), "path": str(temp_path), "bytes": size, "sha256": hasher.hexdigest()}
        except Exception as e:
            temp_path.unlink(missing_ok=True)
            error = f"{type(e).__name__}: {e}"
            time.sleep(attempt)
    return {"url": url, "status": 0, "error": error}

def page_extract(item):
    title = item.get("title") or "MITCORER page"
    soup = BeautifulSoup(item["bytes"], "html.parser")
    title = (soup.title.get_text(" ", strip=True) if soup.title else title)[:180]
    for selector in ["script", "style", "noscript", "nav", "footer", "header", "form", "iframe", "svg", "button"]:
        for node in soup.select(selector):
            node.decompose()
    main = soup.select_one("main") or soup.select_one("article") or soup.select_one("#content") or soup.body or soup
    for node in main.select(".modal, .modal-backdrop, .navbar, .breadcrumb, .sidebar, .footer, .header"):
        node.decompose()
    text = clean_text(main.get_text("\n", strip=True))
    lines, seen = [], set()
    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        k = line.casefold()
        if len(line) < 2 or k in seen or re.search(r"student inquiry portal|please provide your details to access|verify & enter site", line, re.I):
            continue
        seen.add(k)
        lines.append(line)
    return title, "\n".join(lines)

def document_title(url):
    name = unquote(urlsplit(url).path.rsplit("/", 1)[-1])
    return re.sub(r"[_-]+", " ", re.sub(r"\.(pdf|xlsx?)$", "", name, flags=re.I)).strip()[:180] or "MITCORER document"

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    crawl = json.loads((AUDIT / "crawl.json").read_text(encoding="utf-8-sig"))
    failures = crawl.get("failures", [])
    assets, unique = [], set()
    for a in crawl.get("assets", []):
        key = canonical(a["url"])
        if key not in unique:
            unique.add(key)
            assets.append({**a, "canonicalUrl": key})
    jobs = [("route", x["url"], x) for x in failures] + [("asset", x["url"], x) for x in assets]
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        future_map = {pool.submit(fetch, url): (kind, url, meta) for kind, url, meta in jobs}
        for future in concurrent.futures.as_completed(future_map):
            kind, url, meta = future_map[future]
            result = future.result()
            results[(kind, url)] = (result, meta)
            print(f"{kind}: {result.get('status')} {url}", flush=True)

    chunks_out, manifest = [], []
    checksum_first = {}
    route_success = 0
    for url in [x["url"] for x in failures]:
        result, meta = results[("route", url)]
        row = {"kind": "route", "url": url, "title": meta.get("title", ""), "finalUrl": result.get("finalUrl", ""), "status": result.get("status", 0), "error": result.get("error", ""), "extractedChars": 0, "chunks": 0}
        data_path = Path(result["path"]) if result.get("path") else None
        if data_path and "html" in result.get("contentType", "").lower():
            data = data_path.read_bytes()
            title, text = page_extract({**meta, "bytes": data})
            pieces = split_chunks(text)
            route_success += 1
            row.update({"title": title, "extractedChars": len(text), "chunks": len(pieces), "sha256": result["sha256"]})
            for i, piece in enumerate(pieces, 1):
                chunks_out.append({"title": f"{title} (part {i})" if len(pieces) > 1 else title, "category": "Website route review", "source": "MITCORER official website (retried route; captured 2026-11-06)", "sourceUrl": canonical(result.get("finalUrl") or url), "text": piece, "status": "Review", "tags": ["mitcorer", "official website", "retried route", "review"], "provenance": {"documentId": "WEB-" + digest(canonical(result.get("finalUrl") or url).encode())[:16].upper(), "documentVersion": "retry-2026-11-06", "capturedAt": "2026-11-06", "section": urlsplit(url).path[-160:]}})
        if data_path:
            data_path.unlink(missing_ok=True)
        manifest.append(row)

    downloaded_bytes = 0
    extracted_files = 0
    for asset in assets:
        url = asset["url"]
        result, _ = results[("asset", url)]
        row = {"kind": "asset", "url": url, "title": document_title(url), "referringPage": asset.get("from", ""), "finalUrl": result.get("finalUrl", ""), "status": result.get("status", 0), "error": result.get("error", ""), "extraction": "failed", "extractedChars": 0, "chunks": 0, "sha256": "", "bytes": 0, "duplicateOf": ""}
        data_path = Path(result["path"]) if result.get("path") else None
        if not data_path:
            manifest.append(row)
            continue
        checksum = result["sha256"]
        row.update({"sha256": checksum, "bytes": result["bytes"], "contentType": result.get("contentType", "")})
        downloaded_bytes += result["bytes"]
        if checksum in checksum_first:
            row.update({"extraction": "duplicate-content", "duplicateOf": checksum_first[checksum]})
            data_path.unlink(missing_ok=True)
            manifest.append(row)
            continue
        checksum_first[checksum] = url
        with data_path.open("rb") as source_file:
            signature = source_file.read(5)
        suffix = ".pdf" if signature == b"%PDF-" else (".xlsx" if signature[:2] == b"PK" else ".bin")
        stored = RAW / f"{checksum}{suffix}"
        if stored.exists():
            data_path.unlink(missing_ok=True)
        else:
            shutil.move(str(data_path), stored)
        title = document_title(result.get("finalUrl") or url)
        output_text = ""
        if suffix == ".pdf":
            try:
                with fitz.open(stored) as pdf:
                    pages = []
                    nonempty = 0
                    for page_no, page in enumerate(pdf, 1):
                        ptxt = clean_text(page.get_text("text", sort=True))
                        if ptxt:
                            nonempty += 1
                            pages.append(f"[Page {page_no}]\n{ptxt}")
                    output_text = "\n\n".join(pages)
                    row["pageCount"] = len(pdf)
                    row["textPages"] = nonempty
                    row["extraction"] = "text-extracted" if output_text else "scanned-no-text"
            except Exception as e:
                row["error"] = f"PDF extraction: {type(e).__name__}: {e}"
        elif suffix == ".xlsx":
            try:
                wb = load_workbook(stored, read_only=True, data_only=True)
                sheets = []
                for ws in wb.worksheets:
                    rows = []
                    for values in ws.iter_rows(values_only=True):
                        cells = [clean_text(str(v)) for v in values if v is not None and clean_text(str(v))]
                        if cells:
                            rows.append(" | ".join(cells))
                    if rows:
                        sheets.append(f"[Worksheet: {ws.title}]\n" + "\n".join(rows))
                output_text = "\n\n".join(sheets)
                row["sheetNames"] = wb.sheetnames
                row["extraction"] = "text-extracted" if output_text else "empty-spreadsheet"
                wb.close()
            except Exception as e:
                row["error"] = f"XLSX extraction: {type(e).__name__}: {e}"
        else:
            row["extraction"] = "unsupported-file-type"
        row["extractedChars"] = len(output_text)
        if output_text:
            pieces = split_chunks(output_text)
            row["chunks"] = len(pieces)
            for i, piece in enumerate(pieces, 1):
                origin = f"\nSource file: {url}\nReferring page: {asset.get('from','')}\nChecksum: SHA-256 {checksum}"
                chunks_out.append({"title": f"{title} (part {i})" if len(pieces) > 1 else title, "category": "Website document review", "source": "MITCORER official website (linked document; captured 2026-11-06)", "sourceUrl": canonical(result.get("finalUrl") or url), "text": piece + origin, "status": "Review", "tags": ["mitcorer", "official website", "linked document", "review"], "provenance": {"documentId": "DOC-" + checksum[:16].upper(), "documentVersion": checksum[:16], "capturedAt": "2026-11-06", "section": document_title(url)[:180]}})
            extracted_files += 1
        manifest.append(row)

    # Exact duplicate chunk suppression by normalized content. Keep the first original citation.
    seen_text = set()
    deduped = []
    for item in chunks_out:
        key = re.sub(r"\s+", " ", item["text"]).strip().casefold()
        if key in seen_text:
            continue
        seen_text.add(key)
        deduped.append(item)
    chunks_out = deduped
    (OUT / "review-queue.jsonl").write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in chunks_out), encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps({"capturedAt": datetime.now(timezone.utc).isoformat(), "sourceCrawlAt": crawl.get("crawledAt"), "uniqueRouteRetries": len(failures), "routeSuccess": route_success, "uniqueAssetUrls": len(assets), "downloadedAssetBytes": downloaded_bytes, "uniqueDownloadedFileContents": len(checksum_first), "extractedUniqueFiles": extracted_files, "reviewQueueRecords": len(chunks_out), "manifest": manifest}, ensure_ascii=False, indent=2), encoding="utf-8")
    with (OUT / "manifest.csv").open("w", encoding="utf-8-sig", newline="") as f:
        fields = sorted({k for r in manifest for k in r})
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in manifest:
            w.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v for k, v in row.items()})
    shutil.rmtree(DOWNLOADS, ignore_errors=True)
    print(json.dumps({"routeRetries": len(failures), "routesSucceeded": route_success, "assets": len(assets), "uniqueDownloadedContents": len(checksum_first), "downloadedBytes": downloaded_bytes, "filesExtracted": extracted_files, "reviewQueueRecords": len(chunks_out), "routeFailures": sum(1 for r in manifest if r["kind"] == "route" and r["status"] != 200), "assetFailures": sum(1 for r in manifest if r["kind"] == "asset" and r["extraction"] not in ("text-extracted", "duplicate-content"))}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
