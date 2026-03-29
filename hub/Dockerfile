FROM python:3.12-slim
WORKDIR /app
RUN pip install fastapi uvicorn httpx asyncpg
COPY hub/ /app/hub/
COPY frontend-react/dist/ /app/frontend/
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()" || exit 1
CMD ["uvicorn", "hub.api:app", "--host", "0.0.0.0", "--port", "8000"]
