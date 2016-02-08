FROM node:4.2.4-wheezy
MAINTAINER Rodney Gomes (rodney@jut.io)

RUN npm install outrigger -g

RUN mkdir -p /opt/outrigger
WORKDIR /opt/outrigger

RUN mkdir -p /opt/outrigger/juttles/examples
COPY example-docker-files /opt/outrigger/juttles/examples/

EXPOSE 8080

CMD outriggerd --root /opt/outrigger/juttles
