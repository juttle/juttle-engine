# Instructions for using this Dockerfile

The Dockerfile is to create an image containing JSON input files
to be used by postgres_diskstats example. The docker containers
in the example will then load and use the data.

- Copy the files from examples:

```
cp ../../../examples/postgres-diskstats/disks.json .
cp ../../../examples/postgres-diskstats/kbs_metrics.json.zip .
unzip kbs_metrics.json.zip
```

This is needed because Dockerfile doesn't support relative paths.

- Create an image using this Dockerfile to provide a data volume:

```
docker build -t juttle/postgres_diskstats_data .
```

You now have a docker image that can be used in examples/postgres_diskstats.
Using data from the docker volume removes the need for someone to clone our repo
in order to run the example.

The image is ~82M, of which ~38M is the JSON files, and the rest is busybox base image.  

