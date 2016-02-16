# juttle-engine Docker Image

# Building

To build simply run:

```
sh build.sh
```

in the directory this README is currently in.

# Running

To run juttle-engine within docker simply run:

```
docker run -d -p 8080:8080 --name juttle-engine juttle/juttle-engine:latest
```

The above exposes the only port necessary to talk between your local
browser and juttle-engine.

The juttle-engine image also includes a collection of example juttle
programs. For more information on how to run those programs, see the
[examples README](../../examples/README.md).

# Check Container Logs

While the container is running in daemon mode (`-d` specified above) you can use

```
docker logs -f juttle-engine
```

to see the output that juttle-engine has written and with the `-f`
option you'll watch the output live as its being written.

# Removing Docker Container

To stop the container simply run:

```
docker stop juttle-engine
```

To remove that container so you can spin up a new `juttle-engine` image just use

```
docker rm juttle-engine
```
