FROM keymetrics/pm2:18-alpine

WORKDIR /opt/syncday-backend-api

RUN apk add --no-cache tzdata curl

ENV ENV production

COPY . .

RUN npm install --ignore-scripts

RUN npm run build

EXPOSE 3011

HEALTHCHECK CMD curl localhost:3011/ || exit 1

CMD [ "npm", "run", "start:prod" ]
