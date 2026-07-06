import json
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends

router = APIRouter(prefix="/benchmarks", tags=["benchmarks"])
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def get_benchmark_results_path() -> Path:
    return PROJECT_ROOT / "data/processed/experiments/results.json"


def get_benchmark_summary_path() -> Path:
    return PROJECT_ROOT / "data/processed/benchmarks/summary.json"


BenchmarkResultsPathDep = Annotated[Path, Depends(get_benchmark_results_path)]
BenchmarkSummaryPathDep = Annotated[Path, Depends(get_benchmark_summary_path)]


@router.get("/results")
def benchmark_results(
    path: BenchmarkResultsPathDep,
    summary_path: BenchmarkSummaryPathDep,
) -> dict[str, Any]:
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        return {
            "available": True,
            "generated_at": payload.get("generated_at"),
            "results": payload.get("results", []),
            "failure": payload.get("failure"),
            "datasets": payload.get("datasets", {}),
        }

    if summary_path.exists():
        payload = json.loads(summary_path.read_text(encoding="utf-8"))
        return {
            "available": True,
            "generated_at": payload.get("generated_at"),
            "results": [],
            "failure": None,
            "datasets": payload.get("datasets", {}),
        }

    return {
        "available": False,
        "generated_at": None,
        "results": [],
        "failure": None,
        "datasets": {},
    }
