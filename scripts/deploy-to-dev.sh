#!/bin/bash

PEM_PATH=./syncday.pem

ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd dev-syncday && rm -rf dist"
scp -o StrictHostKeyChecking=no -i $PEM_PATH package.json package-lock.json .env.dev ecosystem.dev.json ubuntu@$1:/home/ubuntu/dev-syncday
scp -o StrictHostKeyChecking=no -ri $PEM_PATH $(pwd)/dist ubuntu@$1:/home/ubuntu/dev-syncday/dist

# Fixing for bcrypt error
ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd dev-syncday && npm install --ignore-scripts"

ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd dev-syncday && rm -rf node_modules/bcrypt && npm install bcrypt @nestjs/cli"

ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd dev-syncday && pm2 restart ecosystem.dev.json --env dev"
