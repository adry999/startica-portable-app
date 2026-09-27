# Imagine minimă pentru startica-sync-server: doar folderul sync-server/, fără nimic
# din src/ (serverul de sincronizare e un pachet separat de aplicația desktop).
FROM node:22-alpine

WORKDIR /app

COPY sync-server/ ./sync-server/

ENV SYNC_BIND=0.0.0.0
ENV SYNC_DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 8790

CMD ["node", "sync-server/src/main.mjs"]
