# Example programs using nginx and elasticsearch

## Description

The programs below this directory are mostly for internal use and
can't be used on their own in an isolated docker-compose environment,
so they're aren't described in the overall examples README. However,
here's a quick description of how they work.

You can view these examples on the demo system (link) [demo.juttle.io](http://demo.juttle.io/?path=/examples/nginx_logs/nginx-elastic.juttle).

## Additional docker-compose configuration

These programs parse the contents of /var/log/nginx/access.log into an
elasticsearch instance using
logstash. [dc-nginx-logs.yml](./dc-nginx-logs.yml) adds the following
containers:

- elasticsearch-nginx: an elasticsearch instance to hold parsed nginx contents
- logstash-nginx: a logstash instance that parses `/var/log/nginx/access.log` (mapped within the container as `/incoming/nginx-access.log`) and sends the parsed contents to elasticsearch

Logstash monitors the file for new contents and parses the new contents when necessary.

## ``juttle-config.json`` configuration

Add the following section to `.juttle-config.json` to add a second elasticsearch instance:

```
{
    "adapters": {
        "elastic": [
            {
                "id": "nginx",
                "address": "examples_elasticsearch-nginx_1",
                "port": 9200
            }
        ]
    }
}
```

## Juttle Programs

`nginx-elastic.juttle` reads the last day's worth of parsed nginx logs and breaks down the requests by:

- examples subdirectory
- browser name
- browser OS
- Ip address
- The city for the ip address (using the geoip capabilities within logstash)
- requests by response code







