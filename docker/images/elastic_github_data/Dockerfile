FROM elasticsearch:2.1.1

COPY data /usr/share/elasticsearch/data

RUN chown -R elasticsearch:elasticsearch /usr/share/elasticsearch/data

VOLUME /usr/share/elasticsearch/data

CMD tail -f /dev/null

