FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssh-client git && rm -rf /var/lib/apt/lists/*
RUN pip install fastapi uvicorn httpx asyncpg bcrypt "langfuse>=3.0.0,<4.0.0" pyyaml pyjwt
COPY hub/ /app/hub/
COPY prompts/ /app/prompts/
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()" || exit 1
CMD ["uvicorn", "hub.api:app", "--host", "0.0.0.0", "--port", "8000"]
