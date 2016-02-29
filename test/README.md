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

The system tests rely on having docker to bring up the selenium containers and
other supporting [docker](https://www.docker.com/) containers. If you happen to
want to run the selenium tests locally by using your own available chrome
browser then simply run with:

```
TEST_MODE=local gulp test --sys
```
