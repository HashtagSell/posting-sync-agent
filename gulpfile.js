'use strict';

var
	del = require('del'),
	gulp = require('gulp'),
	istanbul = require('gulp-istanbul'),
	jshint = require('gulp-jshint'),
	mocha = require('gulp-mocha'),
	sequence = require('run-sequence');


gulp.task('clean', function (callback) {
	return del(['coverage'], callback);
});


gulp.task('jshint', function () {
	return gulp
		.src(['lib/**/*.js', 'test/**/*.js'])
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'));
});


gulp.task('test-all', function (callback) {
	sequence('clean', 'jshint', 'test-coverage', callback);
});


gulp.task('test-coverage', ['clean'], function () {
	return gulp
		.src(['./lib/**/*.js'])
		.pipe(istanbul())
		.pipe(istanbul.hookRequire())
		.on('finish', function () {
			gulp
				.src(['./test/lib/**/*.js'])
				.pipe(mocha({
					reporter : 'spec'
				}))
				.pipe(istanbul.writeReports('./reports'));
		});
});


gulp.task('test-functional', function () {
	return gulp
		.src(['./test/functional/**/*.js'], { read : false })
		.pipe(mocha({
			checkLeaks : true,
			reporter : 'spec',
			ui : 'bdd'
		}));
});


gulp.task('test-unit', function () {
	return gulp
	.src(['./test/lib/**/*.js'], { read : false })
	.pipe(mocha({
		checkLeaks : true,
		reporter : 'spec',
		ui : 'bdd'
	}));
});
