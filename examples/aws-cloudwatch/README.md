# AWS/Cloudwatch

## Additional docker-compose configuration

The aws adapter by itself does not need any additional docker-compose
configuration. However, to allow the aws adapter, which only supports
live real-time reads of aws metrics, to also have a source for
historical information that is persistent across program invocations,
we also set up a mysql database and a juttle program that polls from
the aws adapter and writes to the mysql database.

[dc-aws-cloudwatch.yml](./dc-aws-cloudwatch.yml) in the current directory adds the following containers:

- mysql: A database to hold historical aws information.
- mysql-createdb: Runs [create_aws_db.sql](./create_aws_db.sql), a script to create the database and table used to hold historical aws information.
- juttle-aws-poller: Runs [poll_aws.juttle](./poll_aws.juttle), a juttle program that periodically polls from aws, aggregates the raw points into aggregate and demographic information, and writes that information to the mysql database.

## ``juttle-config.json`` configuration

Modify `juttle-config.json` to add ``aws`` and ``cloudwatch`` sections containing credentials to access messages via the AWS and Cloudwatch APIs. As these examples use two separate adapters, both need to be configured.

{
  "adapters": {
    "aws": {
      "access_key": "--YOUR-AWS-ACCESS-KEY-HERE--",
      "secret_key": "--YOUR-AWS-SECRET-KEY-HERE--",
      "region": "--YOUR-REGION--HERE"
    },
    "cloudwatch": {
      "access_key": "--YOUR-AWS-ACCESS-KEY-HERE--",
      "secret_key": "--YOUR-AWS-SECRET-KEY-HERE--",
      "region": "--YOUR-REGION--HERE"
    },
  }
}

The full set of steps to generate these credentials is [on the README](https://github.com/juttle/juttle-aws-adapter) page on github.

## Juttle Programs

To run any of these programs, just visit
``http://(localhost|docker machine ip):8080/?path=/examples/aws-cloudwatch/index.juttle``
and follow the links.

### Polling script and `aggregate_all` subgraph

The polling script [poll_aws.juttle](./poll_aws.juttle) uses the `aggregate_all` subgraph implemented in the file [aws_module.juttle](https://github.com/juttle/juttle-aws-adapter/blob/master/aws_module.juttle) to transform the raw points returned from the various AWS APIs into aggregate and demographic summaries of your AWS infrastructure.

It then writes the resulting points to the table `aws_aggregation` in the mysql database. This allows for a source of historical aws information that is persistent across invocations of individual juttle programs.

In turn, when the example programs want to read aws aggregate/demographic information, they read from the mysql database using `read mysql -table 'aws_aggregation' ...`.

### AWS Overview

This program demonstrates ways to use the aggregate and demographic information from the aws adapter as well as ways to use the cloudwatch adapter to identify problems.

The program shows a sample of aggregate and demographic information from AWS:

- The number of EC2 instances
- The total amount of RDS allocated storage
- The total EBS volume capacity

This program also identifies "problem" items and shows the number of items as a count and details as a table.

For this program, "problem" items are:
- EC2: Any instances with failed status checks.
- ELB: Any load balancers where UnHealthyHostCount is > 0
- Lambda: Any function with errors > 0

View this program: [overview.juttle](./overview.juttle)

### AWS Demographics

This program displays AWS aggregate metrics (e.g. Number of EC2
instances, # EBS volumes, etc.) and demographic metrics (breakdown
by EC2 instance type, EBS volume type, etc) for a given product.

Input controls let you choose the product, aggregate metric, and
demographic metric, and display timecharts and piecharts with the
values of the metric for the given product.

Optionally, the timecharts also overlay events such as
additions/removals/changes to the set of items (i.e. EC2 instances,
etc).

View this program: [demographic.juttle](./demographic.juttle)

### Capactity Planning

This is a collection of individual juttle programs that can be used to guide capacity planning decisions for several AWS products.

#### AutoScaling

This program can be used to guide decisions on capacity planning
for AutoScaling groups. It shows a timechart of the actual total
number of instances in all AutoScaling groups along with the total
desired capacity of all AutoScaling groups.

If the actual group size is consistently higher or lower than the
desired capacity, you may want to change the desired capacity to
more properly match the actual group size.

View this program: [capacity_planning/autoscaling.juttle](./capacity_planning/autoscaling.juttle)

#### EBS

This program can be used to guide decisions on capacity planning
for EBS volumes. It shows the average IO ops/second for all volumes
combined) and compares that to the configured total Iops capacity
of the entire collection of volumes.
If the total IO acticity is close to the Iops capacity, you may
want to consider adding more volumes or faster volumes to spread
the work across more items.

View this program: [capacity_planning/ebs.juttle](./capacity_planning/ebs.juttle)

#### EC2

This program relies on a common subgraraph
[capacity_planning_cpu.juttle](./common/capacity_planning_cpu.juttle)
that can be used to guide decisions on capacity planning for any AWS
Product that has a CloudWatch metric called 'CPUUtilization'
(e.g. EC2, RDS, ElastiCache). It shows the average CPU Utilization for
all items (EC2 instances/RDS databases/ElastiCache clusters) over a
recent timeframe as well as the idle time for the same set of items.

If the CPU Utilization is close to 100%, you may want to consider
adding more instances/databases/etc to spread the work across more
items.

Additionally, the program displays a pie chart of EC2 instance types
scaled by hourly cost. This allows you to identify the instance type
that is the greatest contributor to cost.

View these programs:
- [common/capacity_planning_cpu.juttle](./common/capacity_planning_cpu.juttle)
- [capacity_planning/ec2.juttle]((./capacity_planning/ec2.juttle)

#### ElastiCache

Like EC2, this program relies on capacity_planning_cpu.juttle to show
average CPU utilization for all cache nodes.

View these programs:
- [common/capacity_planning_cpu.juttle](./common/capacity_planning_cpu.juttle)
- [capacity_planning/elasticache.juttle]((./capacity_planning/elasticache.juttle)

#### RDS

This program can be used to guide decisions on capacity planning
for RDS databases. It generates three piecharts:

1. Comparing total Iops to configured Iops.
2. Showing storage space used to configured storage space.
3. Showing average CPU Utilization across all DB instances.

The first pie chart shows the average IO ops/second for all DB
instances (combined) and compares that to the configured total Iops
capacity of the entire collection of DB instances.

If the total IO acticity is close to the Iops capacity, you may
want to consider adding more databases or faster databases to
spread the work across more items.

IMPORTANT NOTE: In some cases, a RDS DB Instance will not have a
value for provisioned Iops, in which case the Iops_Headroom value
will incorrectly show a lower value than the actual headroom.

The second pie chart shows the total space used across all DB
insttances and compares that to the total allocated storage for all
DB instances.

If the total space used is close to capacity, you may want to
consider adding more storage to your DB instances.

The third pie chart uses the common subgraph in
common/capacity_planning_cpu.juttle to show the average CPU
utilization for all DB intances.

If the CPU utilization is very low or very high, you may want to
change DB classes of your instances.
