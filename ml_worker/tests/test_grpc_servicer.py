import pytest
from unittest.mock import MagicMock
import ml_service_pb2
from main import MlInferenceServicer

@pytest.fixture(scope="module")
def servicer():
    return MlInferenceServicer()

def test_health_check(servicer):
    request = ml_service_pb2.HealthCheckRequest()
    context = MagicMock()

    response = servicer.HealthCheck(request, context)
    assert response.status == ml_service_pb2.ServingStatus.SERVING

def test_generate_embeddings_servicer(servicer):
    request = ml_service_pb2.EmbedRequest(text="Auditable machine unlearning test")
    context = MagicMock()

    response = servicer.GenerateEmbeddings(request, context)
    assert response.dimension == 384
    assert len(response.vector) == 384
    context.abort.assert_not_called()

def test_generate_embeddings_empty_text_aborts(servicer):
    request = ml_service_pb2.EmbedRequest(text="")
    context = MagicMock()

    servicer.GenerateEmbeddings(request, context)
    context.abort.assert_called_once()

def test_extract_triplets_servicer(servicer):
    request = ml_service_pb2.ExtractRequest(text="SurrealDB stores knowledge graphs.")
    context = MagicMock()

    response = servicer.ExtractTriplets(request, context)
    assert len(response.triplets) >= 1
    first = response.triplets[0]
    assert first.subject != ""
    assert first.predicate != ""
    assert first.object != ""
    context.abort.assert_not_called()

def test_ingest_batch_servicer(servicer):
    items = [
        ml_service_pb2.SingleIngestItem(
            id="doc_1",
            entity_id="user_101",
            text="Alice creates a secure cryptographic key."
        ),
        ml_service_pb2.SingleIngestItem(
            id="doc_2",
            entity_id="user_102",
            text="Bob deletes personal records from the shard."
        )
    ]
    request = ml_service_pb2.BatchIngestRequest(items=items)
    context = MagicMock()

    response = servicer.IngestBatch(request, context)
    assert len(response.results) == 2
    assert response.results[0].id == "doc_1"
    assert response.results[0].entity_id == "user_101"
    assert len(response.results[0].vector) == 384
    assert len(response.results[0].triplets) >= 1

    assert response.results[1].id == "doc_2"
    assert response.results[1].entity_id == "user_102"
    assert len(response.results[1].vector) == 384
    context.abort.assert_not_called()

def test_ingest_batch_empty_servicer(servicer):
    request = ml_service_pb2.BatchIngestRequest(items=[])
    context = MagicMock()

    response = servicer.IngestBatch(request, context)
    assert len(response.results) == 0
    context.abort.assert_not_called()
