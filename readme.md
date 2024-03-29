# Posting Synchronization Agent

This is an agent that can be configured to search and retrieve certain postings from 3taps and then POST them to the Posting API. This agent uses later.js (<http://bunkat.github.io/later/>) to poll, on a set interval, the 3taps API and retrieve new postings. If there are any new postings, in bulk, those postings are then sent to the Posting API for temporal storage and notifications.

## Docker

### Environment Variables

* ENVIRONMENT - defaults to `develop`
* LOGGING_LEVEL - defaults to `info`
* MODELS_POSTINGS_POLLING_LOCATION_METRO - defaults to ``
* MODELS_POSTINGS_POLLING_LOCATION_STATE - defaults to ``
* SERVICES_THREETAPS_APIKEY - defaults to ``
* SERVICES_THREETAPS_STRICTSSL - defaults to `true`
* SERVICES_POSTINGS_STRICTSSL - defaults to `true`
* SERVICES_POSTINGS_URL - defaults to `https://posting-api.hashtagsell.com/v1/postings`

An example command to run locally:

```bash
docker run -d -p 8881:8880 \
  -e LOGGING_LEVEL=trace \
  -e MODELS_POSTINGS_POLLING_LOCATION_STATE=US-CA \
  -e SERVICES_POSTINGS_STRICTSSL=false \
  -e SERVICES_POSTINGS_URL="https://localhost:4043/v1/postings" \
  -e SERVICES_THREETAPS_STRICTSSL=false \
  -e SERVICES_THREETAPS_APIKEY=8b90c4417b0d9ba769e39432f1bff525 \
  hashtagsell/posting-sync-agent:latest
```

## Development

### Prerequisites

* Node v0.10
* Interwebs Access (to access the 3taps API)

### Getting Started

To clone the repository and install dependencies, please perform the following:

```bash
git clone git@github.com:hashtagsell/posting-sync-agent.git
cd posting-sync-agent
npm install
```

For convenience you may find it useful to install `gulp` globally as well:

```bash
sudo npm install -g gulp
```

### Local Configuration

The server utilizes a mechanism for allowing configuration overrides by environment. To make use of this for a local environment, create a `local.json` configuration file in a new folder named `config` at the root of the application. The `.gitignore` has an entry to ignore this folder so that the local config won't trash other environment configurations.

```bash
mkdir ./config
touch ./config/local.json
```

Now put the following into the `local.json` configuration file:

```javascript
{
  "logging": {
    "level": "trace"
  },
  "models": {
    "postings": {
      "polling" : {
        "location": {
          "metro": "USA-SFO"
        }
      }
    }
  },
  "services": {
    "3taps": {
      "apikey": "<YOUR DEVELOPMENT API KEY HERE>"
    }
  }
}
```

### Run It

After starting the agent, an API is exposed that provides insight into current processing status. An environment configuration should be specified (see above for details on creating a `local.json` environment config). To specify the environment, use the `NODE_ENV` environment variable in the console to begin the process. The `npm start` script uses supervisor and pipes the output to Bunyan for logging:

```bash
NODE_ENV=local npm start
```

### General Development Notes

As changes are saved to .js files in the project, supervisor will automatically restart the server. It may be useful to periodically check the terminal to make sure a runtime unhandled exception isn't stopping the server. Additionally, using jshint may help to uncover potential problems before running code. The `npm test` script is connected to `gulp jshint` to help with this.

#### Pushing Branches / Pull Requests

Prior to pushing your branch to the remote to create a pull request, please ensure you've run the tests and verified and fixed any JSHint issues or failed unit tests:

```bash
npm test
```

After running `npm test` code coverage reports are created that can be viewed to determine if model changes have adequate code coverage prior to submission:

```bash
open ./reports/lcov-report/index.html
```

#### Application Structure

* init - x509 certs and Upstart config scripts are here
* lib - all application code resides in this folder
	* config - default configuration for the application - this should have a master set of all supported configuration keys
	* models - relies on the services layer to retrieve and post data - contains all logic related to data manipulation
	* routes - relies on the model to support various resources exposed via the API
* test - all test code resides in this folder
