var
	// native
	fs = require('fs'),
	http = require('http'),
	https = require('https'),

	// NPM
	async = require('async'),
	bunyan = require('bunyan'),
	express = require('express'),
	settings = require('settings-lib'),

	// local
	models = require('./models'),
	routes = require('./routes'),
	services = require('./services'),

	// vars
	baseConfigPath = './lib/config/default.json',
	nodePackage = require('../package.json');


module.exports = (function (app) {
	'use strict';

	/**
	 * Creates the logging mechanism for the entire application
	 **/
	function createLogger (callback) {
		app.log = bunyan.createLogger({
			level : app.config.logging.level,
			name : nodePackage.name
		});

		app.log.trace('configuration and logging initialized');
		app.log.trace(app.config);

		return setImmediate(callback);
	}

	/**
	 * Creates an instance of Express server
	 **/
	function createServer (callback) {
		// this path is used when running behind Nginx or other server
		// that handles SSL termination
		if (!app.config.server.secure) {
			app.server = http.createServer(app);
			return setImmediate(callback);
		}

		// load the key info then create an https server
		loadKeys(function (err, keys) {
			if (err) {
				return callback(err);
			}

			app.server = https.createServer(keys, app);
			return callback();
		});
	}

	/**
	 * Reads configuration for the application while taking into
	 * account any application environment overrides
	 **/
	function loadConfig (callback) {
		settings.initialize({
			baseConfigPath : baseConfigPath,
			readEnvironmentMap : {
				ENVIRONMENT : 'environment',
				LOGGING_LEVEL :
					'logging.level',
				MODELS_POSTINGS_POLLING_LOCATION_METRO :
					'models.postings.polling.location.state',
				MODELS_POSTINGS_POLLING_LOCATION_STATE :
					'models.postings.polling.location.state',
				MODELS_POSTINGS_SCHEDULE_INTERVAL :
					'models.postings.schedule.interval',
				SERVICES_THREETAPS_APIKEY :
					'services.3taps.apikey',
				SERVICES_THREETAPS_STRICTSSL :
					'services.3taps.strictSSL',
				SERVICES_POSTINGS_MAX_BULK_UPSERT_COUNT :
					'services.postings.maxBulkUpsertCount',
				SERVICES_POSTINGS_STRICTSSL :
					'services.postings.strictSSL',
				SERVICES_POSTINGS_URL :
					'services.postings.url'
			}
		}, function (err, config) {
			if (err) {
				return callback(err);
			}

			app.config = config;
			return callback();
		});
	}

	/**
	 * Reads key paths from configuration and loads them
	 * Returns an object with the fields key and cert.
	 **/
	function loadKeys (callback) {
		var keys = {};

		async.parallel([
			// load server.crt
			function (done) {
				fs.readFile(
					app.config.server.keys.certPath,
					{ encoding : 'ASCII' },
					function (err, data) {
						if (err) {
							return done(err);
						}

						keys.cert = data;

						return done();
					});
			},
			// load server.key
			function (done) {
				fs.readFile(
					app.config.server.keys.keyPath,
					{ encoding : 'ASCII' },
					function (err, data) {
						if (err) {
							return done(err);
						}

						keys.key = data;

						return done();
					});
			}], function (err) {
					if (err) {
						return callback(err);
					}

					return callback(null, keys);
				});
	}

	/**
	 * Starts the server after initializing the config, logging, etc.
	 **/
	app.start = function (callback) {
		callback = callback || function (err) {
			if (err) {
				process.exit(1);
			}
		};

		async.auto({
			config : loadConfig,
			logging : [
				'config',
				createLogger],
			models : [
				'config',
				'logging',
				'services',
				async.apply(models.initialize, app, services)],
			routes : [
				'config',
				'logging',
				'models',
				async.apply(routes.initialize, app, models)],
			services : [
				'config',
				'logging',
				async.apply(services.initialize, app)],
			server : [
				'config',
				'logging',
				//'routes',
				createServer]
		}, function (err) {
			if (err) {
				(app.log || console).error(err);
				return callback(err);
			}

			// begin performing synchronization in the background
			models.postings.beginSynchronization();

			app.log.info('starting %s server on %s:%s',
				app.config.server.secure ? 'secure' : 'standard',
				app.config.server.host,
				app.config.server.port);

			// begin listening here...
			return app.server.listen(
				app.config.server.port,
				app.config.server.host,
				callback);
		});
	};

	/**
	 * Stops everything
	 **/
	app.stop = function (callback) {
		callback = callback || function () { process.exit(0); };
		if (app.server) {
			async.waterfall([
					models.postings.stopSynchronization,
					app.server.close
				], function () {
					app.log.info('stopped %s server on %s:%s',
					app.config.server.secure ? 'secure' : 'standard',
					app.config.server.host,
					app.config.server.port);
				});
		}
	};

	return app;
}(express()));
