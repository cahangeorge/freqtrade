FROM python:3.11-slim

# System deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
COPY src /app/src

# Default config mount location
RUN mkdir -p /app/config

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Run migrations then start
CMD ["bash", "-lc", "alembic upgrade head && uvicorn src.main:app --host 0.0.0.0 --port 8000"]
