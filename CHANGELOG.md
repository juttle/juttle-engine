# Change Log
This file documents all notable changes to juttle-engine. The release numbering uses [semantic versioning](http://semver.org).

## 0.2.2
Released 2016-02-11

#### Bug Fixes
- Fixed the server so it listens on 0.0.0.0 instead of 127.0.0.1. [[#26](https://github.com/juttle/juttle-engine/issues/26)].
- Updated juttle-service to fix a problem where messages were sometimes dropped when sent over the websocket. [[juttle-service/#38](https://github.com/juttle/juttle-service/pull/38)]
- Updated juttle to work around an npm bug that caused problems on installation. [[juttle/#398](https://github.com/juttle/juttle/pull/398)]

## 0.2.1
Released 2016-02-10

### Bug Fixes
- Added missing entries to package.json so that the bin files get linked into the user PATH as expected. [[#23](https://github.com/juttle/juttle-engine/pull/23)]

## 0.2.0
Released 2016-02-10

### Major Changes
- Initial version of the juttle engine.

## 0.1.0
Released 2016-02-02

### Major Changes
- Initial version of the API service, which was subsequently renamed to [juttle-service](https://github.com/juttle/juttle-service)
