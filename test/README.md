# Test

## Running Unit Tests

To run the built in unit tests simply run:

```
gulp test
```

## Running App Tests

To run the unit tests and app tests that uses your local `google-chrome` browser
to run the tests:

```
gulp test --app
```

The above relies on you having the right version of chrome. To avoid version
problems with chrome you can use docker for testing like so:

```
docker run -d -p 4444:4444 --name selenium-hub selenium/hub
docker run -d --link selenium-hub:hub selenium/node-chrome
```

Then when running the tests you have to tell selenium to hit the selenium
hub running on the `selenium-hub` container and the tests to hit the 
host ip address which is usually `172.17.42.1` but you can check what your
host ip address is with:

```
docker network inspect bridge | grep Gateway
```

That `Gateway` is your host ip that should be used with the following command:

```
OUTRIGGER_HOST=172.17.42.1 SELENIUM_REMOTE_URL='http://localhost:4444/wd/hub' gulp test --app
```

That will run the same app tests through the docker selenium setup and verify
everything is working as expected.

## Helper Scripts

To simplify bringing up the selenium setup and tearing it down you can use
the helper scripts under `test/scripts`:

 * `test/scripts/start_selenium_setup.sh`
 * `test/scripts/stop_selenium_setup.sh`

