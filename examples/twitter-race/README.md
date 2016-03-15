# Twitter Race

This example shows reading from a live stream of tweets using the [twitter adapter](https://github.com/juttle/juttle-twitter-adapter).
The user inputs 2 search terms, juttle parses the incoming tweets to find matches, and displays match count as live-updating tiles and a timechart,
to visually compare popularity of the requested terms.

You can view this example on the demo system [demo.juttle.io](http://demo.juttle.io/?path=/examples/twitter-race/twitter.juttle), or run it on your own using docker (see the parent [README](../README.md)).

## Additional docker-compose configuration

None needed.

## ``juttle-config.json`` configuration

Modify `juttle-config.json` to add a ``twitter`` section containing credentials to access twitter via API:

```
{
    "adapters": {
        "twitter": {
            "consumer_key": "...",
            "consumer_secret": "...",
            "access_token_key": "...",
            "access_token_secret": "..."
        }
    }
}
```

To obtain these credentials, set up a [Twitter App](https://apps.twitter.com/) using your twitter username, and create an OAuth token.

## Juttle programs

To execute the included Juttle program, visit
``http://(localhost|docker machine ip):8080/?path=/examples/twitter-race/twitter.juttle``.

The output will be rendered in your browser. Enter two search terms and click "Run" to see the live charts.

View this program: [twitter.juttle](./twitter.juttle)
