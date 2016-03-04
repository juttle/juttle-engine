#!/bin/bash

# This juttle program does periodic reads of aws information and writes the results to a mysql database.

sleep 40;

echo 'Polling from AWS and Writing to Mysql...';

juttle -e "

import 'https://github.com/juttle/juttle-aws-adapter/raw/master/aws_module.juttle' as AWS;

read aws -from :now: -to :end: -every :10s:
     | AWS.aggregate_all
     | write mysql -table 'aws_aggregation';

";

tail -f /dev/null
