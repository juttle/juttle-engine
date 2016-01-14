# Twitter Race

This example shows reading from a live stream of tweets using the [twitter adapter](https://github.com/juttle/juttle-twitter-adapter).
The user inputs 2 search terms, juttle parses the incoming tweets to find matches, and displays match count as live-updating tiles and a timechart,
to visually compare popularity of the requested terms.

We will need outrigger to render visualizations in the browser, and the twitter adapter to enable reading. The outrigger docker image provides the necessary software. We run it with specific options that map the necessary configuration and juttle programs into the container.

## Setup

### Twitter Adapter Configuration and Credentials

You should create a `juttle-config.json` file in the current directory. This should contain a configuration section with credentials to access twitter via API:

```
{
    "adapters": {
        "juttle-twitter-adapter": {
            "consumer_key": "...",
            "consumer_secret": "...",
            "access_token_key": "...",
            "access_token_secret": "..."
        }
    }
}
```

To obtain these credentials, set up a [Twitter App](https://apps.twitter.com/) using your twitter username, and create an OAuth token.

### Starting outrigger

Just to make sure you have the latest juttle/outrigger:latest image, run:

```
docker pull juttle/outrigger:latest
```

Then start outrigger via docker:

```
docker run --name outrigger -p 8080:8080 -v `pwd`/juttles:/opt/outrigger/juttles -v `pwd`/juttle-config.json:/opt/outrigger/.juttle-config.json juttle/outrigger:latest
```

If you already have another instance of outrigger running, change the
``--name`` argument to a different name (say ``--name outrigger1``)
and change the port mapping to use a different port on the host (say
``-p 8081:8080``).

## Juttle

To execute the included Juttle program, visit
``http://localhost:8080/run?path=/twitter.juttle``. If you're running
using docker-machine, replace localhost with the value of
``docker-machine ip default``.

The output will be rendered in your browser. Enter two search terms and click "Run" to see the live charts.

