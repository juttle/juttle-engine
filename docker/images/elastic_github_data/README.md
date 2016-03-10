# Instructions for using this Dockerfile

Note that the image is already published to docker as juttle/elastic_github_data.
You would only need to follow this step if the dataset had to be changed/regenerated.

- Create a data volume container to hold the elasticsearch data:

```
docker create -v /usr/share/elasticsearch/data --name elastic_github_data busybox
```
- Uncomment the volumes_from: lines in github-tutorial/dc-elastic-loadfromscratch.yml
- Run everything in docker-compose:

```
docker-compose -f dc-juttle-engine.yml -f github-tutorial/dc-elastic-loadfromscratch.yml up
```

- Wait for the Juttle program that reads data from s3 to fully load it into elasticsearch (29MB, 216158 records).
- Wait a bit longer to make sure that elasticsearch has fully indexed the data.
- This can take many minutes!!
- Stop everything in docker-compose:

```
docker-compose -f dc-juttle-engine.yml -f github-tutorial/dc-elastic-loadfromscratch.yml rm -v
```

(Note: this will not remove the elastic_github_data container you created as it is not included directly in the docker-compose files).

- In this directory, copy the data directory from the elastic_github_data container to the current directory:

```
docker cp elastic_github_data:/usr/share/elasticsearch/data data
```

- Create an image using that data:

```
docker build -t juttle/elastic_github_data
```

You now have a docker image that can be combined with elasticsearch
images to result in pre-loaded elasticsearch contents. This reduces
docker-compose start time to seconds from minutes.

The image is ~370M, but most of that is because it's based on
elasticsearch (~345M), so when downloaded along with elasticsearch
only the ~25M should be actually downloaded.

