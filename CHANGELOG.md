# Change Log
This file documents all notable changes to juttle-engine. The release numbering uses [semantic versioning](http://semver.org).

## Unreleased Changes

### Minor Changes
- Updated juttle-viewer to the [0.3.0 release](https://github.com/juttle/juttle-viewer/releases/tag/v0.3.0).
This includes a total reorg of the app layout.

## 0.3.0
Released 2016-02-29

### Major Changes

- Updated juttle to the [0.5.x release](https://github.com/juttle/juttle/releases/tag/v0.5.0). This includes a number of enhancements and breaking language changes.
- Updated juttle-service to the [0.3.0 release](https://github.com/juttle/juttle-service/releases/tag/v0.3.0). This included the following breaking changes:
  - Changed the JSDP wire format to replace all remaining references to 'sink' in JSDP messages to 'view'.
  - Added a /version endpoint that returns version information on the juttle and adapter modules in use.
- Updated all adapters to their latest releases, including compatibility with Juttle 0.5.0 and additional features / changes.
- Added automatic "canary" docker image builds for all changes on all branches. [[#47](https://github.com/juttle/juttle-engine/issues/47)]

### Minor Changes
- Updated juttle-viz to the [0.5.0 release](https://github.com/juttle/juttle-viz/releases/tag/v0.5.0). This included the following major changes:
  - timechart: improve downsampling by changing option name from -display.dataDensity to -downsample and making it a boolean.
- Improved automated testing and test coverage. [[#31](https://github.com/juttle/juttle-engine/issues/31)] [[#34](https://github.com/juttle/juttle-engine/issues/34)] [[#36](https://github.com/juttle/juttle-engine/issues/36)] [[#37](https://github.com/juttle/juttle-engine/issues/37)] [[#46](https://github.com/juttle/juttle-engine/issues/46)]
- Added additional example programs for AWS, cloudwatch, and nginx, and updated other example programs. [[#32](https://github.com/juttle/juttle-engine/issues/32)] [[#33](https://github.com/juttle/juttle-engine/issues/33)] [[#40](https://github.com/juttle/juttle-engine/issues/40)] [[#41](https://github.com/juttle/juttle-engine/issues/41)] [[#56](https://github.com/juttle/juttle-engine/issues/56)] [[#57](https://github.com/juttle/juttle-engine/issues/57)] [[#59](https://github.com/juttle/juttle-engine/issues/59)]

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
