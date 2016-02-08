# Makes an image with a data volume to provide input files
# for postgres_diskstats example to use.

FROM busybox

RUN mkdir -p /incoming

COPY kbs_metrics.json /incoming/kbs_metrics.json

COPY disks.json /incoming/disks.json

RUN chmod -R a+r /incoming

VOLUME /incoming

CMD tail -f /dev/null

