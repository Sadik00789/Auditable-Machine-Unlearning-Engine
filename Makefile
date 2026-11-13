.PHONY: all build test test-rust test-ml test-frontend clean

all: build test

build:
	cd rust_gateway && cargo build
	cd frontend && npm run build

test: test-rust test-ml test-frontend

test-rust:
	cd rust_gateway && cargo test -- --test-threads=1

test-ml:
	cd ml_worker && python -m pytest -v tests/

test-frontend:
	cd frontend && npx tsc --noEmit && npm test

clean:
	cd rust_gateway && cargo clean
	rm -rf frontend/.next

