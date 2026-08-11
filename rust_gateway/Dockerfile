# Multi-stage Dockerfile for Rust Axum Gateway Service
FROM rust:1.78-slim-bookworm as builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    protobuf-compiler \
    pkg-config \
    libssl-dev \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace proto definitions and Cargo configs
COPY proto /app/proto
COPY rust_gateway /app/rust_gateway

WORKDIR /app/rust_gateway

RUN cargo build --release

# Final runtime image
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/rust_gateway/target/release/rust_gateway /app/rust_gateway

ENV RUST_LOG=info
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8080

EXPOSE 8080

CMD ["/app/rust_gateway"]
