# Outrigger Docker Image

# Building

To build simply run:

```
docker build -t outrigger .
``` 

in the directory this README is currently in.

# Running

To run the outrigger server simply run:

```
docker run -d -p 8080:8080 -v `pwd`/juttles:/opt/juttles --name outrigger outrigger
```

The above exposes the only port  necessary to talk between your local browser
and the outriggerd server and also exposes the juttles directory found here
for demo purposes so you can then use the following link to run the
"Hello World" juttle program:

Now hit the following URL in your browser:

    http://<docker_machine_ip>:8080/run?path=/opt/juttles/hello_world.juttle

**docker_machine_ip** on mac/windows is the ip of the virtual machine running
the docker container but on linux this is simply `localhost`.

To use your own custom `juttle-config.json/js` simply expose the path to your 
juttle config file like so:

```
docker run -d -p 8080:8080 -v `pwd`/juttles:/opt/juttles -v `pwd`:/opt/outrigger --name outrigger outrigger
```

Since `/opt/outrigger` is setup to be the working directory when running the
outrigger image then outrigger will read the juttle config file if its present
in that same directory.

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
