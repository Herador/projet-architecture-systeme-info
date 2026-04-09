# Rental App - Microservices

## Demarrage rapide

```bash
cp .env.example .env
docker-compose up --build
```

## Acces

| Service       | URL                        |
|---------------|----------------------------|
| Frontend      | http://localhost:5173       |
| API Gateway   | http://localhost:3000       |
| RabbitMQ UI   | http://localhost:15672      |

## Structure

- `shared/`      : models.py et database.py partages par tous les services
- `services/`    : les 6 microservices FastAPI
- `gateway/`     : point d'entree unique FastAPI
- `frontend/`    : application React
