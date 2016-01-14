# Elasticsearch Adapter Example: Analyzing Internet News

# Setup

This example loads a data set of Internet news snippets from April 2009, collected by Memetracker (see [data source](#data-source)), into ElasticSearch, then uses Juttle with the elasticsearch adapter to read this data, search the news, compute aggregations, and visualize in the browser.

## Prerequisites

These instructions assume you have docker and docker-compose installed. You
can also use docker-machine to run docker/docker-compose commands
remotely from a mac.

## Architecture

This example uses 3 docker containers:
- elasticsearch, to hold the set of news snippets.
- logstash, to parse the input file and populate elasticsearch.
- outrigger, to run juttle programs and view their outputs.

The news data is contained in the file news_data.zip and is
automatically loaded into elasticsearch when the containers are
started.

## (Optional) Get the latest ``juttle/outrigger:latest`` image

If you have run this example in the past, you might have an old
juttle/outrigger:latest image. Ensure you have the latest image by
running:

```
docker pull juttle/outrigger:latest
```

## (Optional) Clean up from a prior session

If you have previously run this example, you probably want to start from
scratch including an empty set of elasticsearch data. To do this, run:

```
docker-compose rm -v
```

If you do not do this, you will end up with duplicate sets of news
articles in elastic search. This is not strictly incorrect, but will
result in inconsistent counts.

## Start everything using docker-compose

the ``docker-compose.yml`` contains everything necessary to run all
the containers for this example. Assuming you are in the directory where
this README is located, simply run:

```
docker-compose up
```

If you're running docker via sudo, you also need to ensure that the
environment variable PWD is the current directory:

```
sudo PWD=$PWD docker-compose up
```

This will download and start the containers with appropriate links
between them.

This maps the following files to the following containers:

Logstash:
- ``logstash.conf`` -> ``/config/logstash.conf``
- ``news_data.zip`` -> ``/incoming/news_data.zip``

Outrigger:
- ``juttle-config.json`` -> ``/opt/outrigger/.juttle-config.json``

## Juttles

For easy navigation of the Juttle programs, visit
``http://localhost:8080/run?path=/examples/elastic-newstracker/index.juttle``, which will output a
table with links in your browser. Click the links to run the example
programs.

If you're running using docker-machine, replace localhost with the
value of ``docker-machine ip default``.

### See the number of elasticsearch items

To see the number of elasticsearch items parsed by logstash, run the
program ``num_elastic_points.juttle`` by clicking on the
``num_elastic_points`` link from the table. You should see a non-zero
count and percentage of records while logstash populates elasticsearch
with the data from news_data.zip. Re-run the program with Run button,
or your browser refresh button, to see updated results. *Note:* it
will take several minutes to load all the news data into
elasticsearch. You can run the other programs while elasticsearch is
being populated.

The population is complete when you see ``1200500``.

### Search the news

First let's run a program that will let us enter a search term, then display daily counts of news snippets containing that term, as a timechart; and additionally display a table of matching meme phrases. This UI is implemented in a dozen lines of Juttle.

View this program: [search_ui.juttle](juttles/search_ui.juttle)

To run this program, use the link 'search_ui' from the ``index.juttle`` page.

### Compute daily emotional temperature

Now let's attempt a deeper analysis of the data, assessing the emotional "temperature" of the Internet memes for each day. The terms used as emotion markers can be easily edited from input controls; to have more than 4, expand the set in the Juttle code.

View this program: [emotional_temp.juttle](juttles/emotional_temp.juttle)

To run this program, use the link 'emotional_temp' from the ``index.juttle`` page.

### Top ten popular sites

Let's also get the top 10 linked-to pages for a given day to see which sites were popular. Note that ideally, the day would be a user input, but input control of type 'Date' is [not yet supported](https://github.com/juttle/juttle/issues/50).

View this program: [top_linked_pages.juttle](juttles/top_linked_pages.juttle)

To run this program, use the link 'top_linked_pages' from the ``index.juttle`` page.

### Top ten calculation via rollup

If we attempt to run this program for a longer time interval or on a larger data set, it will eventually hit memory limits and/or get too slow for the human patience.

In such cases, the better approach is to run a Juttle program that will perform the desired computation over granular subsets of the data, and write out the results to the storage backend (we call this "rollup"), so subsequent programs can query this precomputed data instead of the raw data.

The elastic adapter for Juttle supports writing to ElasticSearch as well as reading from it. The following two programs show this capability.

#### Write Results

This rollup program will compute top 100 linked-to pages for each day and write the results out to ES (100 instead of 10 to minimize loss of fidelity). It also shows counts of the number of items written per day to a table.

View this program: [top_linked_pages_write_rollup.juttle](juttles/top_linked_pages_write_rollup.juttle)

To run this program, use the link 'top_linked_pages_write_rollup' from the ``index.juttle`` page.

#### Read Results

This program can read the rolled-up data tagged with field `tag: 'rollup_linkout'` (created by ``..._write_rollup.juttle``)
and give us top 10 linked-to pages for the whole month of April 2009 quickly. Notice that the program logic is different, it needs to sum up the counts from the rollups before sorting and giving us top 10.

View this program: [top_linked_pages_read_rollup.juttle](juttles/top_linked_pages_read_rollup.juttle)

To run this program, use the link 'top_linked_pages_read_rollup' from the ``index.juttle`` page.

### DIY Juttle

If you wish to try running your own Juttle programs against this data, simply add a file into `juttles` directory, let's say `my.juttle`, write code, save the file, then access the URL in the browser.

A good way to start is something like this, to see a few data points:

```
read elastic -from :2009-04-30: -to :2009-05-01:
| head 10
```

To run this progam, visit
``http://localhost:8080/run?path=/index.juttle``. As before, if using
docker-machine replace localhost with the value of ``docker-machine ip
default``.

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
