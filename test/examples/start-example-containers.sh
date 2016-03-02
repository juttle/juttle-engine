#!/bin/bash
#
# helper script to start/stop example docker containers
#

pushd examples

docker-compose -f dc-juttle-engine.yml \
               -f cadvisor-influx/dc-cadvisor-influx.yml \
               stop

docker-compose -f dc-juttle-engine.yml \
               -f cadvisor-influx/dc-cadvisor-influx.yml \
               rm -f

docker-compose -f dc-juttle-engine.yml \
               -f cadvisor-influx/dc-cadvisor-influx.yml \
               up -d

popd
