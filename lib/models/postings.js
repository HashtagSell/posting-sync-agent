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
			app.log.trace('already polling... waiting until next interval');
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
					if (!result.postings || !result.postings.length) {
						app.log.trace('no new postings retrieved');

						// return
						return setImmediate(function () {
							return next(null, []);
						});
					}

					app.log.trace(
						'successfully retrieved %d postings',
						result.postings.length);

					var start = new Date();

					// send postings to posting-api
					services.postings.sendPostings(
						result.postings,
						function (err, postings) {
							if (err) {
								app.log.error(
									'error encountered sending postings to posting API');

								return next(err);
							}

							app.log.trace(
								'saving %d postings completed in %s',
								postings ? postings.length : 0,
								countdown(start, new Date(), countdown.MILLISECONDS).toString());

							return next(null, postings);
						});
				}
			], function (err, postings) {
				// indicate polling is complete
				isPolling = false;

				if (err) {
					app.log.error(err);
				}

				// return, calling polling complete hook
				return pollingCompleteHook(err, postings);
			});
	}

	self.beginSynchronization = function () {
		app.log.trace(
			'beginning polling on interval: %s',
			config.schedule.interval);

		var schedule = later.parse.text(config.schedule.interval);
		pollingTimer = later.setInterval(pollResults, schedule);

		return;
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
