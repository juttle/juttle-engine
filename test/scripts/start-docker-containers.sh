#!/bin/bash

# clean up before starting up the containers
docker stop selenium-hub
docker rm selenium-hub
docker stop selenium-node-chrome
docker rm selenium-node-chrome

docker run -d -p 4444:4444 --name selenium-hub selenium/hub:2.48.2
docker run -d --link selenium-hub:hub --name selenium-node-chrome -v /dev/shm:/dev/shm selenium/node-chrome:2.48.2
