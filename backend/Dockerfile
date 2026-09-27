FROM python:3.11-slim

WORKDIR /app

# Flush logs immediately (Railway shows nothing until the buffer fills otherwise)
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
