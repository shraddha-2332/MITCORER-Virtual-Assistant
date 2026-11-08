#!/usr/bin/env python3
"""Build a separate FTS5 index for text extracted from linked official documents."""
import hashlib
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "backend" / "data" / "website-corpus"
QUEUE = CORPUS / "review-queue.jsonl"
INDEX = CORPUS / "document-index.sqlite"

def content_without_trailer(text):
    return re.split(r"\nSource file: https?://", text, maxsplit=1)[0].strip()

def document_name(title):
    return re.sub(r"\s+\(part \d+\)$", "", title or "MITCORER document").strip()[:180]

def main():
    if not QUEUE.is_file():
        raise SystemExit(f"Missing extraction queue: {QUEUE}")
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    if INDEX.exists():
        INDEX.unlink()
    db = sqlite3.connect(INDEX)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=NORMAL")
    db.executescript("""
      CREATE TABLE documents (
        document_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_url TEXT NOT NULL,
        referring_page TEXT NOT NULL,
        checksum TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Published','Review','Archived')),
        chunk_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE chunks (
        chunk_id INTEGER PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(document_id),
        ordinal INTEGER NOT NULL,
        page_start INTEGER,
        page_end INTEGER,
        content TEXT NOT NULL
      );
      CREATE INDEX chunks_document_id_idx ON chunks(document_id);
      CREATE VIRTUAL TABLE chunks_fts USING fts5(title, content, document_id UNINDEXED, chunk_id UNINDEXED,
        tokenize='unicode61 remove_diacritics 2');
    """)
    insert_doc = db.cursor()
    insert_chunk = db.cursor()
    insert_fts = db.cursor()
    doc_cache = {}
    count = 0
    skipped = 0
    with db:
      with QUEUE.open("r", encoding="utf-8") as source:
        for line in source:
          if not line.strip():
            continue
          record = json.loads(line)
          provenance = record.get("provenance", {})
          doc_id = provenance.get("documentId") or "DOC-" + hashlib.sha256(record.get("sourceUrl", "").encode()).hexdigest()[:16].upper()
          content = content_without_trailer(record.get("text", ""))
          if len(content) < 40:
            skipped += 1
            continue
          if doc_id not in doc_cache:
            source_url = record.get("sourceUrl", "")
            referring = ""
            marker = re.search(r"\nReferring page: (https?://[^\n]+)", record.get("text", ""))
            if marker:
              referring = marker.group(1).strip()
            checksum = provenance.get("documentVersion", "")
            meta = (doc_id, document_name(record.get("title")), source_url, referring, checksum,
                    provenance.get("capturedAt", "2026-11-06"), "Published")
            insert_doc.execute("INSERT INTO documents(document_id,title,source_url,referring_page,checksum,captured_at,status) VALUES(?,?,?,?,?,?,?)", meta)
            doc_cache[doc_id] = {"title": meta[1], "ordinal": 0, "chunks": 0, "last_page": None}
          info = doc_cache[doc_id]
          info["ordinal"] += 1
          info["chunks"] += 1
          page_nums = [int(n) for n in re.findall(r"\[Page (\d+)\]", record.get("text", ""))]
          if page_nums:
            info["last_page"] = max(page_nums)
          page_start = min(page_nums) if page_nums else info["last_page"]
          page_end = max(page_nums) if page_nums else info["last_page"]
          cur = insert_chunk.execute("INSERT INTO chunks(document_id,ordinal,page_start,page_end,content) VALUES(?,?,?,?,?)",
                                     (doc_id, info["ordinal"], page_start, page_end, content))
          chunk_id = cur.lastrowid
          insert_fts.execute("INSERT INTO chunks_fts(rowid,title,content,document_id,chunk_id) VALUES(?,?,?,?,?)",
                             (chunk_id, info["title"], content, doc_id, str(chunk_id)))
          count += 1
      for doc_id, info in doc_cache.items():
        db.execute("UPDATE documents SET chunk_count=? WHERE document_id=?", (info["chunks"], doc_id))
    db.execute("PRAGMA optimize")
    stats = {"documents": len(doc_cache), "chunks": count, "skippedShortChunks": skipped,
             "indexBytes": INDEX.stat().st_size, "sourceQueueBytes": QUEUE.stat().st_size,
             "status": "Published extracted text from first-party linked documents; unavailable/scanned files excluded"}
    (CORPUS / "index-stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    db.close()
    print(json.dumps(stats, indent=2))

if __name__ == "__main__":
    main()
