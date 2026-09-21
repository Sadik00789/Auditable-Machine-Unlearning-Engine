import math
import pytest
from embedder import Embedder

@pytest.fixture(scope="module")
def embedder():
    return Embedder("all-MiniLM-L6-v2")

def test_embedder_empty_input_raises_error(embedder):
    with pytest.raises(ValueError, match="Input text cannot be empty"):
        embedder.encode("")

    with pytest.raises(ValueError, match="Input text cannot be empty"):
        embedder.encode("   ")

def test_embedder_single_encode_dimensions(embedder):
    text = "Machine unlearning with SISA architecture and Merkle receipts."
    vector = embedder.encode(text)

    # MiniLM produces 384-dimensional embeddings
    assert isinstance(vector, list)
    assert len(vector) == 384
    assert all(isinstance(val, float) for val in vector)

    # Normalized embedding has L2 norm close to 1.0
    l2_norm = math.sqrt(sum(x * x for x in vector))
    assert pytest.approx(l2_norm, abs=1e-3) == 1.0

def test_embedder_batch_encoding(embedder):
    texts = [
        "First document about vector indexing.",
        "Second document about cryptographic proofs.",
        "Third document describing zero-copy LanceDB.",
    ]
    vectors = embedder.encode_batch(texts)

    assert len(vectors) == 3
    for vec in vectors:
        assert len(vec) == 384

def test_embedder_batch_empty_list(embedder):
    assert embedder.encode_batch([]) == []
