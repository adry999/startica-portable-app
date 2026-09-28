# Imagine minimă pentru startica-sync-server: doar folderul sync-server/, fără nimic
# din src/ (serverul de sincronizare e un pachet separat de aplicația desktop).
FROM node:22-alpine

WORKDIR /app

COPY sync-server/ ./sync-server/

ENV SYNC_BIND=0.0.0.0
ENV SYNC_DATA_DIR=/data

# Nu rulează ca root (D-10): imaginea de bază are deja userul „node” (uid 1000);
# /data e volumul montat de docker-compose, trebuie să fie scriibil de acel user.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

VOLUME ["/data"]

EXPOSE 8790

CMD ["node", "sync-server/src/main.mjs"]
