FROM node:lts-alpine3.14
WORKDIR /var/app
RUN apk update && apk add bash
ADD . /var/app
RUN npm i
ENTRYPOINT ["/bin/bash", "-c", "./entrypoint.sh"]