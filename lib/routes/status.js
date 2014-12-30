var express = require('express');


module.exports = function (app, models) {
	'use strict';

	var router = express.Router();

	app.log.trace('registering routes for /v1/status');
	app.use('/v1/status', router);

	router.get('/', function (req, res) {
		var info = models.postings.getDiagnostics();

		return res
			.status(200)
			.json(info);
	});
};
