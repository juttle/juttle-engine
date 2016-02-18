'use strict';

let JuttleEngineTester = require('./lib/juttle-engine-tester');
let path = require('path');
let expect = require('chai').expect;

describe('timechart', function() {
    let juttleEngineTester;

    before((done) => {
        juttleEngineTester = new JuttleEngineTester();
        juttleEngineTester.start(done);
    });

    after((done) => {
        juttleEngineTester.stop({
            dumpContainerLogs: process.env['DEBUG']
        })
        .then(() => {
            done();
        });
    });

    it('can render a simple timechart', () => {
        var title = '% CPU usage per host';
        return juttleEngineTester.run({
            path: path.join(__dirname, 'juttle', 'simple_timechart.juttle')
        })
        .then(() => {
            return juttleEngineTester.waitForViewTitle(title);
        })
        .then(() => {
            return juttleEngineTester.getSeriesOnViewWithTitle(title)
        })
        .then((seriesElements) => {
            expect(seriesElements.length).to.be.equal(3);
            var seriesIdsFound = [];
            return Promise.each(seriesElements, function(series) {
                return series.getAttribute('id')
                .then(function(id) {
                    seriesIdsFound.push(id);
                });
            })
            .then(function() {
                expect(seriesIdsFound).to.have.members([
                    'nyc.2', 'sea.0', 'sjc.1'
                ]);
            });
        })
        .then(() => {
            return juttleEngineTester.waitForYAxisTitleOnViewWithTitle(title, '% CPU busy');
        })
        .then(() => {
            return juttleEngineTester.waitForXAxisTitleOnViewWithTitle(title, 'hostname');
        });
    });
    
    // revive test once we fix: https://github.com/juttle/juttle-viz/issues/4
    it.skip('can render an overlayed timechart', () => {
        var title = '% CPU usage per host per day';
        return juttleEngineTester.run({
            path: path.join(__dirname, 'juttle', 'overlayed_timechart.juttle')
        })
        .then(() => {
            return juttleEngineTester.waitForViewTitle(title);
        })
        .then(() => {
            return juttleEngineTester.getSeriesOnViewWithTitle(title)
        })
        .then((seriesElements) => {
            expect(seriesElements.length).to.be.equal(3);
            var seriesIdsFound = [];
            return Promise.each(seriesElements, function(series) {
                return series.getAttribute('id')
                .then(function(id) {
                    seriesIdsFound.push(id);
                });
            })
            .then(function() {
                expect(seriesIdsFound).to.have.members([
                    'nyc.2', 'sea.0', 'sjc.1'
                ]);
            });
        })
        .then(() => {
            return juttleEngineTester.waitForYAxisTitleOnViewWithTitle(title, '% CPU busy');
        })
        .then(() => {
            return juttleEngineTester.waitForXAxisTitleOnViewWithTitle(title, 'hostname');
        });
    });

    it('can render events on a timechart', () => {
        var title = '% CPU usage per host';
        return juttleEngineTester.run({
            path: path.join(__dirname, 'juttle', 'events_on_timechart.juttle')
        })
        .then(() => {
            return juttleEngineTester.waitForViewTitle(title);
        })
        .then(() => {
            return juttleEngineTester.waitForNSeriesOnViewWithTitle(title, 3)
        })
        .then(() => {
            return juttleEngineTester.getSeriesOnViewWithTitle(title)
        })
        .then((seriesElements) => {
            expect(seriesElements.length).to.be.equal(3);
            var seriesIdsFound = [];
            return Promise.each(seriesElements, function(series) {
                return series.getAttribute('id')
                .then(function(id) {
                    seriesIdsFound.push(id);
                });
            })
            .then(function() {
                expect(seriesIdsFound).to.have.members([
                    'nyc.2', 'sea.0', 'sjc.1'
                ]);
            });
        })
        .then(() => {
            return juttleEngineTester.waitForYAxisTitleOnViewWithTitle(title, '% CPU busy');
        })
        .then(() => {
            return juttleEngineTester.waitForXAxisTitleOnViewWithTitle(title, 'hostname');
        })
        .then(() => {
            return juttleEngineTester.waitForNEventsOnViewWithTitle(title, 3)
        })
        .then(() => {
            return juttleEngineTester.getEventsOnViewWithTitle(title)
        })
        .then((events) => {
            expect(events.length).to.be.equal(3);
        });
    });
});
