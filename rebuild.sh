#!/usr/bin/bash

set -x

docker-compose stop
docker-compose rm -f

git pull
docker-compose build

docker-compose up -d