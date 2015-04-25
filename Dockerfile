FROM hashtagsell/ubuntu-node-hashtagsell:v0.12
MAINTAINER Joshua Thomas <joshua.thomas@hashtagsell.com>

RUN mkdir -p /home/hashtagsell/posting-sync-agent
WORKDIR /home/hashtagsell/posting-sync-agent
COPY . /home/hashtagsell/posting-sync-agent
RUN npm install

EXPOSE 8880
CMD ["supervisor", "server"]
