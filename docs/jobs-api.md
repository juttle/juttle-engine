# Outrigger API

This document describes the API implemented by outrigger to start, stop, and manage juttle programs and jobs. A client uses this API to run Juttle programs, resolve input controls, kill running jobs, introspect running jobs, and so forth.

The API is mostly RESTful, mapping GETs to information fetches, POSTs to item creation, etc. The API also includes websocket endpoints that upgrade connections to a websocket protocol.

## General Notes
All information is sent and received as JSON.

###Errors
Non-200 responses contain error objects having the following structure:

```
{
    "message": <error message>,
    "code": <error code>,
    "info": <additional information about error>
}
```

The set of errors is defined in ``lib/errors.js``, and includes:

|Code                  |     Description                                                                               |      Error Message Template              | Notes
| -------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------
|JS-JUTTLE-ERROR       | Indicates a syntax or runtime error when compiling/running the provided juttle program        | Error from juttle compiler or runtime    | The info object contains detailed information from the juttle runtime/compiler on the error, including the location within the program.
|JS-BUNDLE-ERROR       | Indicates a malformed juttle program bundle                                                   | Malformed bundle: *reason*               |
|JS-JOB-NOT-FOUND-ERROR  | The specified job id did not map to any currently running program                             | No such job: *jobID*                     |
|JS-FILE-NOT-FOUND-ERROR | The specified path was not found, or was not a regular file                                   | No such file: *path*                     |
|JS-FILE-ACCESS-ERROR  | The specified path exists, but could not be read                                              | Can not read file: *path*                | This error should only occur when an underlying error is not normally handled. The info object contains additional information on the underlying error.
|JS-DIR-NOT-FOUND-ERROR| The specified directory was not found                                                         | No such directory: *dir*                |
|JS-DIR-ACCESS-ERROR   | The specified directory exists, but its contents could not be read                            | Can not read directory: *dir*            |
|JS-INVALID-PATH-ERROR | The specified path contained illegal components such as ".."                                  | '..' only allowed at end of path: *path*
|JS-TIMEOUT-ERROR      | A program was run via the immediate jobs endpoint and reached the configured timeout          | Program timed out after *timeout* ms     |

###Observers
The API allows for *observer IDs* that can be used to tie together multiple invocations of a single program. The idea is that a client could subscribe to a long-lived observer ID. When programs are notified by other clients tagged with the same observer ID, subscribers are notified with a new job id. In turn, the client could subscribe to the job and receive the program's output.

##REST Endpoints and Methods
###GET /api/v0/jobs

Returns a list of all jobs currently running within the service, including ids and all other information.

```
GET /api/v0/jobs HTTP/1.1
```

```
[
    {
        "job_id": "8cbd2b46-8079-4053-9b26-57bf76bd0be2",
        "bundle": {
            "program": "emit -limit 100000 | view table\n\n",
            "modules": {
            }
        },
        "endpoints": []
    },
    {
        "job_id": "6a22f789-4af8-4ea4-8ff5-02fe660bf769",
        "bundle": {
            "program": "emit -limit 100000 | view table\n\n",
            "modules": {
            }
        },
        "endpoints": []
    }
]
```

###POST /api/v0/jobs

Returns the jobID of the job created by running the program included in the POST body, in conjunction with a set of input values.  This is how outrigger "runs" a program.  If an observer id is specified in the bundle, all websockets listening on the indicated observer id will be notified of the new job invocation.

The program can either be a program bundle (i.e. the result from using the `/paths/*path*` endpoint) or it can be a direct pathname. When called with a program bundle, a job is created and the job id is returned immediately:

```
POST /api/v0/jobs HTTP/1.1
{
    "bundle": {
        "program": "import \"mod.juttle\" as mod; emit -limit 1 | put key=mod.val | view table",
        "modules": {
            "mod.juttle": "export const val=3;"
        }
    }
}
```

```
{
    "job_id": "8d5542d2-41c4-4c03-abb4-95baa846d843"
}
```

When called with a `path` property in the body, the service waits for the program to fully complete and then sends the program's output, including errors, warnings, marks, and points, as the return value:

```
$ cat my-juttle.juttle

emit -from :0: -limit 1 | put foo=m1.foo | view table -title "My Table"

POST /api/v0/jobs HTTP/1.1
{
    "path": "my-juttle.juttle",
    "timeout":2000
}
```

```
{
    "warnings": [],
    "errors": [],
    "output": {
        "sink0": {
            "data": [{type: 'mark', 'time:date': '1970-01-01T00:00:00.000Z'},
                     {"type": "point", "point": {"foo": "bar", "time:date": "1970-01-01T00:00:00.000Z"}}],
            "options": {
                "_jut_time_bounds": [],
                "title": "My Table"
            },
            "type": "table"
        }
    }
}
```

Note the `timeout` property in the body. If a program runs for more than *timeout* ms, the program is aborted and an error is returned. If not specified, *timeout* is 60000 (60 seconds).

###GET /api/v0/jobs/*jobID*

If specified with a websocket upgrade header, GET upgrades the http connection to a websocket to receive data and meta-data for the indicated job over JSDP.  The system buffers initial data (to configurable limit) from the running job until the first receiver attaches through this endpoint and bursts out this initial data, while subsequent instances will start receiving the data in midstream beginning with the time they connect. Any number of clients can connect to this endpoint and each will receive their own stream points over JSDP.

```
GET /api/v0/jobs/53941d4a-3630-4218-b889-2ba86cd76ea2 HTTP/1.1
Connection: Upgrade
Upgrade: websocket
Host: localhost:8080
Origin: localhost:8080
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: MTMtMTQ1MDMwMjQ2ODY3MA==
```

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: OApkdwoRFhaTCrO2l6UZi2+kkAk=
<JSDP Data streams over websocket connection>
```

Normal requests simply return information about the job.

```
GET /api/v0/jobs/e61b426b-2258-4808-a3a4-d39a9da8966c HTTP/1.1
```

```
{
    "job_id": "e61b426b-2258-4808-a3a4-d39a9da8966c",
    "bundle": {
        "program": "emit -limit 100000 | view table\n\n",
        "modules": {
        }
    },
    "endpoints": []
}
```

###POST /api/v0/prepare

Given a program bundle and current set of input values for that program, return a description of the input controls for that program. This is used by the browser to render the inputs for a given juttle program.

```
POST /api/v0/prepare HTTP/1.1
{
    "bundle": {
        "program": "input a: dropdown -label \"My Input\" -items [10, 20, 30]; emit -limit 1 | put myval=a | view table"
    },
    "inputs": {
        "a": 20
    }
}
```

```
[
    {
        "type": "dropdown",
        "id": "a",
        "static": true,
        "value": 20,
        "options": {
            "label": "My Input",
            "items": [
                10,
                20,
                30
            ]
        }
    }
]
```

###DELETE /api/v0/jobs/*jobID*

Returns the status of terminating the job indicated by jobID and notifies all clients with data sockets open on that job that the client has terminated.

```
DELETE /api/v0/jobs/02b0b6c9-2d76-4251-9f80-a2143fe34343 HTTP/1.1
```

```
{}
```

###GET /api/v0/observers/*observerID*

GET upgrades the http connection to a websocket that receives job start and stop messages for all jobs having an observer id of *observerID*.  *observerID* is an arbitrary string, where multiple clients can listen on the same observer ID.

```
GET /api/v0/observers/my-program HTTP/1.1
```

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: rnYG04MeVUIYA9PfjI9i9f7IAz8=
{"type":"job_start","job_id":"800c77de-f7d5-453a-b7b4-a6d0b932dc43"}
<Job Information related to observer ID "my-program" follows>
```

###GET /api/v0/observers

Returns a list of observer aliases being listened to within the service.

```
GET /api/v0/observers HTTP/1.1
```

```
[
    {
        "observer_id": "my-program"
    },
    {
        "observer_id": "your-other-program"
    }
]
```

###GET /api/v0/paths/*path*

Return a bundle from loading a juttle residing on the server whose source is indicated by *path*.

```
GET /api/v0/paths/forever.juttle HTTP/1.1
```

```
{
    "bundle": {
        "program": "import \"mod.juttle\" as mod; emit -limit 100000 | put key=mod.val | view table",
        "modules": {
            "mod.juttle": "export const val=3;"
        }
    }
}
```
