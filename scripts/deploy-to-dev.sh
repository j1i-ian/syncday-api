#!/bin/bash

PEM_PATH=./syncday.pem

ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd dev-syncday && rm -rf dist"
scp -o StrictHostKeyChecking=no -i $PEM_PATH package.json package-lock.json .env.dev ubuntu@$1:/home/ubuntu/dev-syncday
scp -o StrictHostKeyChecking=no -ri $PEM_PATH $(pwd)/dist ubuntu@$1:/home/ubuntu/dev-syncday/dist

ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd dev-syncday && npm i && pm2 restart --update-env dev-syncday"
