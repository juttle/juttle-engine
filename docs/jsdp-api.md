# Juttle Streaming Data Protocol (JSDP)

The Juttle Streaming Data Protocol (JSDP) is a WebSocket-based API that serves realtime results from a Juttle job. Programs wishing to view the output of juttle programs should use this protocol.

## Events

Every event has a `type` property which describes the type of event.

### Receiving Events

JuttleD can send the following messages:

| Message | Description
|-------|------------
| ping | Periodically sent from server to indicate the client has successfully connected
| job_start | A new juttle program has started
| points | An array of points for a given sink
| tick | A data-less point
| mark | Indicates the end of a batch
| points_processed | Current count of points JuttleD has processed for current program
| sink_end | The execution for a given sink has ended
| job_end | The current job has ended

### Sending Events

The client can send the following events to JuttleD

| Event | Description
|-------|------------
| pong | Response to a ping. Used to keep websocket connections alive.

## Events Descriptions

#### ping

A response from JuttleD that the websocket connection has been successfully established.

```
{
    type: "ping"
}
```

#### job_start

Sent when a new program is executed.

```
{
"type": "job_start",
  "job_id": "edb5a183-bd74-4ec7-870f-db20c84d45ab",
  "sinks": [{
      "type": "logger"
      "sink_id": "sink0",
      "options": {
        "display": {
          "style": "raw"
        }
      }
    },
    {
      "type": "table"
      "sink_id": "sink1",
      "options": {}
    }],
  inputs: [{
      name: "my_input",
      type: "text",
      value: "",
      values: [],
      options {
          ...
      }
  }]
}
```

The `job_id` property is a unique identifier for the currrent job (i.e. running program). It should be used by clients when reattaching to a job.

The `sinks` property is an array of objects describing the sinks for the new program. In a given sink object the `type` property specifies the type of sink while the `sink_id` property is a unique identifier for this sink, that we remain constant throughout the lifecycle of the current job.

The `inputs` property is an array of objects describing the juttle-inputs for the given program. The `name` property is a unique identifier for the input. The `type` property specifies the type of input, `value` denotes the selected value for the input and the `values` attribute (optional) is an array of possible for values for the input.

#### points

Sent when a new set of points are available for display/handling by a given sink.

```
{
  "type": "points",
  "job_id": "edb5a183-bd74-4ec7-870f-db20c84d45ab",
  "sink_id": "sink0",
  "points": [{
      "foo": "bar",
      "time": "2015-11-14T02:39:49.833Z"
  }],
  }
```

The message includes the job id, sink id, and an array of points.

#### tick

Sent periodically to show time progression.
```
{
  "type": "tick",
  "job_id": "edb5a183-bd74-4ec7-870f-db20c84d45ab",
  "sink_id": "sink0",
  "time": "2015-11-14T02:39:48.833Z",
}
```

#### mark

Reflects the end of a batch.

```
{
  "time": "2015-11-16T16:57:33.000Z",
  "type": "mark",
  "job_id": "edb5a183-bd74-4ec7-870f-db20c84d45ab",
  "sink_id": "sink0",
  }
```

#### sink_end

Sent to indicate that a sink is finished and will not send any more points.

```
{
  "type": "sink_end",
  "job_id": "edb5a183-bd74-4ec7-870f-db20c84d45ab",
  "sink_id": "sink0",
  }
```

#### job_end

Sent to indicate that a job has completed and will not send any more points.
```
{
  "type": "job_end"
  "job_id": "edb5a183-bd74-4ec7-870f-db20c84d45ab",
}
```
#### pong

Sent from the client in response to a ping. If no pong is received
after several pings, JuttleD will close the websocket connection.

```
{
    type: "pong"
}
```

