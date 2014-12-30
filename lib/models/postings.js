var
	async = require('async'),
	countdown = require('countdown'),
	later = require('later');


module.exports = function (app, services, self) {
	'use strict';

	self = self || {};

	var
		anchorTimestamp = new Date(),
		config = app.config.models.postings,
		isPolling = false,
		pollingCompleteHook = function () {},
		pollingOptions = JSON.parse(JSON.stringify(config.polling)),
		pollingTimer;

	/**
	 * Ensures an anchor exists for the correct timeframe
	 **/
	function getAnchor (callback) {
		var start = new Date();

		services.threeTaps.anchor(
			{ timestamp : anchorTimestamp },
			function (err, data) {
				// update last anchor timestamp
				anchorTimestamp = new Date();

				app.log.trace('anchor for %s retrieved in %s',
					anchorTimestamp,
					countdown(start, new Date(), countdown.MILLISECONDS).toString());

				return callback(err, data ? data.anchor : null);
			});
	}

	function pollResults () {
		// do not allow multiple polling requests to occur simultaneously
		if (isPolling) {
			return;
		} else {
			isPolling = true;
		}

		async.waterfall([
				// get an appropriate anchor
				getAnchor,

				// poll with the anchor
				function (anchor, done) {
					var start = new Date();

					pollingOptions.anchor = anchor;
					services.threeTaps.poll(pollingOptions, function (err, result) {
						app.log.trace('poll with anchor %s completed in %s',
							anchor,
							countdown(start, new Date(), countdown.MILLISECONDS).toString());

						return done(err, result);
					});
				},

				// handle the results from the poll
				function (result, next) {
					if (result.postings && result.postings.length) {
						app.log.trace(
							'successfully retrieved %d postings from 3taps',
							result.postings.length);
					}

					// return
					return setImmediate(function () {
						return next(null, []);
					});
				}
			], function (err, postings) {
				if (err) {
					app.log.error(err);
				}

				// indicate polling is complete
				isPolling = false;

				// return, calling polling complete hook
				return pollingCompleteHook(err, postings);
			});
	}

	self.beginSynchronization = function () {
		app.log.trace(
			'beginning polling on interval: %s',
			config.schedule.interval);

		var schedule = later.parse.text(config.schedule.interval);
		pollingTimer = later.setTimeout(pollResults, schedule);
	};

	self.stopSynchronization = function (callback) {
		if (pollingTimer) {
			app.log.trace('clearing polling interval');
			pollingTimer.clear();

			// callback once final polling round is complete
			if (isPolling) {
				pollingCompleteHook = callback;
				return;
			} else {
				return setImmediate(callback);
			}
		} else {
			return setImmediate(callback);
		}
	};

	return self;
};
