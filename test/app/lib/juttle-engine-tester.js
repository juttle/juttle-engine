'use strict';

let _ = require('underscore');
let expect = require('chai').expect;
let Promise = require('bluebird');
let findFreePort = Promise.promisify(require('find-free-port'));
let path = require('path');
let retry = require('bluebird-retry');
let url = require('url');

let webdriver = require('selenium-webdriver');
let By = webdriver.By;
let until = webdriver.until;

let nconf = require('nconf');
nconf.argv().env();

if (!nconf.get('SELENIUM_BROWSER')) {
    // default to chrome
    process.env['SELENIUM_BROWSER'] = 'chrome';
}

let JuttleEngine = require('../../../lib/juttle-engine');
let logger = require('juttle-service').getLogger('juttle-engine-tester');

class JuttleEngineTester {
    start(cb) {
        findFreePort(10000, 20000)
        .then((port) => {
            var host = nconf.get('JUTTLE_ENGINE_HOST') || 'localhost';
            this.port = port;
            JuttleEngine.run({
                host: host,
                port: port,
                root: '/'
            }, cb);

            // Make sure that the node_modules version of chromedriver
            // is first in the path.
            process.env.PATH = path.resolve(__dirname, '../../../node_modules/.bin') +
                               path.delimiter + process.env.PATH;
            this.driver = new webdriver.Builder()
                .build();
        });
        this.counter = 0;
    }

    stop() {
        if (!nconf.get('KEEP_BROWSER')) {
            this.driver.quit();
        }

        JuttleEngine.stop();
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

    run(options) {
        var host = nconf.get('JUTTLE_ENGINE_HOST') || 'localhost';
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
