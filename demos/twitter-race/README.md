# Twitter Race

This demo shows reading from a live stream of tweets using the [twitter adapter](https://github.com/juttle/juttle-twitter-adapter).
The user inputs 2 search terms, juttle parses the incoming tweets to find matches, and displays match count as live-updating tiles and a timechart,
to visually compare popularity of the requested terms.

## Setup

We will need outrigger to render visualizations in the browser, and the twitter adapter to enable reading. 

```
npm install -g juttle
npm install -g outrigger
npm install -g juttle-twitter-adapter
```

The `~/.juttle/config.json` file should contain a configuration section with credentials to access twitter via API:

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

With the config file in place, start outriggerd daemon:

```
outriggerd &
```

## Juttle

To execute the included Juttle program, run it with outrigger client:

```
outrigger-client browser --path twitter.juttle
```

The output will be rendered in your browser. Enter two search terms and click "Run" to see the live charts.

