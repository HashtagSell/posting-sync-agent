FROM hashtagsell/ubuntu-node-hashtagsell:v0.12
MAINTAINER Joshua Thomas <joshua.thomas@hashtagsell.com>

# NPM install
ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /home/hashtagsell/posting-sync-agent && \
	cp -a /tmp/node_modules /home/hashtagsell/posting-sync-agent

WORKDIR /home/hashtagsell/posting-sync-agent
COPY . /home/hashtagsell/posting-sync-agent

EXPOSE 8880
CMD ["npm", "start"]
