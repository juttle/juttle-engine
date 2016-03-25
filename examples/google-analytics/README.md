# Google Analytics

These examples show how to read data via [googleanalytics adapter](https://github.com/juttle/juttle-googleanalytics-adapter)
from a Google Analytics account (in this case, pageviews data for a website),
process the metrics in juttle, and visualize using juttle-viz charts. 

You can view these examples on the demo system [demo.juttle.io](http://demo.juttle.io/?path=/examples/google-analytics/index.juttle), or run them on your own using docker (see the parent [README](../README.md)).

[This blog post](XXX) describes the analysis of pageviews data by browser version, and the conclusions drawn from it.

## Additional docker-compose configuration

None needed.

## ``juttle-config.json`` configuration

Modify `juttle-config.json` to add a ``googleanalytics`` section containing credentials to access messages via the Google Analytics API.

The [googleanalytics adapter README](https://github.com/juttle/juttle-googleanalytics-adapter) explains how to obtain the creds.

{
    "adapters": {
        "googleanalytics": {
            "service_account": {
                "type": "service_account",
                "project_id": "<YOUR PROJECT ID>",
                "private_key_id": "<YOUR PROJECT KEY ID>",
                "private_key": "-----BEGIN PRIVATE KEY-----\n<YOUR PRIVATE KEY>\n-----END PRIVATE KEY-----\n",
                "client_email": "<YOUR ACCOUNT EMAIL>",
                "client_id": "<YOUR CLIENT ID>",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://accounts.google.com/o/oauth2/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/<YOUR ACCOUNT EMAIL>"
            }

        }
    }
}

## Juttle Programs

To run any of these programs, just visit
``http://(localhost|docker machine ip):8080/?path=/examples/google-analytics/index.juttle``
and follow the links.

`browser_versions_recent.juttle` reads pageviews data from Google Analytics for a selected recent time period,
aggregated by browser type, browser version (which is a complete version string with major and minor numbers),
and device category (desktop, mobile or tablet). Then it computes major version to aggregate by that,
and visualizes the data as piecharts and tables for each common browser.

`browser_versions_over_time.juttle` reads pageviews data for an entire last year and visualizes the browser version
breakdown over time, on a timechart, for a selected browser type and desktop vs mobile platform. For completeness,
it also present the last month's data for the same browser as a piechart and a table.

