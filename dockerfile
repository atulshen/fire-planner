FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    bash \
    curl \
    wget \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

ENTRYPOINT ["claude"]
