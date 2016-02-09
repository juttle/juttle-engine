# cAdvisor / InfluxDB Example: Monitoring Docker Containers

# Setup

This example demonstrates using Juttle with an InfluxDB backend via the [influx adapter](https://github.com/juttle/juttle-influx-adapter). We will run docker containers, collect cpu, memory and network activity metrics using the [cAdvisor](https://github.com/google/cadvisor) monitoring daemon, and point cAdvisor at InfluxDB for stats storage.

Our Juttle program will then read the stats from InfluxDB backend and render visualizations of the container activity in the outrigger environment. Since this demo will have 3 docker containers running (influxdb, cadvisor and outrigger), we will monitor statistics from these three, as well as any other containers that happen to be running on the system.

## tl;dr

Run this from the parent `examples` dir (details in the parent [README.md](../README.md)):

```
docker-compose -f dc-outrigger.yml -f cadvisor-influx/dc-cadvisor-influx.yml up
```

Then visit this link to see the Juttle dashboard in your browser:

``http://(localhost|docker machine ip):8080/?path=/examples/cadvisor-influx/cadvisor-dashboard.juttle``

## Additional docker-compose configuration

[dc-cadvisor-influx.yml](./dc-cadvisor-influx.yml) in the current directory adds the following containers:

- influxdb, to store the time series data
- cadvisor, to extract performance data from docker and populate in influxdb

## ``juttle-config.json`` configuration

``juttle-config.json`` in the parent directory already contains the necessary configuration for the juttle-influx-adapter to communicate with influxdb. It does not require any modification.

# Juttle

We will use Juttle to visualize cpu, memory and network activity of the running docker containers. The Juttle program will read recent metrics from InfluxDB storage.

To run the program, visit ``http://(localhost|docker machine ip):8080/?path=/examples/cadvisor-influx/cadvisor-dashboard.juttle``

The browser window will render this program's output: a table listing of the monitored docker containers, timecharts of their CPU utilization and network activity, and a barchart of memory usage.

The [Juttle code](cadvisor-dashboard.juttle) uses subgraphs to make the code modular for readability and reuse. Since cAdvisor is reporting cumulative statistics, and we wish to graph point-in-time measurements, the values are put through `sub delta_stat()` which calculates deltas using the logic `value_at_time_1 = cumulative_1 - cumulative_0`. These values are then passed to the visualization sink for rendering.

The current version of the demo shows recent historical data; re-run the program to get a more up-to-date view. Note that cAdvisor buffers data for 1 minute, see issue [#1074](https://github.com/google/cadvisor/issues/1074), so that will be the reporting delay of our dashboard.

A live version of the dashboard is coming soon.
