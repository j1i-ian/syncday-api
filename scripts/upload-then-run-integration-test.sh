#!/bin/bash

PEM_PATH=./syncday.pem

rsync -a -e "ssh -i $PEM_PATH -o StrictHostKeyChecking=no" \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "dist" \
    $(pwd)/.[!.]* \
    $(pwd)/[!.]* \
    $(pwd)/src \
    $(pwd)/scripts \
    $(pwd)/configs \
    $(pwd)/test \
    $(pwd)/typings \
    ubuntu@$1:/home/ubuntu/integration-test/

# Clear
ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "rm integration-test/coverage/integration-junit-report.xml"

# Install dependencies
ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd integration-test && npm install --ignore-scripts"

# Fixing for bcrypt error
ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd integration-test && rm -rf node_modules/bcrypt && npm install bcrypt @nestjs/cli"

# Run integration test
ssh -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1 "cd integration-test && npm run test:integration"

# retrieving test report
scp -o StrictHostKeyChecking=no -i $PEM_PATH ubuntu@$1:/home/ubuntu/integration-test/coverage/integration-junit-report.xml ./integration-junit-report.xml