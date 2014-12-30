var
	status = require('./status'),
	version = require('./version');


module.exports = (function (self) {
	'use strict';

	self = self || {};

	/* jshint unused : false */
	function handleErrors (app) {

		// In Express, if no route matches the request, this method will be called
		app.use(function (req, res, next) {
			app.log.warn('404: %s %s', req.method, req.url);

			var err = {
				name : 'ResourceNotFound',
				message : 'resource not found',
				method : req.method,
				statusCode : 404,
				url : req.url
			};

			return (req.method !== 'HEAD') ?
				res.status(404).json(err) :
				res.status(404).send(null);
		});

		// In Express, if no route matches the request and the call to
		// next contains 4 arguments, this method will be called
		app.use(function (err, req, res, next) {
			if (err.statusCode) {
				app.log.error('%s: %s %s', err.statusCode, req.method, req.url);
				app.log.error(err);

				return (req.method !== 'HEAD') ?
					res.status(err.statusCode).json(err) :
					res.status(err.statusCode).send(null);
			}

			app.log.error('500: %s %s', req.method, req.url);
			app.log.error(err);

			return (req.method !== 'HEAD') ?
				res.status(500).json({ message : 'internal server error' }) :
				res.status(500).send(null);
		});
	}

	function middleware (app) {
		// request logging
		app.use(function (req, res, next) {
			app.log.info('%s %s', req.method, req.url);
			return setImmediate(next);
		});

		// enable pretty output of JSON
		app.set('json spaces', 2);
	}

	self.initialize = function (app, models, callback) {
		var err;

		if (!app || !app.config || !app.log) {
			err = new Error('application context with config and log are required');
			return setImmediate(callback, err);
		}

		if (!models) {
			err = new Error('models are required to register routes');
			return setImmediate(callback, err);
		}

		// middleware
		middleware(app);

		// all resources
		self.status = status(app, models);
		self.version = version(app);

		// error handlers
		handleErrors(app);

		// return
		return setImmediate(callback);
	};

	return self;
}({}));
