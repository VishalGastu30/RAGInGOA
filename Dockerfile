FROM python:3.10-slim

# Hugging Face Spaces require running as a non-root user (uid 1000)
RUN useradd -m -u 1000 user

WORKDIR /app

# Install system dependencies required for psycopg2 (PostgreSQL) and other scientific packages
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy requirements and install them
COPY --chown=1000:1000 backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create cache directory for HuggingFace models to prevent permission errors
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface \
    HF_HOME=/app/.cache/huggingface \
    PYTHONPATH=/app/backend

RUN mkdir -p /app/.cache/huggingface && chown -R 1000:1000 /app/.cache

# Copy the backend code, making sure user 1000 owns it (needed for local SQLite fallback if applicable)
COPY --chown=1000:1000 backend /app/backend

# Switch to the non-root user
USER 1000

# Expose the port Hugging Face Spaces expects
EXPOSE 7860

# Start FastAPI server on port 7860
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
