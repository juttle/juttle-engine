FROM node:4.2.4-wheezy
MAINTAINER Rodney Gomes (rodney@jut.io)

RUN npm install juttle-engine -g

RUN mkdir -p /opt/juttle-engine
WORKDIR /opt/juttle-engine

RUN mkdir -p /opt/juttle-engine/juttles/examples
COPY example-docker-files /opt/juttle-engine/juttles/examples/

EXPOSE 8080

CMD juttle-engine --root /opt/juttle-engine/juttles
