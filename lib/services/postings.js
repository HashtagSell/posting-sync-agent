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

	self.getLatest = function (options, tryCount, callback) {
		if (typeof callback === 'undefined' && typeof tryCount === 'function') {
			callback = tryCount;
			tryCount = 1;
		}

		request({
			method : 'GET',
			qs : options,
			strictSSL: config.strictSSL,
			timeout : config.timeout,
			url : [config.url, 'latest'].join('/')
		}, function (err, res, body) {
			// parse the response body (in case there was an error)
			var json = tryParseJSON(body);
			if (!json) {
				json = {
					response : body
				};
			}

			// check for retry
			if (res && (res.statusCode > 299 || res.statusCode < 200)) {
				if (config.maxRetryCount && tryCount < config.maxRetryCount) {
					tryCount++;
					return self.getLatest(tryCount, callback);
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
	self.upsertPostings = function (postings, callback) {
		// if there is nothing to do, do nothing
		if (!Array.isArray(postings) || !postings.length) {
			return setImmediate(callback);
		}

		var startIndex = 0;

		async.whilst(
			function () {
				return startIndex < postings.length;
			},
			function (next) {
				app.log.trace(
					'beginning upsert of postings %d to %d of %d',
					startIndex,
					(startIndex + config.maxBulkUpsertCount),
					postings.length);

				var postingsToUpsert = postings.slice(
					startIndex,
					startIndex + config.maxBulkUpsertCount)

				request({
					json : postingsToUpsert,
					method : 'PUT',
					strictSSL : config.strictSSL,
					timeout : config.timeout,
					url : config.url
				}, function (err, res, body) {
					if (err) {
						return next(err);
					}

					app.log.trace(
						'completed upsert of postings %d to %d of %d',
						startIndex,
						(startIndex + config.maxBulkUpsertCount),
						postings.length);

					// parse the response body
					var json = tryParseJSON(body);
					if (!json) {
						json = {
							response : body
						};
					}

					// check for unsuccessful status code
					if (!res || res.statusCode > 299 || res.statusCode < 200) {
						return next(json || new Error('no response from server'));
					}

					// increment startIndex to process next chunk of postings
					startIndex += config.maxBulkUpsertCount;

					return next();
				});
			},
			function (err) {
				if (err) {
					return callback(err);
				}

				// respond with the result
				return callback(null, postings);
			});
	};

	return self;
};
