# Test

## Running Unit Tests

To run the built in unit tests simply run:

```
gulp test
```

To run the built in system tests simply run:

```
gulp test --sys
```

**NOTE:** be sure to run `docker build -t juttle-engine:local .` after each
code change if you intend on running the system tests locally.

The system tests rely on having docker to bring up the selenium containers and
other supporting [docker](https://www.docker.com/) containers. If you happen to
want to run the selenium tests locally by using your own available chrome
browser then simply run with:

```
TEST_MODE=local gulp test --sys
```
