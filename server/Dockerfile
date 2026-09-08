FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN python3 -m venv .venv && .venv/bin/pip install --no-cache-dir -r server/requirements.txt
COPY server/ server/
COPY lib/sources.mjs lib/sources.mjs
ENV ORBIT_HOST=0.0.0.0 ORBIT_FFMPEG=/usr/bin/ffmpeg ORBIT_PYTHON=/app/.venv/bin/python
RUN mkdir .media && chown -R node:node /app
USER node
VOLUME ["/app/.media"]
EXPOSE 4318
CMD ["node", "server/index.mjs"]
