# Memes Elastic Demo

# Setup

## Pull Docker Images

We'll start by pulling the required docker images for this demo: 

```
docker pull elasticsearch:2.1.1
docker pull logstash:2.1.1
docker pull outrigger:latest
```

## Start Docker Containers

Then we have to spin up the elasticsearch container and the outrigger container:

```
docker run -d --name elastic elasticsearch:2.1.1
docker run -d -p 8080:8080 -v `pwd`/juttles:/opt/juttles -v `pwd`:/opt/outrigger --link elastic:eshost --name outrigger outrigger
```

The first line runs the elasticsearch container as is while the second container
is the outrigger container running with the local `.juttle-config.json` exposed to 
the outrigger process which sets up the necessary config to talk to the elastic
container over the link `eshost`. The link is done through that
`--link elastic:eshost` option to docker which takes care of making it possible
for the outrigger talk to the elastic container over the hostname `eshost`.

## Load Demo Data

Unzip the memes_data.zip and then use logstash to load this data into your
running elasticsearch container:

```
cat memes_data.json | docker run -i --rm -v `pwd`:/config --link elastic:eshost logstash:2.1.1 -f /config/logstash.conf
```

*Note:* the previous command will take several minutes to execute as we're
loading quite a bit of data into elasticsearch and you can proceed with the 
next steps while this is running.

## Verify Data

To verify that the outrigger container can in fact reach the elastic search
container just use the following docker command to execute the juttle CLI:

```
docker exec outrigger juttle -e "read elastic -from :2009-04-01: -to :2009-05-01: | reduce count()"
```

*Note:* you can run the above command while the data is loading to see
exactly how much data has already been ingested.

And you should see the output:

```
┌───────────┐
│ count     │
├───────────┤
│ 1200500   │
└───────────┘
```
