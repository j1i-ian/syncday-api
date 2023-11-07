#!/bin/bash

# intialize submodules
git submodule update --init --checkout -f

# make migration script directory
mkdir migrations
