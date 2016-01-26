# These commands are executed from outrigger container
# to set up PostgreSQL table  and load data from a JSON file into that table,
# using juttle commands with juttle-postgres-adapter.
#
# This assumes use of postgres_diskstats_data volume where incoming files are. 

sleep 10  # wait for postgres to be ready
juttle -e "read postgres -raw 'CREATE TABLE kb_out(name text,host text,time timestamp with time zone,value double precision);'"
juttle -e "read file -format 'json' -file '/incoming/kbs_metrics.json'| write postgres -table 'kb_out'"
juttle -e "read postgres -table 'kb_out' | reduce count()" # to see output in the logs
