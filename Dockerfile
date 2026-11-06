FROM node:20-alpine
WORKDIR /home/node/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .
USER node
EXPOSE 4004
CMD ["npx", "cds-serve"]
