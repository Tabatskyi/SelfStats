.PHONY: up down build update logs status help

help:
	@echo "SelfStats Management Commands:"
	@echo "  make up       - Start all containers in background"
	@echo "  make down     - Stop all containers"
	@echo "  make build    - Build/rebuild container images"
	@echo "  make update   - Update git submodules and apply patches"
	@echo "  make logs     - View container logs"
	@echo "  make status   - Check container status"

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

update:
	./scripts/apply-patches.sh

logs:
	docker compose logs -f

status:
	docker compose ps
