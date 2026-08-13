## [1.0.8] - 2026-08-13

### Changed

- Non-promise request objects (Ext.Ajax, raw `XMLHttpRequest`) stay tracked until the underlying XHR finishes (`loadend`) instead of being dropped on the next tick. A later duplicate can still cancel them. ([`4cd1523`](https://github.com/enegalan/request-manager/commit/4cd1523a3f1bbc90913d69d0ab3098adab1e7bb4))
- Set `package.json` `author`. ([`4cd1523`](https://github.com/enegalan/request-manager/commit/4cd1523a3f1bbc90913d69d0ab3098adab1e7bb4))

### Removed

- Chaos-break test suite (`__tests__/chaos-break.test.js`). ([`7080629`](https://github.com/enegalan/request-manager/commit/70806299530bd26be5e3eff32d890a8c86b3efb4))

## [1.0.7] - 2026-08-12

### Added

- `getRequestId(url, options)` — returns the identifier RequestManager would assign for a URL and the same options used to start the request (`requestKey`, `includeQuery`, `noCancel`). ([`ea203a8`](https://github.com/enegalan/request-manager/commit/ea203a89a703782b0537cc91d0b5667e7a9be095))

## [1.0.6] - 2026-08-12

### Changed

- Cancellation is silent when `verbose` is `false` (default): the wrapper promise does not settle and nothing is logged. ([`ad1357f`](https://github.com/enegalan/request-manager/commit/ad1357f1d3aeae86ebdb20842cf6460eeef06a34))
- When `verbose` is `true`, cancellation rejects with `Request ${requestId} was cancelled` (includes the request ID). Previously the catch path used a generic `Request was cancelled` message. ([`ad1357f`](https://github.com/enegalan/request-manager/commit/ad1357f1d3aeae86ebdb20842cf6460eeef06a34))

## [1.0.5] - 2026-08-12

### Changed

- `getAbortController()` always returns a **new** AbortController. It no longer reuses a controller that is still in flight. ([`8bba235`](https://github.com/enegalan/request-manager/commit/8bba2350acef12cab82928196621b607b88bdf18))
- `getSignal()` is one-shot: one call maps to one subsequent `request()`. Parallel requests should use `fetch()`, `axios()`, or `request(url, ({ options }) => ...)` so each call gets its own signal. ([`8bba235`](https://github.com/enegalan/request-manager/commit/8bba2350acef12cab82928196621b607b88bdf18))
- Internal `#_resolveAbortController()` consumes the pending handoff so concurrent requests do not share the same controller. ([`8bba235`](https://github.com/enegalan/request-manager/commit/8bba2350acef12cab82928196621b607b88bdf18))

## [1.0.4] - 2026-08-12

### Added

- `includeQuery` option: when `true`, the query string is part of the request ID. `/api/users?page=1` and `/api/users?page=2` no longer cancel each other. Same full URL still cancels the previous request. ([`100d564`](https://github.com/enegalan/request-manager/commit/100d5647f7e165e7901dde6edef7be53332f71f8))
- Prettier and ESLint (`eslint.config.js`, `.prettierrc.json`) with `lint`, `lint:fix`, `format`, and `format:check` scripts. ([`b025d8f`](https://github.com/enegalan/request-manager/commit/b025d8f8205e7a4bfc2133cdd72ac5d02023390f))
- Author attribution in `main.js`. ([`7ae01c8`](https://github.com/enegalan/request-manager/commit/7ae01c81e47cc50b072c85883044c77ce704dabb))

### Fixed

- `axios()` now calls `axios({ url, ...options })` instead of `axios.get()`. POST, PUT, PATCH, DELETE, and other methods with `data` work as documented. ([`94d73fe`](https://github.com/enegalan/request-manager/commit/94d73fe8b41f10f20b7e4e2ea5aef7fe8d4131db))

## [1.0.3] - 2025-11-29

### Changed

- `ajax()` first parameter renamed from `ajaxMethod` to `ajaxFunction`. Error message is now `ajaxFunction parameter must be a function`. ([`7a83683`](https://github.com/enegalan/request-manager/commit/7a836830647e842091d50571324ca69cbfebf284))
- `ajax()` binds abort to `req.abort` or `req.xhr.abort` (Ext.Ajax / similar clients that expose abort on the nested XHR). ([`7a83683`](https://github.com/enegalan/request-manager/commit/7a836830647e842091d50571324ca69cbfebf284))
- `ajax()` passes its AbortController into `#_request()` so the same controller is used for abort listening and cancellation. ([`7a83683`](https://github.com/enegalan/request-manager/commit/7a836830647e842091d50571324ca69cbfebf284))
- Verbose cancel rejection includes the request id: `Request ${requestId} was cancelled`. ([`7a83683`](https://github.com/enegalan/request-manager/commit/7a836830647e842091d50571324ca69cbfebf284))

## [1.0.2] - 2025-11-26

### Changed

- Rebuilt dist without the leftover Rollup banner comment. ([`f07fb8a`](https://github.com/enegalan/request-manager/commit/f07fb8aacc6c20b307f46b1759bc4d76ce541ebb))
- README: request ID is generated from `url` or from `options.requestKey`; tip that custom properties on `options` are available inside a Function `requestPromise`. ([`5889587`](https://github.com/enegalan/request-manager/commit/5889587b1cba467afdb05c5f726269248ff460d9))

## [1.0.1] - 2025-11-26

### Changed

- Version bump for npm publish of `@enegalan/request-manager`. ([`23f319d`](https://github.com/enegalan/request-manager/commit/23f319da1030ac4c3eecb3189e22b03f352a635b))

## [1.0.0] - 2025-11-25

First public release of RequestManager: a vanilla JavaScript library that wraps HTTP calls from any client (fetch, axios, Ext.Ajax, XMLHttpRequest, custom Promises) and cancels the previous in-flight request when a new one shares the same identifier.

### Added

- `request(url, requestPromise, options)` — Promise, Function (`{ options }` with `signal`), or URL string. ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `fetch(url, options)` — native fetch with automatic abort. ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `axios(url, options, axiosInstance)` — axios with CancelToken; optional custom instance. ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `ajax(ajaxMethod, url, options)` — custom ajax function (jQuery, Ext.Ajax, …). ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `xhr(url, options)` — XMLHttpRequest wrapper (`data`, `status`, `statusText`, `headers`, `xhr`). ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- Automatic cancellation by cleaned URL (protocol, query, and hash stripped) unless `requestKey` is set. ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `requestKey` as string, number, or function to group unrelated URLs. ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `noCancel` to allow concurrent requests with the same ID (lazy loading). ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `cancel(requestId)`, `cancelAll()`, `isActive(requestId)`, `getActiveCount()`, `clear()`. ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `getSignal()`, `getAbortController()`, `addAbortListener(abortMethod, signal)`. ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- `verbose` constructor / `setOptions()` flag for cancellation error messages. ([`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))
- TypeScript definitions (`index.d.ts`). ([`ac7ff5d`](https://github.com/enegalan/request-manager/commit/ac7ff5d0352524ee449490e51d10df9d6b664852))
- Rollup builds: ESM, CommonJS, UMD, and minified browser bundles (`dist/`). ([`ac7ff5d`](https://github.com/enegalan/request-manager/commit/ac7ff5d0352524ee449490e51d10df9d6b664852))
- MIT License, Jest tests, and sandbox HTML. ([`9769674`](https://github.com/enegalan/request-manager/commit/97696740505aa091c1260022e267d75a07ad8f9e), [`b9a022f`](https://github.com/enegalan/request-manager/commit/b9a022fa233bd0bb2c2b7b683a5e3109a873dbfc))

### Changed

- Package published as `@enegalan/request-manager` (was `request-manager`). ([`7451ba6`](https://github.com/enegalan/request-manager/commit/7451ba644d43b0918cd791a1ebde2862a0851902))
- Entry moved from `index.js` to `main.js`; `index.js` re-exports the class. ([`ac7ff5d`](https://github.com/enegalan/request-manager/commit/ac7ff5d0352524ee449490e51d10df9d6b664852))

### Fixed

- `ajax()` invoked the ajax function immediately and aborted the returned request object, instead of wrapping a function that was never called. ([`41a2d57`](https://github.com/enegalan/request-manager/commit/41a2d5736734911a9ca8da685d27785555857962))
