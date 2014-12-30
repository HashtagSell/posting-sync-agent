module.exports = (function (self) {
	'use strict';

	self = self || {};

	self.initialize = function (app, callback) {
		if (!app || !app.config || !app.log) {
			return setImmediate(callback, new Error(
				'application context with config and log are required to initialize services'));
		}

		app.log.trace('initializing service proxies');

		return setImmediate(callback);
	};

	return self;
}({}));
