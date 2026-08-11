import logging
from typing import List
import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger("ml_worker.embedder")

class Embedder:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Initializing SentenceTransformer '{model_name}' on device: {self.device}")
        try:
            self.model = SentenceTransformer(model_name, device=self.device)
        except Exception as e:
            logger.critical(f"Failed to load embedding model '{model_name}': {e}")
            raise e

    def encode(self, text: str) -> List[float]:
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty.")
        try:
            vector = self.model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
            return vector.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            raise e

    def encode_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        try:
            vectors = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True, batch_size=32)
            return vectors.tolist()
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {e}")
            raise e