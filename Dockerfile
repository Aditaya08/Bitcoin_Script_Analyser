# Build stage
FROM rust:1.87-slim AS builder

# Install build dependencies for openssl-sys
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy the entire workspace
COPY . .

# Build the release binary
RUN cargo build --release -p btc-api

# Run stage
FROM debian:bookworm-slim

# Install SSL certificates for Blockstream API requests
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /usr/src/app/target/release/btc-api .

# Expose the port
EXPOSE 4000

# Set environment
ENV PORT=4000

# Run the binary
CMD ["./btc-api"]
