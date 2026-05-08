FROM node:20-alpine
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
RUN npm i -g @sap/cds-dk
RUN npm install pg @cap-js/postgres --save
RUN npm install @sap/xssec
COPY --chown=node:node . .
RUN cds build
EXPOSE 4004
CMD ["sh", "-c", "cds run"]