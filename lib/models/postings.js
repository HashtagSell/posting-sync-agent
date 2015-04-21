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
		pollingTimer,
		status = {
			anchors : {
				averageRequestTime : 0,
				totalErrorCount : 0,
				totalRequestCount : 0,
				totalRequestTime : 0
			},
			polling : {
				averageRequestTime : 0,
				totalErrorCount : 0,
				totalRequestCount : 0,
				totalRequestTime : 0
			},
			postings : {
				averagePostingCount : 0,
				averageSaveTime : 0,
				totalErrorCount : 0,
				totalPostingCount : 0,
				totalSaveCount : 0,
				totalSaveTime : 0
			},
			schedule : {
				interval : config.schedule.interval,
				totalRunCount : 0
			}
		};

	/**
	 * Ensures an anchor exists for the correct timeframe
	 **/
	function getAnchor (callback) {
		var
			duration,
			start = new Date();

		// increment anchor request count
		status.anchors.totalRequestCount++;

		services.threeTaps.anchor(
			{ timestamp : anchorTimestamp },
			function (err, data) {
				// update last anchor timestamp
				anchorTimestamp = new Date();
				duration = countdown(start, new Date(), countdown.MILLISECONDS);

				// increment anchor total request time
				status.anchors.totalRequestTime += duration.milliseconds;

				// increment anchor error count
				if (err) {
					status.anchors.totalErrorCount++;
				}

				app.log.trace('anchor for %s retrieved in %s',
					anchorTimestamp,
					duration.toString());

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

			// increment total schedule run count
			status.schedule.totalRunCount++;
		}

		async.waterfall([
				// get an appropriate anchor
				getAnchor,

				// poll with the anchor
				function (anchor, done) {
					var
						duration,
						start = new Date();

					// increment polling request count
					status.polling.totalRequestCount++;

					pollingOptions.anchor = anchor;
					services.threeTaps.poll(pollingOptions, function (err, result) {
						duration = countdown(start, new Date(), countdown.MILLISECONDS);

						// increment polling total request time
						status.polling.totalRequestTime += duration.milliseconds;

						app.log.trace('poll with anchor %s completed in %s',
							anchor,
							duration.toString());

						// incrememnt polling error count
						if (err) {
							status.polling.totalErrorCount++;
						}

						return done(err, result);
					});
				},

				// handle the results from the poll
				function (pollingResult, next) {
					if (!pollingResult.postings || !pollingResult.postings.length) {
						app.log.trace('no new postings retrieved');

						// return
						return setImmediate(function () {
							return next(null, []);
						});
					}

					var
						remove = [],
						upsert = [];

					app.log.trace(
						'successfully retrieved %d postings',
						pollingResult.postings.length);

					pollingResult.postings.forEach(function (posting) {
						/* jshint sub : true */
						var isRemoved =
							posting.state === 'expired' ||
							posting.state === 'unavailable' ||
							posting.deleted ||
							posting['flagged_status'] === 1;

						if (isRemoved) {
							remove.push(posting);
						} else {
							upsert.push(posting);
						}
					});

					var
						duration,
						start = new Date();

					// incrememnt posting total save count
					status.postings.totalSaveCount++;

					// fire off requests to remove postings (notice, this is not a block
					// to completing this run)
					services.postings.removePostings(
						remove,
						config.maxRetryCount,
						function (err) {
							if (err) {
								app.log.error('unable to remove some postings');
								app.log.error(err);
							}
						});

					// send upserted postings to posting-api
					services.postings.upsertPostings(
						upsert,
						config.maxRetryCount,
						function (err, results) {
							duration = countdown(start, new Date(), countdown.MILLISECONDS);

							// increment total posting save time
							status.postings.totalSaveTime += duration.milliseconds;

							if (err) {
								// increment posting error count
								status.postings.totalErrorCount++;

								app.log.error(
									'error encountered sending postings API');

								return next(err);
							}

							// increment total posting count
							status.postings.totalPostingCount += pollingResult.postings.length;

							app.log.trace(
								'saving %d postings completed in %s',
								pollingResult.postings.length,
								duration.toString());

							return next(null, results);
						});
				}
			], function (err, postings) {
				// indicate polling is complete
				isPolling = false;

				// log the error only if it isn't an anchor error
				if (err &&
					(err.response ? err.response.error !== 'No anchor found' : true)) {
					app.log.error(err);
				} else if (err) {
					app.log.trace('No anchor found');

					// immediately retry
					return pollResults();
				}

				if (postings) {
					// return, calling polling complete hook
					return pollingCompleteHook(err, postings);
				}
			});
	}

	self.beginSynchronization = function () {
		app.log.trace(
			'beginning polling in %s on an interval of %s',
			config.polling.location.metro,
			config.schedule.interval);

		var schedule = later.parse.text(config.schedule.interval);
		pollingTimer = later.setInterval(pollResults, schedule);

		return;
	};

	self.getDiagnostics = function () {
		var returnStatus = JSON.parse(JSON.stringify(status));

		// calculate averages...
		returnStatus.anchors.averageRequestTime =
			returnStatus.anchors.totalRequestTime /
			returnStatus.anchors.totalRequestCount;

		returnStatus.polling.averageRequestTime =
			returnStatus.polling.totalRequestTime /
			returnStatus.polling.totalRequestCount;

		returnStatus.postings.averagePostingCount =
			returnStatus.postings.totalPostingCount /
			returnStatus.postings.totalSaveCount;

		returnStatus.postings.averageSaveTime =
			returnStatus.postings.totalSaveTime /
			returnStatus.postings.totalSaveCount;

		return returnStatus;
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
