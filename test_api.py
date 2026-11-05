import json
import os
import pytest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def test_dockerfile_exists_and_configured():
    """Verify Dockerfile exists and contains required production directives."""
    dockerfile_path = BASE_DIR / "Dockerfile"
    assert dockerfile_path.exists(), "Dockerfile does not exist in root directory."
    content = dockerfile_path.read_text(encoding="utf-8")
    assert "python:3.11-slim" in content, "Dockerfile should use python:3.11-slim base image."
    assert "HEALTHCHECK" in content, "Dockerfile must configure a native HEALTHCHECK."
    assert "api:app" in content, "Dockerfile must run the uvicorn api:app entrypoint."
    assert "appuser" in content, "Dockerfile must create and run as a non-root appuser."


def test_dockerignore_exists():
    """Verify .dockerignore exists and excludes sensitive and unnecessary files."""
    dockerignore_path = BASE_DIR / ".dockerignore"
    assert dockerignore_path.exists(), ".dockerignore does not exist in root directory."
    content = dockerignore_path.read_text(encoding="utf-8")
    for pattern in [".git", ".env", "venv", "__pycache__", ".pytest_cache"]:
        assert pattern in content, f".dockerignore should ignore {pattern}"


def test_ecs_task_definition():
    """Verify ecs-task-def.json exists and is properly structured for AWS Fargate."""
    task_def_path = BASE_DIR / "ecs-task-def.json"
    assert task_def_path.exists(), "ecs-task-def.json does not exist in root directory."

    with open(task_def_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data.get("networkMode") == "awsvpc", "ECS task definition must use awsvpc network mode."
    assert "FARGATE" in data.get("requiresCompatibilities", []), "Task definition must require FARGATE."
    assert data.get("cpu") == "256", "ECS task definition CPU must be 256."
    assert data.get("memory") == "512", "ECS task definition memory must be 512."

    container_defs = data.get("containerDefinitions", [])
    assert len(container_defs) > 0, "Container definitions must not be empty."
    container = container_defs[0]
    assert container.get("name") == "recoverpay-api", "Container name must be recoverpay-api."

    ports = [p.get("containerPort") for p in container.get("portMappings", [])]
    assert 8000 in ports, "Container must expose port 8000."
    assert "healthCheck" in container, "Container must have healthCheck defined."
    assert "secrets" in container, "Container must have secrets block."

    secrets = {s.get("name"): s.get("valueFrom") for s in container.get("secrets", [])}
    assert "DATABASE_URL" in secrets, "DATABASE_URL secret must be defined."
    assert "GEMINI_API_KEY" in secrets, "GEMINI_API_KEY secret must be defined."

    log_cfg = container.get("logConfiguration", {})
    assert log_cfg.get("logDriver") == "awslogs", "Log driver must be awslogs."
    assert log_cfg.get("options", {}).get("awslogs-group") == "/ecs/recoverpay-api"


def test_health_endpoint():
    """Verify health endpoint response structure and values."""
    from api import app, health_check

    response = health_check()
    assert response == {"status": "healthy", "service": "RecoverPay-API"}

    # Also verify route registration in FastAPI app
    route_paths = [route.path for route in app.routes]
    assert "/health" in route_paths, "/health endpoint must be registered in FastAPI app."


def test_github_actions_workflow_exists():
    """Verify GitHub Actions CI/CD workflow file exists and has expected triggers and jobs."""
    workflow_path = BASE_DIR / ".github" / "workflows" / "ci-cd.yml"
    assert workflow_path.exists(), "ci-cd.yml does not exist."
    content = workflow_path.read_text(encoding="utf-8")
    assert "build-test-containerize" in content
    assert "deploy-render-and-healthcheck" in content
    assert "aws-ecs-ecr-deploy" in content
    assert "ENABLE_AWS_ECS" in content
    assert "id-token: write" in content


def test_frontend_serving():
    """Verify frontend SPA index.html is served for the root path."""
    from api import serve_frontend
    response = serve_frontend("")
    assert response.status_code == 200
    assert "index.html" in response.path


