#!/bin/bash

# intialize submodules
git submodule update --init --checkout -f

npm i -g eslint mocha

# make migration script directory
mkdir migrations
