# Elasticsearch Adapter Example: Analyzing Internet News

# Setup

This example loads a data set of Internet news snippets from April 2009, collected by Memetracker (see [data source](#data-source)), into ElasticSearch, then uses Juttle with the elasticsearch adapter to read this data, search the news, compute aggregations, and visualize in the browser.

## Additional docker-compose configuration

[dc-elastic.yml](./dc-elastic.yml) in the current directory adds the following containers:

- elastic_news_data, a container containing a pre-loaded elasticsearch data directory containing the news snippets
- elasticsearch, to manage the set of news snippets

If you prefer to start from scratch, there is also an alternate
docker-compose configuration
[dc-elastic-loadfromscratch.yml](./dc-elastic-loadfromscratch.yml)
that loads the raw data into elasticsearch using logstash when the
docker-compose environment is started.

## ``juttle-config.json`` configuration

``juttle-config.json`` in the parent directory already contains the necessary configuration for the juttle-elastic-adapter to communicate with elasticsearch. It does not require any modification.

## Juttle Programs

To run any of these programs, just visit
``http://(localhost|docker machine ip):8080/run?path=/examples/elastic-newstracker/index.juttle``, which will output a
table with links in your browser. Click the links to run the example
programs.

### See the number of elasticsearch items

To see the number of elasticsearch items parsed by logstash, run the
program ``num_elastic_points.juttle`` by clicking on the
``num_elastic_points`` link from the table. You should see a non-zero
count and percentage of records while logstash populates elasticsearch
with the data from news_data.zip. Re-run the program with Run button,
or your browser refresh button, to see updated results.

Loading is complete when you see ``120060``.

### Search the news

First let's run a program that will let us enter a search term, then display daily counts of news snippets containing that term, as a timechart; and additionally display a table of matching meme phrases. This UI is implemented in a dozen lines of Juttle.

View this program: [search_ui.juttle](./search_ui.juttle)

### Compute daily emotional temperature

Now let's attempt a deeper analysis of the data, assessing the emotional "temperature" of the Internet memes for each day. The terms used as emotion markers can be easily edited from input controls; to have more than 4, expand the set in the Juttle code.

View this program: [emotional_temp.juttle](./emotional_temp.juttle)

### Top ten popular sites

Let's also get the top 10 linked-to pages for the entire dataset to see which sites were popular. Note that ideally, the day would be a user input, but input control of type 'Date' is [not yet supported](https://github.com/juttle/juttle/issues/50).

View this program: [top_linked_pages.juttle](./top_linked_pages.juttle)

### Top ten calculation via rollup

If we attempt to run this program for a longer time interval or on a larger data set, it will eventually hit memory limits and/or get too slow for the human patience.

In such cases, the better approach is to run a Juttle program that will perform the desired computation over granular subsets of the data, and write out the results to the storage backend (we call this "rollup"), so subsequent programs can query this precomputed data instead of the raw data.

The elastic adapter for Juttle supports writing to ElasticSearch as well as reading from it. The following two programs show this capability.

#### Write Results

This rollup program will compute top 100 linked-to pages for each day and write the results out to ES (100 instead of 10 to minimize loss of fidelity). It also shows counts of the number of items written per day to a table.

View this program: [top_linked_pages_write_rollup.juttle](./top_linked_pages_write_rollup.juttle)

To run this program, use the link 'top_linked_pages_write_rollup' from the ``index.juttle`` page.

#### Read Results

This program can read the rolled-up data tagged with field `tag: 'rollup_linkout'` (created by ``..._write_rollup.juttle``)
and give us top 10 linked-to pages for the whole month of April 2009 quickly. Notice that the program logic is different, it needs to sum up the counts from the rollups before sorting and giving us top 10.

View this program: [top_linked_pages_read_rollup.juttle](./top_linked_pages_read_rollup.juttle)

To run this program, use the link 'top_linked_pages_read_rollup' from the ``index.juttle`` page.

## Data Source

https://snap.stanford.edu/data/memetracker9.html

The original source has 96 million news snippets from the Memetracker. Memetracker tracks the quotes and phrases that appear most frequently over time across this entire online news spectrum. This makes it possible to see how different stories compete for news and blog coverage each day, and how certain stories persist while others fade quickly.

We have taken a subset of the data (from April 2009) and converted the data from its original format to JSON.

There are two versions available. The version used above contains ~120k documents and is in the file [news_data.zip](./news_data.zip). There is also a larger ~1.2M document set in the file [news_data_full.zip](./news_data_full.zip). Both versions are available on docker hub in the containers [juttle/elastic_news_data:latest](https://hub.docker.com/r/juttle/elastic_news_data/) and [juttle/elastic_new_data_full:latest](https://hub.docker.com/r/juttle/elastic_news_data_full/).

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
