var
	async = require('async'),
	request = require('request');


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
	 * Issues DELETE for the supplied postings to the posting-api
	 **/
	self.removePostings = function (postings, tryCount, callback) {
		if (typeof callback === 'undefined' && typeof tryCount === 'function') {
			callback = tryCount;
			tryCount = 1;
		}

		if (!Array.isArray(postings) || !postings.length) {
			return setImmediate(callback);
		}

		async.eachSeries(
			postings,
			function (posting, next) {
				var postingId = ['3taps', posting.id].join(':');

				request({
					method : 'DELETE',
					strictSSL : config.strictSSL,
					timeout : config.timeout,
					url : [config.url, postingId].join('/')
				}, function (err, res, body) {
					// parse the response body (in case there was an error)
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
							return self.removePostings([posting], tryCount, callback);
						}

						return next(err || json);
					}

					if (!res) {
						return next(
							new Error('no response from server - possibly a remote server crash'));
					}

					// if there is an error, kick it back
					if (err) {
						return next(err);
					}

					// respond with the result
					return next();
				});
			},
			callback);
	};

	/**
	 * PUTs the supplied postings to the posting-api
	 **/
	self.upsertPostings = function (postings, tryCount, callback) {
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
			method : 'PUT',
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
