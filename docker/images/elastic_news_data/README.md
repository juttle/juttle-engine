#Instructions for using this Dockerfile

- Create a data volume container to hold the elasticsearch data:

```
docker create -v /usr/share/elasticsearch/data --name elastic_news_data busybox
```
- Uncomment the volumes_from: lines in dc-elastic-loadfromscratch.yml
- Run everything in docker-compose:

```
docker-compose -f dc-outrigger.yml -f elastic-newstracker/dc-elastic-loadfromscratch.yml up
```

- Wait for logstash to fully populate the file into elasticsearch.
- Wait a bit longer to make sure that elasticsearch has fully indexed the data
- Stop everything in docker-compose:

```
docker-compose -f dc-outrigger.yml -f elastic-newstracker/dc-elastic-loadfromscratch.yml rm -v
```

(Note: this will not remove the elastic_news_data container you created as it is not included directly in the docker-compose files).

- In this directory, copy the data directory from the elastic_news_data container to the current directory:

```
docker cp elastic_news_data:/usr/share/elasticsearch/data data
```

- Create an image using that data:

```
docker build -t juttle/elastic_news_data
```

You now have a docker image that can be combined with elasticsearch
images to result in pre-loaded elasticsearch contents. This reduces
docker-compose start time to seconds from minutes.

The image is ~440M, but most of that is because it's based on
elasticsearch (~345M), so when downloaded along with elasticsearch
only the ~100M should be actually downloaded.

