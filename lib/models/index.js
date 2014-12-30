var postings = require('./postings');


module.exports = (function (self) {
	'use strict';

	self = self || {};

	self.initialize = function (app, services, callback) {
		var err;

		if (!app || !app.config || !app.log) {
			err = new Error('application context with config and log are required');
			return setImmediate(callback, err);
		}

		if (!services) {
			err = new Error('services context is required to initialize models');
			return setImmediate(callback, err);
		}

		app.log.trace('initializing business layer modules');

		self.postings = postings(app, services);

		return setImmediate(callback);
	};

	return self;
}({}));
