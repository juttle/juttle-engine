# Juttle Example Programs Using juttle-engine

# Introduction

The README files and juttle programs below this directory show different examples of how you can use Juttle to read from a variety of data sources (backends), process that data, write back to data sources, and visualize data in the browser.

To make it easy to download and run these programs, the instructions rely on docker and docker compose to create a juttle-engine instance linked to a variety of dependent backends. The linkage is done via juttle adapters.

# tl;dr

Examples                               | Special instructions
-------------------------------------- | --------------------
[core-juttle](core-juttle/README.md)   | No special configuration; examples using http will need network connectivity
[twitter-race](twitter-race/README.md) | To read from a twitter stream, you need to configure credentials in ``juttle-config.json`` file, see [README](twitter-race/README.md)
[elastic-newstracker](elastic-newstracker/README.md) | To read from elasticsearch, this example needs to start additional docker containers, supply its yml file to ``docker-compose``
[gmail](gmail/README.md) | To read from/write to gmail, you need to configure credentials in ``juttle-config.json`` file, see [README](gmail/README.md)
[postgres-diskstats](postgres-diskstats/README.md) | Supply the yml file to ``docker-compose`` to start additional containers to read from PostgreSQL
[cadvisor-influx](cadvisor-influx/README.md) | Supply the yml file to ``docker-compose`` to start additional containers to read from InfluxDB
[aws-cloudwatch](aws-cloudwatch/README.md) | To read from AWS/Cloudwatch, you need to configure credentials in ``juttle-config.json``, see [README](aws-cloudwatch/README.md)
[github-tutorial](github-tutorial/README.md) | To read from elasticsearch, the tutorial needs to start additional docker container, supply its yml file to ``docker-compose``

If you wish to run all available examples, this command will start all necessary docker containers:

```
docker-compose -f dc-juttle-engine.yml -f elastic-newstracker/dc-elastic.yml -f cadvisor-influx/dc-cadvisor-influx.yml -f postgres-diskstats/dc-postgres.yml -f github-tutorial/dc-elastic.yml up
```

If that worked correctly, you should be able to visit this URL in your browser (if running via docker-machine, replace ``localhost`` with IP of the machine):

```
http://localhost:8080/?path=/examples/index.juttle
```

Click the links in the rendered table to run juttle programs. The Juttle code is provided in subdirectories in ``*.juttle`` files.

The rest of this README explains the setup in more detail for troubleshooting.

# Setup

## Prerequisites

These instructions assume you have docker and docker-compose installed. You
can also use docker-machine to run docker/docker-compose commands
remotely from a mac.

## Architecture

The [dc-juttle-engine.yml](./dc-juttle-engine.yml) file in this
directory defines the base configuration for juttle-engine. It
contains the juttle-engine software and provides a volume mapping from
``$PWD/juttle-config.json`` to ``/opt/juttle-engine/.juttle-config.json``
within the juttle-engine container.

The various subdirectories include additional
``dc-<backend>.yml`` files that add additional containers
and configuration. They can be combined with this main docker compose
file to link together juttle-engine and one or more backends.

## How to run these examples

### (Optional) Get the latest ``juttle/juttle-engine:latest`` image

If you have run this example in the past, you might have an old
juttle/juttle-engine:latest image. Ensure you have the latest image by
running:

```
docker pull juttle/juttle-engine:latest
```

### (Optional) Clean up from a prior session

If you have previously run this example, you probably want to start from
scratch including an empty set of elasticsearch data. To do this, run:

```
docker-compose -f dc-juttle-engine.yml [-f additional .yml files, see below] stop
docker-compose -f dc-juttle-engine.yml [-f additional .yml files, see below] rm -v
```

### Run docker-compose with basic .yml file

If you only want to run core juttle programs that do not use any
adapters or backends, the ``dc-juttle-engine.yml`` in this directory
contains the necessary configuration. Assuming you are in the
directory where this README is located, simply run:

```
docker-compose -f dc-juttle-engine.yml up
```

This should always be run from the ``examples/`` directory to ensure
that the relative paths are resolved correctly.

If you're running docker via sudo, you also need to ensure that the
environment variable PWD is the current directory:

```
sudo PWD=$PWD docker-compose -f dc-juttle-engine.yml up
```

This starts juttle-engine with all the example .juttle programs below this
directory pre-loaded. Start by visiting
``http://localhost:8080/?path=/examples/index.juttle``, which will output a
table with links in your browser. Click the links to view the various sets
of example programs.

If you're running using docker-machine, replace localhost with the
value of ``docker-machine ip default``.

### Extending base file with additional backends

If you want to run juttle programs that use backends and adapters (for
example, elasticsearch), you provide additional .yml files on the
docker-compose command line. These are found in the subdirectories
below this directory. For example, to extend the base configuration to
add an elasticsearch, influx and postgres backends, run:

```
docker-compose -f dc-juttle-engine.yml -f elastic-newstracker/dc-elastic.yml -f cadvisor-influx/dc-cadvisor-influx.yml -f postgres-diskstats/dc-postgres.yml up
```

Not every adapter requires additional containers (for example,
twitter), in which case the subdirectory will not contain any
additional ``.yml`` file.

### Configuring juttle adapters

Depending on the backends you choose to use, the corresponding
adapters require appropriate configuration in
``juttle-config.json``. Each subdirectory's README contains
instructions on the necessary configuration to add to the juttle
config file.

Additionally, in this directory
[juttle-config.json](./juttle-config.json) contains a
reference configuration file with a combination of the
``juttle-config.json`` snippets from each subdirectory. Some backends,
like twitter, require custom information such as OAuth tokens, and as
a result are not included in this directory's juttle-config.json.

Note that multiple instances of elastic adapter are used,
referencing different containers that run Elasticsearch.
Keep the `github` instance at the top of the list, so it will be the
default, and Juttle Tutorial programs can `read elastic` without `-id`.

If you want to simply use the core juttle programs or the adapters
whose config is limited to specifying backends from the docker compose
files, ``juttle-config.json`` will be sufficient.

### Using volume mapping to override built-in juttle programs

If you want to provide your own set of juttle programs to run, modify
[dc-juttle-engine.yml](./dc-juttle-engine.yml) to add an entry to the
juttle-engine container's ``volumes`` list. For example, if you have a
directory of juttle programs in ``/home/user/my-juttles`` that you
wish to run in juttle-engine, modify
[dc-juttle-engine.yml](./dc-juttle-engine.yml) as follows:

```
juttle-engine:
...
  volumes:
    - ${PWD}/juttle-config.json:/opt/juttle-engine/.juttle-config.json
    - /home/user/my-juttles:/opt/juttle-engine/juttles/my-juttles
```

The programs would then be available at:

```
http://(localhost|docker machine ip):8080/?path=/my-juttles/<file>.juttle
```

If you want to completely override the built-in set of example juttle
programs with a copy from a git checkout, modify ``dc-juttle-engine.yml`` as
follows. Assuming you've checked out juttle-engine to ``/home/user/src/juttle-engine``:

```
juttle-engine:
...
  volumes:
    - ${PWD}/juttle-config.json:/opt/juttle-engine/.juttle-config.json
    - /home/user/src/juttle-engine/examples:/opt/juttle-engine/juttles/examples
```

## Additional Information

### Known Problems

#### Can not restart juttle-engine via docker-compose

Occasionally, when restarting juttle-engine via docker-compose and docker-machine, after changing the set of mounted volumes, you may see this error:

```
$ docker-compose -f dc-juttle-engine.yml up
Creating examples_juttle-engine_1
ERROR: Cannot start container bdef23b0ad98d959ac2fba061488471732ba085c11cd3c74d20839341c710919: [8] System error: not a directory
```

The problem appears to be related to a stale volume path. Restarting your docker-machine fixes the problem.

#### Don't use /tmp as the host path with docker-machine

When using docker-machine, remember that the path used for volume
mounts is a path within the Boot2Docker VM. For that reason, host
mounts of paths below /tmp will refer to the VM and not your Mac/etc
host. See
[this github page](https://github.com/docker/compose/issues/1039) for
more details.

### Development & Debugging

By default the `docker-compose` files expose the underlying data source
ports by choosing a random host port. You may want to connect directly to
the exposed port to diagnose problems and debug juttle programs. To see which
ports are exposed, you can use `docker-compose` like so:

```
> docker-compose -f dc-juttle-engine.yml -f aws-cloudwatch/dc-aws-cloudwatch.yml -f cadvisor-influx/dc-cadvisor-influx.yml -f elastic-newstracker/dc-elastic-loadfromscratch.yml -f nginx_logs/dc-nginx-logs.yml -f postgres-diskstats/dc-postgres.yml ps
Name                            Command               State                                   Ports
------------------------------------------------------------------------------------------------------------------------------------------------
examples_cadvisor_1               /usr/bin/cadvisor -logtost ...   Up       0.0.0.0:32776->8080/tcp
examples_elasticsearch-nginx_1    /docker-entrypoint.sh elas ...   Up       0.0.0.0:32777->9200/tcp, 9300/tcp
examples_elasticsearch-news_1          /docker-entrypoint.sh elas ...   Up       0.0.0.0:32778->9200/tcp, 9300/tcp
examples_influxdb_1               /run.sh                          Up       0.0.0.0:32775->8083/tcp, 0.0.0.0:32774->8086/tcp, 8090/tcp, 8099/tcp
examples_juttle-aws-poller_1      bash -c sleep 40 && echo ' ...   Up       8080/tcp
examples_juttle-engine_1          /bin/sh -c /opt/juttle-eng ...   Up       0.0.0.0:8080->8080/tcp
examples_juttle-engine_loader_1   bash /config/loadfromscrat ...   Up       8080/tcp
examples_logstash-nginx_1         /docker-entrypoint.sh bash ...   Up
examples_logstash_1               /docker-entrypoint.sh bash ...   Exit 0
examples_mysql-createdb_1         /entrypoint.sh bash -c sle ...   Up       3306/tcp
examples_mysql_1                  /entrypoint.sh mysqld            Up       0.0.0.0:32779->3306/tcp
examples_postgres_1               /docker-entrypoint.sh postgres   Up       0.0.0.0:32780->5432/tcp
examples_postgres_data_1          /bin/sh -c tail -f /dev/null     Up
```

As you can see above the instance for the `postgres-diskstats` example has the
**postgres** database listening on the host at port `32780` which means you can
connect to that **postgres** instance listening on that port to see what is
actually stored int that **postgres** instance.
