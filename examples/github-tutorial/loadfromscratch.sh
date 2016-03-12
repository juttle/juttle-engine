# These commands are executed from juttle-engine container
# to load data from s3 into elasticsearch, using juttle.

sleep 10  # wait for elastic to be ready
juttle /config/write.juttle
