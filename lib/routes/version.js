var
	os = require('os'),

	countdown = require('countdown'),
	express = require('express'),
	prettyBytes = require('pretty-bytes'),

	nodePackage = require('../../package.json');


module.exports = function (app) {
	'use strict';

	var
		router = express.Router(),
		routeStarted = new Date();

	app.log.trace('registering routes for /v1/version');
	app.use('/v1/version', router);

	router.get('/', function (req, res) {
		var info = {
			name : nodePackage.name,
			version : nodePackage.version,
			memory : {
				free : prettyBytes(os.freemem()),
				total : prettyBytes(os.totalmem())
			},
			os : {
				arch : os.arch(),
				hostname : os.hostname(),
			},
			uptime : countdown(routeStarted, new Date()).toString()
		};

		return res
			.status(200)
			.json(info);
	});
};
