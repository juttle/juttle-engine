'use strict';

let _ = require('underscore');
let Promise = require('bluebird');
let execAsync = Promise.promisify(require('child_process').exec);
let expect = require('chai').expect;
let findFreePort = Promise.promisify(require('find-free-port'));
let grid = Promise.promisifyAll(require('selenium-grid-status'));
let logger = require('juttle-service').getLogger('juttle-engine-tester');
let path = require('path');
let retry = require('bluebird-retry');
let url = require('url');

let webdriver = require('selenium-webdriver');
let By = webdriver.By;
let until = webdriver.until;

if (!process.env['SELENIUM_BROWSER']) {
    // default to chrome
    process.env['SELENIUM_BROWSER'] = 'chrome';
}

let JuttleEngine = require('../../../lib/juttle-engine');

function debug(output) {
    _.each(output.split('\n'), (line) => {
        logger.debug(line);
    });
}

class JuttleEngineTester {
    start() {
        var chain;

        if (process.env['TEST_MODE'] === 'docker') {
            logger.info('starting docker containers');
            chain = execAsync('./test/scripts/start-docker-containers.sh')
            .then((stdout) => {
                debug(stdout);
                return retry(() => {
                    return grid.availableAsync({
                        host: 'localhost',
                        port: 4444
                    })
                    .then((status) => {
                        if (status.length == 0) {
                            throw Error('Waiting for selenium nodes: ' +
                                        JSON.stringify(status, null, 4));
                        }
                    });
                })
            })
            .then(() => {
                // figure out the gateway address so we can communicate from
                // the browser in the selenium-chrome-node container back to
                // the juttle-engine running on the docker host
                return execAsync('docker exec selenium-hub networkctl status | grep Gateway');
            })
            .then((stdout) => {
                // output from previous command looks like so:
                // '        Gateway: 172.16.0.1 on eth0'
                var gateway = stdout.trim().split(' ')[1];
                process.env['JUTTLE_ENGINE_HOST'] = gateway;
                logger.info('docker host at', gateway);

                logger.info('docker containers started');
                process.env['SELENIUM_REMOTE_URL'] = 'http://localhost:4444/wd/hub';
            });
        } else {
            chain = Promise.resolve();
        }

        chain
        .then(() => {
            return findFreePort(10000, 20000);
        })
        .then((port) => {
            return new Promise((resolve) => {
                return Promise.try(() => {
                    var host = process.env['JUTTLE_ENGINE_HOST'] || 'localhost';
                    this.port = port;
                    JuttleEngine.run({
                        host: host,
                        port: port,
                        root: '/'
                    }, resolve);

                    // Make sure that the node_modules version of chromedriver
                    // is first in the path.
                    process.env.PATH = path.resolve(__dirname, '../../../node_modules/.bin') +
                                    path.delimiter + process.env.PATH;
                    this.driver = new webdriver.Builder().build();
                });
            });
        });

        return chain;
    }

    stop() {
        var chain = Promise.resolve();

        if (!process.env['KEEP_BROWSER']) {
            chain = chain.then(() => {
                if (this.driver) {
                    return this.driver.quit();
                }
            });
        }

        chain = chain.then(() => {
            JuttleEngine.stop();
        });

        if (process.env['TEST_MODE'] === 'docker') {
            logger.info('stopping docker containers');
            if (process.env['DEBUG']) {
                chain = chain.then(() => {
                    return execAsync('./test/scripts/dump-docker-container-logs.sh')
                    .then((stdout) => {
                        debug(stdout);
                    });
                });
            }

            chain = chain.then(() => {
                return execAsync('./test/scripts/stop-docker-containers.sh');
            })
            .then((stdout) => {
                debug(stdout);
                logger.info('docker containers stopped');
            });
        }

        return chain;
    }

    _findElement(locator) {
        /*
         * find an element by using a By.*** locator and return it only
         * after its been found and is visible
         *
         */
        return this.driver.wait(until.elementLocated(locator))
        .then(() => {
            return this.driver.findElement(locator)
            .then((element) => {
                return this.driver.wait(until.elementIsVisible(element))
                .then(() => {
                    return element;
                });
            });
        });
    }

    clickPlay() {
        var locator = By.xpath('//button[text()="Run"]');
        return this._findElement(locator)
        .then((button) => {
            return button.click();
        });
    }

    findInputControl(inputControlLabel) {
        var locator = By.css(`.inputs-view div[data-input-label=${inputControlLabel}] input`);
        return this._findElement(locator);
    }

    getInputControlValue(inputControlLabel) {
        return this.findInputControl(inputControlLabel)
        .then((element) => {
            return element.getAttribute('value');
        });
    }

    writeIntoInputControl(inputControlLabel, text) {
        var self = this;

        return retry(() => {
            return this.findInputControl(inputControlLabel)
            .then((inputElement) => {
                inputElement.clear();

                _.each(text, (key) => {
                    inputElement.sendKeys(key);
                });

                return self.getInputControlValue(inputControlLabel)
                .then((value) => {
                    expect(value).to.equal(text);
                });
            });
        });
    }

    findViewByTitle(title) {
        var locator = By.xpath(`//div[@class='jut-chart-title' and text()='${title}']/ancestor::div[contains(@class,'juttle-view')]`);
        return this._findElement(locator);
    }

    waitForViewTitle(title) {
        return this.findViewByTitle(title)
        .then((element) => {
            return element;
        })
    }

    getErrorMessage() {
        var locator = By.css('.juttle-client-library.error-view span');
        return this._findElement(locator)
        .then((element) => {
            return element.getAttribute('textContent');
        });
    }

    waitForJuttleErrorToContain(message, options) {
        var self = this;
        var defaults = {
            interval: 1000,
            timeout: 10000
        };
        options = _.extend(defaults, options);

        return retry(() => {
            return self.getErrorMessage()
            .then((value) => {
                logger.debug('waitForJuttleErrorToContain got', value);
                expect(value).to.contain(message);
            });
        }, options);
    }

    waitForJuttleErrorToEqual(message, options) {
        var self = this;
        var defaults = {
            interval: 1000,
            timeout: 10000
        };
        options = _.extend(defaults, options);

        return retry(() => {
            return self.getErrorMessage()
            .then((value) => {
                logger.debug('waitForJuttleErrorToEqual got', value);
                expect(value).to.equal(message);
            });
        }, options);
    }

    getTextOutput(title) {
        return this.findViewByTitle(title)
        .then((element) => {
            return element.findElement(By.css('textarea'));
        })
        .then((elem) => {
            return elem.getAttribute('value');
        });
    }

    waitForTextOutputToContain(title, data, options) {
        var self = this;

        var defaults = {
            interval: 1000,
            timeout: 10000
        };
        options = _.extend(defaults, options);

        return retry(() => {
            return self.getTextOutput(title)
            .then((value) => {
                expect(JSON.parse(value)).to.deep.equal(data);
            });
        }, options);
    }

    getXAxisTitleOnViewWithTitle(viewTitle) {
        var locator = By.css('.x.axis-label text');

        return this.findViewByTitle(viewTitle)
        .then((view) => {
            return this._findElement(locator);
        })
    }

    waitForXAxisTitleOnViewWithTitle(viewTitle, axisTitle) {
        return this.getXAxisTitleOnViewWithTitle(viewTitle)
        .then((element) => {
            return element.getAttribute('textContent')
            .then((text) => {
                expect(text).to.equal(axisTitle);
            });
        });
    }

    getYAxisTitleOnViewWithTitle(viewTitle) {
        var locator = By.css('.y.axis-label text');

        return this.findViewByTitle(viewTitle)
        .then((view) => {
            return this._findElement(locator);
        })
    }

    waitForYAxisTitleOnViewWithTitle(viewTitle, axisTitle) {
        return this.getYAxisTitleOnViewWithTitle(viewTitle)
        .then((element) => {
            return element.getAttribute('textContent')
            .then((text) => {
                expect(text).to.equal(axisTitle);
            });
        });
    }

    getXAxisLabelsOnViewWithTitle(title) {
        var locator = By.css('.x.axis .tick text');

        return this._findElement(locator)
        .then((view) => {
            return this.driver.wait(until.elementLocated(By.css('.x.axis .tick text')))
            .then(() => {
                return view.findElements(By.css('.x.axis .tick text'));
            });
        });
    }

    waitForXAxisLabelOnViewWithTitle(title, labels) {
        return this.getXAxisLabelsOnViewWithTitle(title)
        .then(function(labelElements) {
            return Promise.each(labelElements, function(labelElement, index) {
                return labelElement.getAttribute('textContent')
                .then((text) => {
                    expect(text).to.equal(labels[index]);
                });
            });
        });
    }

    getYAxisLabelsOnViewWithTitle(title) {
        var locator = By.css('.y.axis .tick text');

        return this._findElement(locator)
        .then((view) => {
            return this.driver.wait(until.elementLocated(By.css('.y.axis .tick text')))
            .then(() => {
                return view.findElements(By.css('.y.axis .tick text'));
            });
        });
    }

    waitForYAxisLabelOnViewWithTitle(title, labels) {
        return this.getXAxisLabelsOnViewWithTitle(title)
        .then(function(labelElements) {
            return Promise.each(labelElements, function(labelElement, index) {
                return labelElement.getAttribute('textContent')
                .then((text) => {
                    expect(text).to.equal(labels[index]);
                });
            });
        });
    }

    getBarsOnViewWithTitle(title) {
        return this.findViewByTitle(title)
        .then((view) => {
            return this.driver.wait(until.elementLocated(By.css('rect.bar')))
            .then(() => {
                return view.findElements(By.css('rect.bar'))
            })
            .then((elements) => {
                var self = this;
                return Promise.each(elements, function(element) {
                    return self.driver.wait(until.elementIsVisible(element));
                })
                .then(() => {
                    return elements;
                });
            });
        });
    }

    getComputedStyleValue(element, styleName) {
        var script = 'return window.getComputedStyle(arguments[0])' +
                     ' .getPropertyValue(arguments[1]);';
        return this.driver.executeScript(script, element, styleName);
    }

    waitForNEventsOnViewWithTitle(title, howmany, options) {
        var defaults = {
            interval: 1000,
            timeout: 10000
        };
        options = _.extend(defaults, options);

        return this.findViewByTitle(title)
        .then((view) => {
            return this.driver.wait(until.elementLocated(By.css('.juttle-view .jut-chart-wrapper')))
            .then(() => {
                return view.findElement(By.css('.juttle-view .jut-chart-wrapper'));
            })
            .then((chartWrapper) => {
                return retry(() => {
                    return chartWrapper.findElements(By.css('.event-marker'))
                    .then((events) => {
                        expect(events.length).to.equal(howmany);
                    });
                }, options);
            });
        });
    }

    getEventsOnViewWithTitle(title) {
        return this.findViewByTitle(title)
        .then((view) => {
            return this.driver.wait(until.elementLocated(By.css('.juttle-view .jut-chart-wrapper')))
            .then(() => {
                return view.findElement(By.css('.juttle-view .jut-chart-wrapper'));
            })
            .then((chartWrapper) => {
                return chartWrapper.findElements(By.css('.event-marker'));
            })
            .then((elements) => {
                var self = this;
                return Promise.each(elements, function(element) {
                    return self.driver.wait(until.elementIsVisible(element));
                })
                .then(() => {
                    return elements;
                });
            });
        });
    }

    waitForNSeriesOnViewWithTitle(title, howmany, options) {
        var defaults = {
            interval: 1000,
            timeout: 10000
        };
        options = _.extend(defaults, options);

        return this.findViewByTitle(title)
        .then((view) => {
            return this.driver.wait(until.elementLocated(By.css('.juttle-view .jut-chart-wrapper')))
            .then(() => {
                return view.findElement(By.css('.juttle-view .jut-chart-wrapper'));
            })
            .then((chartWrapper) => {
                return retry(() => {
                    return chartWrapper.findElements(By.css('g.series'))
                    .then((series) => {
                        expect(series.length).to.equal(howmany);
                    });
                }, options);
            });
        });
    }

    getSeriesOnViewWithTitle(title) {
        return this.findViewByTitle(title)
        .then((view) => {
            return this.driver.wait(until.elementLocated(By.css('.juttle-view .jut-chart-wrapper')))
            .then(() => {
                return view.findElement(By.css('.juttle-view .jut-chart-wrapper'));
            })
            .then((chartWrapper) => {
                return chartWrapper.findElements(By.css('g.series'));
            })
            .then((elements) => {
                var self = this;
                return Promise.each(elements, function(element) {
                    return self.driver.wait(until.elementIsVisible(element));
                })
                .then(() => {
                    return elements;
                });
            });
        });
    }

    run(options) {
        var host = process.env['JUTTLE_ENGINE_HOST'] || 'localhost';
        var urlPath = url.format({
            protocol: 'http',
            hostname: host,
            port: this.port,
            query: options
        });
        return this.driver.get(urlPath);
    }
}

module.exports = JuttleEngineTester;
