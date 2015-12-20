FROM node:4.2.4-wheezy
MAINTAINER Rodney Gomes (rodney@jut.io)

RUN npm install juttle outrigger -g

# install adapters
RUN npm install juttle-gmail-adapter -g
RUN npm install juttle-graphite-adapter -g
RUN npm install juttle-influx-adapter -g
# till we publish the elastic adapter npm package
RUN npm install juttle/juttle-elastic-adapter -g
RUN npm install juttle-twitter-adapter -g
RUN npm install juttle-sql-adapter-common -g 
RUN npm install juttle-sqlite-adapter -g 
RUN npm install juttle-mysql-adapter -g 
RUN npm install juttle-postgres-adapter -g 

RUN mkdir -p /opt/outrigger
WORKDIR /opt/outrigger

EXPOSE 8080

CMD outriggerd
