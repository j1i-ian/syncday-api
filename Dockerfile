FROM keymetrics/pm2:18-alpine

WORKDIR /opt/syncday-api

RUN apk add --no-cache tzdata curl

ENV ENV production
ENV TZ UTC

COPY . .

# RUN npm install
RUN npm install --ignore-scripts --omit=dev

# fixing for bcrypt error
RUN rm -rf node_modules/bcrypt && npm install bcrypt @nestjs/cli

RUN npm run build

EXPOSE 3011

HEALTHCHECK CMD curl localhost:3011/ || exit 1

CMD [ "npm", "run", "start:prod" ]
