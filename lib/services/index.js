var
	postings = require('./postings'),
	threeTaps = require('3taps');


module.exports = (function (self) {
	'use strict';

	self = self || {};

	self.initialize = function (app, callback) {
		if (!app || !app.config || !app.log) {
			return setImmediate(callback, new Error(
				'application context with config and log are required to initialize services'));
		}

		app.log.trace('initializing service proxies');

		self.postings = postings(app);

		// create the 3taps client
		self.threeTaps = threeTaps(app.config.services['3taps']);

		return setImmediate(callback);
	};

	return self;
}({}));
