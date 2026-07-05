from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.database import get_events_collection, get_mongo_client
from app.main import app
from app.routes.benchmarks import get_benchmark_results_path, get_benchmark_summary_path


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs
        self.limit_value = None
        self.skip_value = 0

    def limit(self, value):
        self.limit_value = value
        return self

    def skip(self, value):
        self.skip_value = value
        return self

    def sort(self, value):
        self.sort_value = value
        return self

    def __iter__(self):
        docs = self.docs[self.skip_value :]
        if self.limit_value is not None:
            docs = docs[: self.limit_value]
        return iter(docs)


class FakeEventsCollection:
    def __init__(self):
        self.find_calls = []
        self.count_calls = []
        self.aggregate_calls = []
        self.inserted = []
        self.find_docs = [
            {
                "_id": "mongo-id",
                "idEvento": "EVT000001",
                "tipo": "Incêndio",
                "descricao": "Foco de queimada",
                "dataHora": "2025-06-10T15:30:00-03:00",
                "gravidade": 4,
                "status": "Aberto",
                "bairro": "Centro",
                "cidade": "Rio de Janeiro",
                "estado": "RJ",
                "pais": "Brasil",
                "localizacao": {
                    "type": "Point",
                    "coordinates": [-43.1729, -22.9068],
                },
            }
        ]
        self.aggregate_docs = [{"_id": "Incêndio", "total": 3}]
        self.distinct_values = {
            "pais": ["Brasil", "Estados Unidos"],
            "estado": ["RJ", "SP"],
            "cidade": ["Rio de Janeiro", "Sao Paulo"],
            "bairro": ["Centro", "Copacabana"],
        }

    def find(self, query):
        self.find_calls.append(query)
        return FakeCursor([doc.copy() for doc in self.find_docs])

    def aggregate(self, pipeline):
        self.aggregate_calls.append(pipeline)
        return [doc.copy() for doc in self.aggregate_docs]

    def count_documents(self, query):
        self.count_calls.append(query)
        return len(self.find_docs)

    def distinct(self, field, query=None):
        self.find_calls.append({"distinct": field, "query": query or {}})
        return self.distinct_values.get(field, [])

    def insert_one(self, payload):
        self.inserted.append(payload)
        return SimpleNamespace(inserted_id="inserted-id")


class FakeMongoClient:
    class Admin:
        @staticmethod
        def command(name):
            assert name == "replSetGetStatus"
            return {
                "members": [
                    {
                        "name": "mongo1:27017",
                        "stateStr": "PRIMARY",
                        "health": 1,
                        "uptime": 42,
                    }
                ]
            }

    admin = Admin()


def override_dependency(dependency, value):
    app.dependency_overrides[dependency] = lambda: value


def clear_overrides():
    app.dependency_overrides.clear()


def test_list_events_uses_tipo_filter_and_limit():
    fake_events = FakeEventsCollection()
    override_dependency(get_events_collection, fake_events)

    try:
        response = TestClient(app).get("/events", params={"tipo": "Incêndio", "limit": 1})
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert fake_events.find_calls == [{"tipo": "Incêndio"}]
    assert response.json() == [
        {
            "idEvento": "EVT000001",
            "tipo": "Incêndio",
            "descricao": "Foco de queimada",
            "dataHora": "2025-06-10T15:30:00-03:00",
            "gravidade": 4,
            "status": "Aberto",
            "bairro": "Centro",
            "cidade": "Rio de Janeiro",
            "estado": "RJ",
            "pais": "Brasil",
            "localizacao": {
                "type": "Point",
                "coordinates": [-43.1729, -22.9068],
            },
            "reportante": None,
            "origem": None,
            "metadados": None,
        }
    ]


def test_create_event_validates_payload_and_inserts_document():
    fake_events = FakeEventsCollection()
    override_dependency(get_events_collection, fake_events)
    payload = {
        "tipo": "Alagamento",
        "descricao": "Rua alagada",
        "dataHora": "2026-07-04T15:00:00Z",
        "gravidade": 3,
        "status": "Aberto",
        "bairro": "Centro",
        "cidade": "Rio de Janeiro",
        "estado": "RJ",
        "pais": "Brasil",
        "localizacao": {"type": "Point", "coordinates": [-43.1729, -22.9068]},
        "reportante": {"tipo": "Manual", "identificador": "UI"},
        "origem": {"fonte": "manual", "idOriginal": None, "arquivoRaw": None},
        "metadados": {"extraidoEm": "2026-07-04T15:00:00Z"},
    }

    try:
        response = TestClient(app).post("/events", json=payload)
    finally:
        clear_overrides()

    assert response.status_code == 201
    assert response.json() == {"inserted_id": "inserted-id"}
    assert fake_events.inserted == [payload]


def test_create_event_rejects_invalid_geojson_coordinates():
    fake_events = FakeEventsCollection()
    override_dependency(get_events_collection, fake_events)
    payload = {
        "tipo": "Alagamento",
        "dataHora": "2026-07-04T15:00:00Z",
        "gravidade": 3,
        "cidade": "Rio de Janeiro",
        "localizacao": {"type": "Point", "coordinates": [-43.1729]},
    }

    try:
        response = TestClient(app).post("/events", json=payload)
    finally:
        clear_overrides()

    assert response.status_code == 422
    assert fake_events.inserted == []


def test_stats_by_type_uses_collection_dependency():
    fake_events = FakeEventsCollection()
    override_dependency(get_events_collection, fake_events)

    try:
        response = TestClient(app).get("/stats/by-type")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json() == [{"_id": "Incêndio", "total": 3}]
    assert fake_events.aggregate_calls


def test_node_status_uses_client_dependency():
    override_dependency(get_mongo_client, FakeMongoClient())

    try:
        response = TestClient(app).get("/nodes/status")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "members": [
            {
                "name": "mongo1:27017",
                "state": "PRIMARY",
                "health": 1,
                "uptime": 42,
            }
        ],
        "error": None,
    }


def test_search_events_returns_paginated_results_with_filters():
    fake_events = FakeEventsCollection()
    override_dependency(get_events_collection, fake_events)

    try:
        response = TestClient(app).get(
            "/events/search",
            params={
                "q": "queimada",
                "tipo": "Incêndio",
                "pais": "Brasil",
                "estado": "RJ",
                "cidade": "Rio de Janeiro",
                "bairro": "Centro",
                "status": "Aberto",
                "minGravidade": 3,
                "inicio": "2025-01-01",
                "fim": "2025-12-31",
                "page": 2,
                "pageSize": 25,
            },
        )
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["page"] == 2
    assert response.json()["pageSize"] == 25
    query = fake_events.find_calls[-1]
    assert query["tipo"] == "Incêndio"
    assert query["pais"] == "Brasil"
    assert query["estado"] == "RJ"
    assert query["cidade"] == "Rio de Janeiro"
    assert query["bairro"] == "Centro"
    assert query["status"] == "Aberto"
    assert query["gravidade"] == {"$gte": 3}
    assert query["dataHora"]["$gte"].startswith("2025-01-01")
    assert query["dataHora"]["$lte"].startswith("2025-12-31")
    assert "$or" in query


def test_search_events_filters_by_allowed_document_field():
    fake_events = FakeEventsCollection()
    override_dependency(get_events_collection, fake_events)

    try:
        response = TestClient(app).get(
            "/events/search",
            params={
                "documentField": "metadados.categoriaOriginal",
                "documentOperator": "contains",
                "documentValue": "queimada",
            },
        )
    finally:
        clear_overrides()

    assert response.status_code == 200
    query = fake_events.find_calls[-1]
    assert query["metadados.categoriaOriginal"] == {
        "$regex": "queimada",
        "$options": "i",
    }


def test_search_events_rejects_unlisted_document_field():
    fake_events = FakeEventsCollection()
    override_dependency(get_events_collection, fake_events)

    try:
        response = TestClient(app).get(
            "/events/search",
            params={
                "documentField": "$where",
                "documentValue": "this.total > 0",
            },
        )
    finally:
        clear_overrides()

    assert response.status_code == 400
    assert fake_events.find_calls == []


def test_event_filter_options_returns_existing_location_values():
    fake_events = FakeEventsCollection()
    override_dependency(get_events_collection, fake_events)

    try:
        response = TestClient(app).get(
            "/events/filter-options",
            params={"pais": "Brasil", "estado": "RJ", "cidade": "Rio de Janeiro"},
        )
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json() == {
        "paises": ["Brasil", "Estados Unidos"],
        "estados": ["RJ", "SP"],
        "cidades": ["Rio de Janeiro", "Sao Paulo"],
        "bairros": ["Centro", "Copacabana"],
    }
    assert {"distinct": "estado", "query": {"pais": "Brasil"}} in fake_events.find_calls
    assert {
        "distinct": "cidade",
        "query": {"pais": "Brasil", "estado": "RJ"},
    } in fake_events.find_calls
    assert {
        "distinct": "bairro",
        "query": {"pais": "Brasil", "estado": "RJ", "cidade": "Rio de Janeiro"},
    } in fake_events.find_calls


def test_stats_summary_returns_dashboard_metrics():
    fake_events = FakeEventsCollection()
    fake_events.aggregate_docs = [
        {
            "total": 100000,
            "critical": 4200,
            "open": 97000,
            "avgSeverity": 3.24,
            "cities": 180,
            "neighborhoods": 95,
            "brazil": 82262,
            "rioState": 62603,
            "international": 17738,
            "minDate": "2016-07-05T00:00:00Z",
            "maxDate": "2026-07-04T00:00:00Z",
            "victims": 120,
            "dead": 40,
            "wounded": 80,
            "maxFirePower": 132.5,
            "avgFireRisk": 0.71,
            "maxRainMm": 88.0,
            "avgRainMm": 12.4,
        }
    ]
    override_dependency(get_events_collection, fake_events)

    try:
        response = TestClient(app).get("/stats/summary")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json()["total"] == 100000
    assert response.json()["critical"] == 4200
    assert response.json()["brazil"] == 82262
    assert response.json()["metadata"]["victims"] == 120
    assert response.json()["metadata"]["maxFirePower"] == 132.5
    assert response.json()["dateRange"]["min"] == "2016-07-05T00:00:00Z"


def test_stats_by_severity_returns_aggregated_counts():
    fake_events = FakeEventsCollection()
    fake_events.aggregate_docs = [{"_id": 5, "total": 12}, {"_id": 4, "total": 30}]
    override_dependency(get_events_collection, fake_events)

    try:
        response = TestClient(app).get("/stats/by-severity")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json() == [{"_id": 5, "total": 12}, {"_id": 4, "total": 30}]


def test_benchmarks_results_reads_local_file(tmp_path):
    results_path = tmp_path / "results.json"
    results_path.write_text(
        """
        {
          "generated_at": "2026-07-04T20:59:43Z",
          "results": [{"test": "insert", "size": 1000, "seconds": 0.1, "count": 1000}],
          "failure": {"skipped": false, "consistent": true}
        }
        """,
        encoding="utf-8",
    )
    override_dependency(get_benchmark_results_path, results_path)

    try:
        response = TestClient(app).get("/benchmarks/results")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json() == {
        "available": True,
        "generated_at": "2026-07-04T20:59:43Z",
        "results": [{"test": "insert", "size": 1000, "seconds": 0.1, "count": 1000}],
        "failure": {"skipped": False, "consistent": True},
        "datasets": {},
    }


def test_benchmarks_results_falls_back_to_dataset_summary(tmp_path):
    summary_path = tmp_path / "summary.json"
    summary_path.write_text(
        """
        {
          "generated_at": "2026-07-04T20:32:05Z",
          "datasets": {
            "1000": {
              "path": "data/processed/benchmarks/events_1000.jsonl",
              "total": 1000,
              "by_type": {"Incêndio": 83},
              "by_country": {"Brasil": 419},
              "rio_de_janeiro": 240,
              "brasil": 419
            }
          }
        }
        """,
        encoding="utf-8",
    )
    override_dependency(get_benchmark_results_path, tmp_path / "missing-results.json")
    override_dependency(get_benchmark_summary_path, summary_path)

    try:
        response = TestClient(app).get("/benchmarks/results")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json()["available"] is True
    assert response.json()["generated_at"] == "2026-07-04T20:32:05Z"
    assert response.json()["results"] == []
    assert response.json()["failure"] is None
    assert response.json()["datasets"]["1000"]["total"] == 1000


def test_benchmark_paths_are_resolved_from_project_root(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    results_path = get_benchmark_results_path()
    summary_path = get_benchmark_summary_path()

    assert results_path.is_absolute()
    assert summary_path.is_absolute()
    assert results_path.as_posix().endswith("/data/processed/experiments/results.json")
    assert summary_path.as_posix().endswith("/data/processed/benchmarks/summary.json")


def test_benchmarks_results_returns_empty_state_when_file_is_missing(tmp_path):
    override_dependency(get_benchmark_results_path, tmp_path / "missing.json")
    override_dependency(get_benchmark_summary_path, tmp_path / "missing-summary.json")

    try:
        response = TestClient(app).get("/benchmarks/results")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json() == {
        "available": False,
        "generated_at": None,
        "results": [],
        "failure": None,
        "datasets": {},
    }
