from app.services.cover_letter_service import _max_similarity


def test_similarity_identical_texts():
    s = _max_similarity("hello world foo bar", ["hello world foo bar"])
    assert s > 0.9, "Identical texts must show high similarity"


def test_similarity_unrelated_texts():
    s = _max_similarity("python developer backend", ["marketing manager sales"])
    assert s < 0.2, "Unrelated texts must show low similarity"


def test_similarity_empty():
    s = _max_similarity("", [])
    assert s == 0.0
