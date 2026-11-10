"""Offline RAGAS 0.4.3 evaluation. Input JSON contains adjudicated cases only."""
import asyncio
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def fail(message):
    raise SystemExit(message)


async def main():
    if len(sys.argv) != 3:
        fail("Usage: python scripts/evaluate-ragas.py <input.json> <output.json>")
    if os.getenv("MITRA_ENABLE_EXTERNAL_EVAL") != "true":
        fail("Set MITRA_ENABLE_EXTERNAL_EVAL=true only after confirming the dataset contains no personal or confidential data.")
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
    except ImportError as error:
        fail(f"Evaluation dependencies are missing ({error.name}); install with: pip install -r requirements-ragas-eval.txt")
    groq_key = os.getenv("GROQ_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not groq_key or not gemini_key:
        fail("Set GROQ_API_KEY for RAGAS evaluator calls and GEMINI_API_KEY for embeddings.")

    input_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()
    raw = input_path.read_bytes()
    cases = json.loads(raw)
    if not isinstance(cases, list) or not cases or len(cases) > 12:
        fail("The currently approved external pilot is limited to a JSON array of 1-12 sanitized, adjudicated cases.")
    ids = set()
    for row in cases:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or row["id"] in ids:
            fail("Each case must have a unique string id.")
        ids.add(row["id"])
        if not isinstance(row.get("question"), str) or not isinstance(row.get("answer"), str) or not isinstance(row.get("contexts"), list):
            fail(f"Case {row['id']} must contain question, answer and contexts.")
        if len(row["contexts"]) > 8 or any(not isinstance(context, str) for context in row["contexts"]):
            fail(f"Case {row['id']} must contain at most 8 string contexts.")

    try:
        from openai import AsyncOpenAI
        from google import genai
        from ragas.embeddings import GoogleEmbeddings
        from ragas.llms import llm_factory
        from ragas.metrics.collections import AnswerRelevancy, ContextPrecision, ContextPrecisionWithoutReference, ContextRecall, Faithfulness
    except ImportError as error:
        fail(f"Evaluation dependencies are missing ({error.name}); install with: pip install -r requirements-ragas-eval.txt")

    client = AsyncOpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
    llm = llm_factory(os.getenv("MITRA_RAGAS_MODEL", "openai/gpt-oss-120b"), client=client)
    embeddings = GoogleEmbeddings(client=genai.Client(api_key=gemini_key), model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"))
    metrics = {
        "faithfulness": Faithfulness(llm=llm),
        "answer_relevancy": AnswerRelevancy(llm=llm, embeddings=embeddings),
        "context_precision_with_reference": ContextPrecision(llm=llm),
        "context_precision_without_reference": ContextPrecisionWithoutReference(llm=llm),
        "context_recall": ContextRecall(llm=llm),
    }

    report_rows = []
    for row in cases:
        context = row["contexts"]
        base = {"user_input": row["question"], "response": row["answer"], "retrieved_contexts": context}
        scores = {}
        if context and row["answer"].strip():
            result = await metrics["faithfulness"].ascore(**base)
            scores["faithfulness"] = result.value
            result = await metrics["answer_relevancy"].ascore(**base)
            scores["answer_relevancy"] = result.value
            precision_metric = metrics["context_precision_without_reference"]
            precision_data = dict(base)
            if isinstance(row.get("reference"), str) and row["reference"].strip():
                precision_metric = metrics["context_precision_with_reference"]
                precision_data["reference"] = row["reference"]
            result = await precision_metric.ascore(**precision_data)
            scores["context_precision"] = result.value
            if isinstance(row.get("reference"), str) and row["reference"].strip():
                result = await metrics["context_recall"].ascore(**{**base, "reference": row["reference"]})
                scores["context_recall"] = result.value
        report_rows.append({"id": row["id"], "scores": scores})

    aggregates = {}
    for metric_name in sorted({name for row in report_rows for name in row["scores"]}):
        values = [row["scores"][metric_name] for row in report_rows if metric_name in row["scores"] and row["scores"][metric_name] is not None]
        aggregates[metric_name] = {"mean": sum(values) / len(values) if values else None, "n": len(values)}
    report = {
        "schemaVersion": 1,
        "ragasVersion": "0.4.3",
        "datasetSha256": hashlib.sha256(raw).hexdigest(),
        "model": os.getenv("MITRA_RAGAS_MODEL", "openai/gpt-oss-120b"),
        "embeddingModel": os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
        "caseCount": len(cases),
        "rows": report_rows,
        "aggregates": aggregates,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "interpretation": "Automated diagnostics only; not institutional accuracy or independent human judgment.",
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    print(json.dumps({"output": str(output_path), "caseCount": len(cases), "aggregates": aggregates}, indent=2))
    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
