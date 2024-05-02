#!/bin/bash

# intialize submodules
git submodule update --init --checkout -f

npm i -g eslint mocha

npm install

bash scripts/download-gitlab-secret-files.sh

# make migration script directory
mkdir migrations
