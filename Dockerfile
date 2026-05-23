FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/

RUN useradd --uid 1000 --create-home ubuntu

WORKDIR /app
RUN chown ubuntu:ubuntu /app

USER ubuntu

# Install dependencies before copying source for better layer caching.
ENV UV_LINK_MODE=copy
COPY --chown=ubuntu:ubuntu pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY --chown=ubuntu:ubuntu . .

CMD ["sh", "/app/entrypoint.sh"]
