# Test

## Running Unit Tests

To run the built in unit tests simply run:

```
gulp test
```

The above relies on you having the right version of chrome. To avoid figuring
out which exactly which chrome version to use and if you have
[docker](https://www.docker.com/) installed then you can simply tell the tests
to use `TEST_MODE=docker` like so:

```
TEST_MODE=docker gulp test
```

and the underlying testware will handle using the correct docker images to run
the through which is exactly how we run the tests in
[travis](https://travis-ci.org/juttle/juttle-engine).
