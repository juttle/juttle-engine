CREATE DATABASE IF NOT EXISTS aws;
USE aws;
CREATE TABLE IF NOT EXISTS aws_aggregation (
       time TIMESTAMP,
       name VARCHAR(128),
       value INTEGER UNSIGNED,
       aggregate VARCHAR(128),
       demographic VARCHAR(128),
       metric_type VARCHAR(128),
       product VARCHAR(128),

       INDEX aws_metrics_idx (time)
);
