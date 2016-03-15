# PostgreSQL Adapter Example: Disk Metrics

# Setup

This example loads disk throughput data for a number of hosts. The data set is for 24 hours, dated Feb 22/23 2014.
This data is ingested into PostgreSQL database, into `kb_out` table.

There is additional metadata kept in a JSON file that's used as a lookup table for enrichment;
this metadata has no timestamps and simply maps hosts to regions, subregions, pools, and disk models.
While we could ingest this data into another Posgres table, in this example we leave it in a file,
to showcase joining data from different sources in a Juttle program.

You can view this example on the demo system [demo.juttle.io](http://demo.juttle.io/?path=/examples/postgres-diskstats/throughput.juttle), or run it on your own using docker (see the parent [README](../README.md)).

## tl;dr

Run this from the parent `examples` dir (details in the parent [README.md](../README.md)):

```
docker-compose -f dc-juttle-engine.yml -f postgres-diskstats/dc-postgres.yml up
```

Data is loaded when docker container log shows this:

```
juttle-engine_loader_1 | ┌──────────┐
juttle-engine_loader_1 | │ count    │
juttle-engine_loader_1 | ├──────────┤
juttle-engine_loader_1 | │ 251573   │
juttle-engine_loader_1 | └──────────┘
examples_juttle-engine_loader_1 exited with code 0
```

Then visit this link to see the Juttle dashboard in your browser:

``http://(localhost|docker machine ip):8080/?path=/examples/postgres-diskstats/throughput.juttle``

## Additional docker-compose configuration

[dc-postgres.yml](./dc-postgres.yml) in the current directory adds the following containers:

- postgres_diskstats_data, a container with data volume exposing the JSON input files, see [image README](../../docker/images/postgres_diskstats/README.md)
- juttle-engine_loader, an juttle-engine container that briefly runs to read the input file and write to Postgres, then exits

The parent [dc-elastic.yml](../dc-elastic.yml) defines the main juttle-engine container that will keep running to serve juttle programs.

## `juttle-config.json` configuration

`juttle-config.json` in the parent directory already contains the necessary configuration for the juttle-postgres-adapter to communicate with postgres database. It does not require any modification.

## Juttle Programs

The [throughput dashboard](./throughput.juttle) reads data from postgres and from the metadata file,
joins the two data streams on matching `host` field, then aggregates the disk throughput metrics by
regions, subregion, pool. The same data is plotted on a timechart at hourly intervals, and shown in a table as sum totals.

To run this juttle, visit
`http://(localhost|docker machine ip):8080/?path=/examples/postgres-diskstats/throughput.juttle`.

## Experimenting with Juttle

To try different aggregations of this data, run the Juttle CLI against the docker container like this:

```
docker exec -it examples_juttle-engine_1 juttle
```

In the CLI, you will want to use multiline mode, type `<` to enter it, and `.` to run the multiline program.

This program would show most performant disk models by average throughput:

```
(
  read postgres -table 'kb_out' -timeField 'time'
  | keep host, value;

  read file -file '/incoming/disks.json'
)
| join host
| reduce avg(value) by diskmodel
| sort avg -desc
| head 10
```

Change `head 10` to `tail 10` to see the slowest disks instead.

In place of `diskmodel`, try:
* region
* subregion
* pool
* diskcount

## Data Set

The docker containers take care of copying and ingesting the input files. If you are curious about the data,
see [disks.json](./disks.json) metadata file, which is a JSON array with entries like this:

```
[
    {
        "host": "host91.daario.jutt.le",
        "subregion": "basiliskisles",
        "pool": "shortsword",
        "region": "sothoryos",
        "diskcount": 12,
        "diskmodel": "SEAGATE_Lannister-640",
        "cluster": "daario"
    },
    ...
]
```

To see the disk metrics, you will need to unzip `kbs_metrics.json.zip` file, containing entries like this:

```
[
    {
        "name": "kbytes_out",
        "host": "host55.daario.jutt.le",
        "time": "2014-02-22T21:52:36.000Z",
        "value": 22615.62890625
    },
    ...
]
```
]
