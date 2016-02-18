#!/bin/bash

docker stop selenium-hub
docker stop selenium-node-chrome

docker wait selenium-hub
docker wait selenium-node-chrome

docker rm selenium-hub
docker rm selenium-node-chrome
