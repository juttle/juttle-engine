# Outrigger Docker Image

# Building

To build simply run:

```
sh build.sh
```

in the directory this README is currently in.

# Running

To run the outrigger server simply run:

```
docker run -d -p 8080:8080 --name outrigger juttle/outrigger:latest
```

The above exposes the only port necessary to talk between your local
browser and the outriggerd server. By default, all juttle files below
the ``outrigger/examples`` directory are included with the image, so
for demo purposes so you can then use the following link to run the
"Hello World" juttle program:

```
http://<docker_machine_ip>:8080/?path=/examples/core-juttle/hello_world.juttle
```

**docker_machine_ip** on mac/windows is the ip of the virtual machine running
the docker container but on linux this is simply `localhost`.

To use your own custom `juttle-config.json/js` simply expose the path to your
juttle config file like so:

```
docker run -d -p 8080:8080 -v <path-to-juttle-config.json>:/opt/outrigger/.juttle-config.json --name outrigger juttle/outrigger:latest
```

Since `/opt/outrigger` is setup to be the working directory when running the
outrigger image then outrigger will read the juttle config file if its present
in that same directory.

If you want to run a custom set of juttle programs, mount them in to a directory below /opt/outrigger/juttles, for example:

```
docker run -d -p 8080:8080 -v ./my-juttles:/opt/outrigger/juttles/my-juttles --name outrigger juttle/outrigger:latest
```

The juttle programs below ./my-juttles will be accesible via urls of the form ``http://localhost:8080/?path=/my-juttles/...``.

# Check Container Logs

While the container is running in daemon mode (`-d` specified above) you can use

```
docker logs -f outrigger
```

to see the output that the outriggerd server has written and with the `-f`
option you'll watch the output live as its being written.

# Removing Docker Container

To stop the container simply run:

```
docker stop outrigger
```

and remove that container so you can spin up a new `outrigger` image just use

```
docker rm outrigger
```
