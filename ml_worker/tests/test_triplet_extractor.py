import pytest
from triplet_extractor import TripletExtractor

@pytest.fixture(scope="module")
def extractor():
    return TripletExtractor("en_core_web_sm")

def test_empty_or_whitespace_input(extractor):
    assert extractor.extract("") == []
    assert extractor.extract("   \n\t  ") == []
    assert extractor.extract(None) == []

def test_svo_triplet_extraction(extractor):
    text = "Alice developed the algorithm."
    triplets = extractor.extract(text)
    assert len(triplets) >= 1
    
    # Check that at least one triplet contains subject, predicate, object
    first = triplets[0]
    assert "subject" in first
    assert "predicate" in first
    assert "object" in first
    assert first["subject"].lower() == "alice"
    assert "DEVELOP" in first["predicate"]

def test_multi_sentence_extraction(extractor):
    text = "Bob wrote the code. Carol verified the proof."
    triplets = extractor.extract(text)
    assert len(triplets) >= 2

def test_fallback_relation_extraction(extractor):
    # Short sentence with nouns and a verb
    text = "Engine computes shards"
    triplets = extractor.extract(text)
    assert len(triplets) >= 1
    assert any(t["subject"] != "" and t["predicate"] != "" for t in triplets)

def test_single_noun_fallback(extractor):
    text = "Cryptography"
    triplets = extractor.extract(text)
    assert len(triplets) == 1
    assert triplets[0]["subject"] == "Cryptography"
    assert triplets[0]["predicate"] == "ASSOCIATED_WITH"
