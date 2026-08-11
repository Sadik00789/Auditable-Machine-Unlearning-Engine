# Multi-stage Python 3.11 build for ML Worker gRPC Service
FROM python:3.11-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download SentenceTransformer model into container during build phase
RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

FROM python:3.11-slim

WORKDIR /app

COPY --from=builder /root/.local /root/.local
COPY --from=builder /root/.cache /root/.cache

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

COPY . /app

EXPOSE 50051

CMD ["python", "main.py"]
