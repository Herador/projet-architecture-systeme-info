FROM python:3.11-slim
WORKDIR /app
COPY shared/models.py .
COPY shared/database.py .
COPY services/admin-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/admin-service/app/ ./app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
