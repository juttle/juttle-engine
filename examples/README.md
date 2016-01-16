# Juttle Example Programs Using Outrigger

# Introduction

The README files and juttle programs below this directory show different examples of how you can use Juttle to read from a variety of data sources (backends), process that data, write back to data sources, and visualize data in the browser.

To make it easy to download and run these programs, the instructions rely on docker and docker compose to create an outrigger instance linked to a variety of dependent backends. The linkage is done via juttle adapters.

# tl;dr

Examples                               | Special instructions
-------------------------------------- | --------------------
[core-juttle](core-juttle/README.md)   | No special configuration; examples using http will need network connectivity
[twitter-race](twitter-race/README.md) | To read from a twitter stream, you need to configure credentials in ``juttle-config.json`` file, see [README](twitter-race/README.md)
[elastic-newstracker](elastic-newstracker/README.md) | To read from elasticsearch, this example needs to start additional docker containers, supply its yml file to ``docker-compose``

If you wish to run all available examples, this command will start all necessary docker containers:

```
docker-compose -f dc-outrigger.yml -f elastic-newstracker/dc-elastic.yml up
```

If that worked correctly, you should be able to visit this URL in your browser (if running via docker-machine, replace ``localhost`` with IP of the machine):

```
http://localhost:8080/run?path=/examples/index.juttle
```

Click the links in the rendered table to run juttle programs. The Juttle code is provided in subdirectories in ``*.juttle`` files.

The rest of this README explains the setup in more detail for troubleshooting.

# Setup

## Prerequisites

These instructions assume you have docker and docker-compose installed. You
can also use docker-machine to run docker/docker-compose commands
remotely from a mac.

## Architecture

The [dc-outrigger.yml](./dc-outrigger.yml) file in this directory defines the base
configuration for outriggerd. It contains the outrigger software and
provides a volume mapping from ``$PWD/juttle-config.json`` to
``/opt/outrigger/.juttle-config.json`` within the outrigger container.

The various subdirectories include additional
``dc-<backend>.yml`` files that add additional containers
and configuration. They can be combined with this main docker compose
file to link together outrigger and one or more backends.

## How to run these examples

### (Optional) Get the latest ``juttle/outrigger:latest`` image

If you have run this example in the past, you might have an old
juttle/outrigger:latest image. Ensure you have the latest image by
running:

```
docker pull juttle/outrigger:latest
```

### (Optional) Clean up from a prior session

If you have previously run this example, you probably want to start from
scratch including an empty set of elasticsearch data. To do this, run:

```
docker-compose -f dc-outrigger.yml [-f additional .yml files, see below] stop
docker-compose -f dc-outrigger.yml [-f additional .yml files, see below] rm -v
```

### Run docker-compose with basic .yml file

If you only want to run core juttle programs that do not use any
adapters or backends, the ``docker-compose.yml`` in this directory
contains the necessary configuration. Assuming you are in the
directory where this README is located, simply run:

```
docker-compose -f dc-outrigger.yml up
```

This should always be run from the ``examples/`` directory to ensure
that the relative paths are resolved correctly.

If you're running docker via sudo, you also need to ensure that the
environment variable PWD is the current directory:

```
sudo PWD=$PWD docker-compose -f dc-outrigger.yml up
```

This starts outrigger with all the example .juttle programs below this
directory pre-loaded. Start by visiting
``http://localhost:8080/run?path=/examples/index.juttle``, which will output a
table with links in your browser. Click the links to view the various sets
of example programs.

If you're running using docker-machine, replace localhost with the
value of ``docker-machine ip default``.

### Extending base file with additional backends

If you want to run juttle programs that use backends and adapters (for
example, elasticsearch), you provide additional .yml files on the
docker-compose command line. These are found in the subdirectories
below this directory. For example, to extend the base configuration to
add an elasticsearch backend, run:

```
docker-compose -f dc-outrigger.yml elastic-newstracker/dc-elastic.yml up
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
[juttle-config.json](./juttle-config.json.example) contains a
reference configuration file with a combination of the
``juttle-config.json`` snippets from each subdirectory. Some backends,
like twitter, require custom information such as OAuth tokens, and as
a result are not included in this directory's juttle-config.json.

If you want to simply use the core juttle programs or the adapters
whose config is limited to specifying backends from the docker compose
files, ``juttle-config.json`` will be sufficient.

### Using volume mapping to override built-in juttle programs

If you want to provide your own set of juttle programs to run, modify
[dc-outrigger.yml](./dc-outrigger.yml) to add an entry to the outrigger container's
``volumes`` list. For example, if you have a directory of juttle
programs in ``/home/user/my-juttles`` that you wish to run in outrigger, modify
[dc-outrigger.yml](./dc-outrigger.yml) as follows:

```
outrigger:
...
  volumes:
    - ${PWD}/juttle-config.json:/opt/outrigger/.juttle-config.json
    - /home/user/my-juttles:/opt/outrigger/juttles/my-juttles
```

The programs would then be available at:

```
http://(localhost|docker machine ip):8080/run?path=/my-juttles/<file>.juttle
```

If you want to completely override the built-in set of example juttle
programs with a copy from a git checkout, modify ``outrigger.yml`` as
follows. Assuming you've checked out outrigger to ``/home/user/src/outrigger``:

```
outrigger:
...
  volumes:
    - ${PWD}/juttle-config.json:/opt/outrigger/.juttle-config.json
    - /home/user/src/outrigger/examples:/opt/outrigger/juttles/examples
```

## Additional Information

### Known Problems

#### Can not restart outrigger via docker-compose

Occasionally, when restarting outrigger via docker-compose and docker-machine, after changing the set of mounted volumes, you may see this error:

```
$ docker-compose -f dc-outrigger.yml up
Creating examples_outrigger_1
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
