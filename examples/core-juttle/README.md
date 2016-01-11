# Examples for core juttle capabilities.

## Setup

These examples use only built-in Juttle processors and adapters.  All
you need to run these examples is to install outrigger and run
outriggerd. The easiest way to do this is by using the docker
container image on docker hub, by running:

```
docker run -d -p 8080:8080 --name outrigger juttle/outrigger:latest
```

This will download an image containing outrigger and a set of example
juttle programs and run outriggerd configured to serve those example
programs.

Then visit the following page, which actually runs a juttle program to
generate a table containing links to the programs described in this
document:

```
http://localhost:8080/run?path=/examples/core-juttle/index.juttle
```

To run any program, just visit the link from ``index.juttle``.

## Juttles

### Hello World!

This basic Juttle program uses the artificial data source `emit` to produce a single
data point with current timestamp and message field with value 'hello world'.

[hello_world.juttle](hello_world.juttle)

### Sine Wave

Juttle programs can be parameterized with user inputs, such as this math program
that renders a sine wave function on a timechart with the amplitude and period
set by the user in the input control boxes.

[sine_wave.juttle](sine_wave.juttle)

For another example of a program with input, see [fizzbuzz.juttle](fizzbuzz.juttle).

### Stock Prices

Juttle can read data from various supported backends via adapters. A few adapters
come standard with the language, including reading from a file, and from http endpoint.
More adapters can be loaded (for example, see [memes-elastic demo](../memes-elastic/README.md)).

This program uses the http adapter to read raw stock price and divident data from
Yahoo! Finance (for a stock named by the user via a text input box),
renders a timechart of daily closing prices over a background of daily trading volume,
and shows dividend payouts (if any) as events overlaid on the same chart.

[stock_prices.juttle](stock_prices.juttle)

### Kitchen Duty

Juttle can write points out to the supported backends via adapters.

This fun and useful little program helps us keep the office kitchen clean by
randomly selecting two team members every day to serve on kitchen duty.
The program sends a notification to our #food slack channel to alert the chosen ones
(the http sink is commented out, edit with proper target to see it in action).

Unlike other programs in this set of examples, kitchen_duty.juttle is not meant
to produce visual output, so we run it via the juttle CLI and not outrigger-client
(in fact, for the team's daily needs we run it as a cron job on AWS micro instance).

[kitchen_duty.juttle](kitchen_duty.juttle)

### Chart Gallery

Juttle works with juttle-viz library to produce visualizations, including the
table and timechart used in previous examples, and [more](http://juttle.github.io/juttle-viz/).

This program showcases different charts (XXX/need to finish! Only tile shown right now).

[chart_gallery.juttle](chart_gallery.juttle)


