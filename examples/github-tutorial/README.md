# Juttle Tutorial: GitHub Data

# Setup

This set of example Juttle programs goes with the [Juttle Tutorial](http://juttle.github.io/juttle/concepts/juttle_tutorial/) targeting new developers. Second part of the tutorial uses a 6-month GitHub repo activity dataset loaded into Elasticsearch (size 29MB, 216158 records). This docker container provides ES with preloaded data.

## Additional docker-compose configuration

[dc-elastic.yml](./dc-elastic.yml) in the current directory adds the following containers:

- elastic_github_tutorial_data, a container containing a pre-loaded elasticsearch data directory containing the GitHub data
- elasticsearch

If one ever needs to start from scratch (this should not be necessary), there is also an alternate
docker-compose configuration
[dc-elastic-loadfromscratch.yml](./dc-elastic-loadfromscratch.yml)
that loads the raw data into elasticsearch from S3 via Juttle, when the
docker-compose environment is started. The data loading takes a while.

## ``juttle-config.json`` configuration

``juttle-config.json`` in the parent directory already contains the necessary configuration for the juttle-elastic-adapter to communicate with elasticsearch. It does not require any modification.

Note that the GitHub elasticsearch container is listed first in the set of elastic instances, so that tutorial programs can `read elastic` without specifying its id, for simplicity.

## Juttle Programs

To run any of these programs, just visit
``http://(localhost|docker machine ip):8080/?path=/examples/github-tutorial/index.juttle``, which will output a
table with links in your browser. Click the links to run the example programs.

For more context, follow the text of the [tutorial](http://juttle.github.io/juttle/concepts/juttle_tutorial/).
