# Elastic Demo: Analyzing Internet News

# Setup

This demo loads a data set of Internet news snippets from April 2009, collected by Memetracker (see [data source](#data-source)), into ElasticSearch, then uses Juttle with elastic adapter to read this data, search the news, compute aggregations, and visualize in the browser. The demo uses docker containers and maps local Juttle programs to be run inside the `outrigger` container.

## Prerequisites

Run docker machine:

```
docker-machine start default
eval "$(docker-machine env default)"
```

Add docker machine IP to your /etc/hosts as `docker-local` hostname (we will use it in URLs):

```
echo "`docker-machine ip default`    docker-local" >> /etc/hosts
```

## Pull Docker Images

We'll start by pulling the required docker images for this demo: 

```
docker pull elasticsearch:2.1.1
docker pull logstash:2.1.1
docker pull juttle/outrigger:latest
```

## Start Docker Containers

Then we have to spin up the elasticsearch container and the outrigger container:

```
docker run -d --name elastic elasticsearch:2.1.1
docker run -d -p 8080:8080 -v `pwd`/juttles:/opt/juttles -v `pwd`:/opt/outrigger --link elastic:eshost --name outrigger juttle/outrigger
```

Make sure to run the above command from the directory where this README is located.
The outrigger container will map the local `.juttle-config.json` file so it can talk to
the elastic container over the named link `eshost`. The juttle programs will be accessible inside the container at `/opt/juttles` mount point.

To verify that the outrigger container can in fact reach the elastic search container, run this juttle query via CLI inside `outrigger`:

```
docker exec outrigger juttle -e "read elastic -from :2009-04-01: -to :2009-05-01: | reduce count()"
```

At this point, there is no data in elasticsearch, therefore you should see zero count of records.

## Load Demo Data

Unzip the memes_data.zip and then use logstash to load this data into your running elasticsearch container:

```
unzip memes_data.zip
cat memes_data.json | docker run -i --rm -v `pwd`:/config --link elastic:eshost logstash:2.1.1 -f /config/logstash.conf -w 4
```

*Note:* the previous command will take several minutes to execute as we're
loading quite a bit of data into elasticsearch. Proceed with the next steps while this is running.

## Verify Data

While data is being ingested, re-running the Juttle query should show a rising count of records.

```
docker exec outrigger juttle -e "read elastic -from :2009-04-01: -to :2009-05-01: | reduce count()"
```

When ingest has completed, you should see the output:

```
┌───────────┐
│ count     │
├───────────┤
│ 1200500   │
└───────────┘
```


## Juttles

For easy navigation of the Juttle programs, run this one, which will output a table with links in your browser. Click the links to run the demo programs. They will work assuming you added 'docker-local' entry to your `/etc/hosts`.

```
docker exec outrigger outrigger-client run --path /opt/juttles/index.juttle
```

### Search the news

First let's run a program that will let us enter a search term, then display daily counts of news snippets containing that term, as a timechart; and additionally display a table of matching meme phrases. This UI, reminiscent of the home page of Kibana, is implemented in a dozen lines of Juttle.

[kibana_lite.juttle](kibana_lite.juttle)

[Click to run this Juttle](http://docker-local:8080/run?path=/opt/juttles/kibana_lite.juttle)

### Compute daily emotional temperature

Now let's attempt a deeper analysis of the data, assessing the emotional "temperature" of the Internet memes for each day. The terms used as emotion markers can be easily edited from input controls; to have more than 4, expand the set in the Juttle code.

[emotional_temp.juttle](emotional_temp.juttle)

[Click to run this Juttle](http://docker-local:8080/run?path=/opt/juttles/emotional_temp.juttle)

### Top ten popular sites

Let's also get the top 10 linked-to pages for a given day to see which sites were popular. Note that ideally, the day would be a user input, but input control of type 'Date' is [not yet supported](https://github.com/juttle/juttle/issues/50).

[top_linked_pages.juttle](top_linked_pages.juttle)

[Click to run this Juttle](http://docker-local:8080/run?path=/opt/juttles/top_linked_pages.juttle)

### Top ten calculation via rollup

If we attempt to run this program for a longer time interval or on a larger data set, it will eventually hit memory limits and/or get too slow for the human patience.

In such cases, the better approach is to run a Juttle program that will perform the desired computation over granular subsets of the data, and write out the results to the storage backend (we call this "rollup"), so subsequent programs can query this precomputed data instead of the raw data.

The elastic adapter for Juttle supports writing to ElasticSearch as well as reading from it.

This rollup program will compute top 100 linked-to pages for each day and write the results out to ES (100 instead of 10 to minimize loss of fidelity). Since it has no visual output, let's run it from the CLI:

```
docker exec outrigger juttle top_linked_pages_write_rollup.juttle
```

[top_linked_pages_write_rollup.juttle](top_linked_pages_write_rollup.juttle)

Now this program can read the rolled-up data tagged with field `tag: 'top-linked-to'`
and give us top 10 linked-to pages for the whole month of April 2009 quickly. Notice that the program logic is different, it needs to sum up the counts from the rollups before sorting and giving us top 10.

[top_linked_pages_read_rollup.juttle](top_linked_pages_read_rollup.juttle)

[Click to run this Juttle](http://docker-local:8080/run?path=/opt/juttles/top_linked_pages_read_rollup.juttle)

### DIY Juttle

If you wish to try running your own Juttle programs against this data, simply add a file into `juttles` directory, let's say `my.juttle`, write code, save the file, then access the URL in the browser.

A good way to start is something like this, to see a few data points:

```
read elastic -from :2009-04-30: -to :2009-05-01:
| head 10
```

[Click to run my Juttle](http://docker-local:8080/run?path=/opt/juttles/my.juttle)

If this seems daunting, we have a tutorial!

## Data Source

https://snap.stanford.edu/data/memetracker9.html

The original source has 96 million news snippets from the Memetracker. Memetracker tracks the quotes and phrases that appear most frequently over time across this entire online news spectrum. This makes it possible to see how different stories compete for news and blog coverage each day, and how certain stories persist while others fade quickly.

We have taken a subset of the data (1.2 mln entries from April 2009) and converted the data from its original format to JSON.

Original Data Format:
```
P       http://blogs.abcnews.com/politicalpunch/2008/09/obama-says-mc-1.html
T       2008-09-09 22:35:24
Q       that's not change
Q       you know you can put lipstick on a pig
Q       what's the difference between a hockey mom and a pit bull lipstick
Q       you can wrap an old fish in a piece of paper called change
L       http://reuters.com/article/politicsnews/idusn2944356420080901?pagenumber=1&virtualbrandchannel=10112
L       http://cbn.com/cbnnews/436448.aspx
L       http://voices.washingtonpost.com/thefix/2008/09/bristol_palin_is_pregnant.html?hpid=topnews
```
where the first letter of the line encodes:

P: URL of the document
T: time of the post (timestamp)
Q: phrase extracted from the text of the document
L: hyper-links in the document (links pointing to other documents on the web)

Note some documents have zero phrases or zero links.
