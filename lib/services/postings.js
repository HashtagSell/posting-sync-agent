var request = require('request');


module.exports = function (app, self) {
	'use strict';

	self = self || {};

	var config = app.config.services.postings;

	function tryParseJSON (body) {
		if (!body) {
			return null;
		}

		if (typeof body === 'object') {
			return body;
		}

		try {
			return JSON.parse(body);
		} catch (ex) {
			return null;
		}
	}

	/**
	 * POSTs the supplied postings to the posting-api
	 **/
	self.sendPostings = function (postings, tryCount, callback) {
		if (typeof callback === 'undefined' && typeof tryCount === 'function') {
			callback = tryCount;
			tryCount = 1;
		}

		// if there is nothing to do, do nothing
		if (!Array.isArray(postings) || !postings.length) {
			return setImmediate(callback);
		}

		request({
			json : postings,
			method : 'POST',
			strictSSL : config.strictSSL,
			timeout : config.timeout,
			url : config.url
		}, function (err, res, body) {
			// parse the response body
			var json = tryParseJSON(body);
			if (!json) {
				json = {
					response : body
				};
			}

			// check for retry
			if (res && res.statusCode >= 500) {
				if (config.maxRetryCount && tryCount < config.maxRetryCount) {
					tryCount++;
					return self.sendPostings(postings, tryCount, callback);
				}

				return callback(err || json);
			}

			if (!res) {
				return callback(
					new Error('no response from server - possibly a remote server crash'));
			}

			// if there is an error, kick it back
			if (err) {
				return callback(err);
			}

			// respond with the result
			return callback(null, json);
		});
	};

	return self;
};
