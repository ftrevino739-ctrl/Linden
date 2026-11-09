FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node server.mjs crawler.mjs seeds.txt ./
RUN mkdir -p /data && chown -R node:node /data
ENV NODE_ENV=production
EXPOSE 8787
USER node
CMD ["node", "server.mjs"]
