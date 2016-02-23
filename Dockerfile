FROM node:4.2.4-wheezy
MAINTAINER Mark Stemm (mstemm@jut.io)

RUN mkdir -p /opt/juttle-engine
WORKDIR /opt/juttle-engine
ADD package.json package.json
RUN npm install
COPY . .

RUN mkdir -p /opt/juttle-engine/juttles
COPY examples /opt/juttle-engine/juttles/examples

RUN npm link

EXPOSE 8080

CMD /opt/juttle-engine/bin/juttle-engine --root /opt/juttle-engine/juttles
