## [1.1.4] - 2026-08-25

### Added

- `getActiveRequests()` — returns the live `Map` of in-flight requests.
- `getActiveRequest(requestId)` — returns a single `ActiveRequest` entry, or `undefined`.

### Changed

- Request cleanup is unified in `#_handleRequestFinish()` (replaces `#_deleteRequest()` / `#_completeRequest()`).
- Null/undefined checks go through `#_hasValue()`.

## [1.1.3] - 2026-08-23

### Fixed

- `requestKey` functions now receive the request `options`, so key generation can depend on method, query, or other request fields.

## [1.1.2] - 2026-08-23

### Fixed

- **CommonJS build**: the bundle was named `request-manager.cjs.js` while the package is `"type": "module"`, so Node parsed it as ESM and `require('@enegalan/request-manager')` returned an empty object. The CJS bundles are now emitted with a proper `.cjs` extension (`request-manager.cjs` / `request-manager.min.cjs`) and `main` / `exports` were updated.
- `xhr()` now handles manual aborts: aborting your own `AbortController` (or calling `xhr.abort()`) rejects the promise with `{ message: 'Request was cancelled', xhr }` instead of leaving the promise pending and the request tracked as active forever. The internal abort listener is also detached once the request settles.
- `axios()` no longer crashes with a bare `ReferenceError` when axios is not available globally; it throws a descriptive error asking for an explicit instance instead.
- `includeMethod` and `verbose` are stripped from request options before they reach fetch/axios/custom clients, like the other manager-only options already were.

### Changed

- Type definitions: `AjaxFunction` may return either a Promise or a non-promise request object (`AjaxResult`), matching what `ajax()` actually accepts (jQuery jqXHR, Ext.Ajax request objects, raw XHR).
- Tests restore mocked `global.XMLHttpRequest` / `global.fetch` between suites.

## [1.1.1] - 2026-08-23

- Version bump re-publish of `@enegalan/request-manager`; no code changes.

## [1.1.0] - 2026-08-23

### Added

- `includeMethod` option (default `true`): the HTTP method is part of the URL-based request ID, so `GET /api/users` and `POST /api/users` never cancel each other. Set `includeMethod: false` to restore URL-only grouping. jQuery-style `type` option is also honored.
- axios now requires **>= 0.22.0**: cancellation is wired through an `AbortSignal` only, and a console warning is emitted when an older instance is detected.
- Transpiled builds: Rollup now runs `@babel/preset-env` (targets `> 0.5%, last 2 versions, Firefox ESR, not dead, Safari >= 10`), removing private class members and optional chaining from `dist/`.

### Fixed

- `xhr()` hung forever with `responseType: 'json'`: reading `xhr.responseText` throws `InvalidStateError` for non-text response types; the manager now uses the browser-parsed `xhr.response` instead of re-parsing, and only parses manually when the response is a string.

## [1.0.10] - 2026-08-20

### Added

- CI workflow (`.github/workflows/ci.yml`) with automated testing and quality checks. ([`e9e0422`](https://github.com/enegalan/request-manager/commit/e9e0422fb1af6f990550956728bd4cdc1e4a6e24))
- `package-lock.json` for dependency management. ([`d9e65b9`](https://github.com/enegalan/request-manager/commit/d9e65b9dcc9c8d4f6f5ed9f14e54e1aa9c99b4f7))
- `ActiveRequest` interface exported in `index.d.ts` describing active request data. ([`3050824`](https://github.com/enegalan/request-manager/commit/3050824bc5a1e5f0a3e01e0d25f9ff91e7e559a9))
- Request cleanup centralized in new private helpers `#_deleteRequest()` and `#_completeRequest()`. ([`0cf3a90`](https://github.com/enegalan/request-manager/commit/0cf3a90f1c3070e02e1a3e09b6d2e0f7f7d2f530))

### Changed

- `verbose` is kept inside `options` (`getOptions()` / `setOptions()`) instead of a separate `this.verbose` property; the per-request `this.options` state and its `#_setRequestOptions` / `#_flushRequestOptions` helpers were removed. ([`c0cd201`](https://github.com/enegalan/request-manager/commit/c0cd201f2f5d84d4f7f7f5bb47955b9e7bc39a0a), [`24f0829`](https://github.com/enegalan/request-manager/commit/24f0829f47a6e8a82a2e808a7a5f9fcb3b3e59c5))
- `ajax()` is simplified: the synchronous error handling shim was removed and the ajax function is invoked lazily inside `#_request`, so a synchronous throw returns a rejected promise. ([`3261763`](https://github.com/enegalan/request-manager/commit/3261763f2c245c0c6b2b4c8a4f66e5f0d8a1bd1b))
- `#_prepareFetchOptions()` renamed to `#_prepareRequestOptions()`; `#_generateRequestId()` replaced by the public `getRequestId(url, options)`. ([`0ba06d3`](https://github.com/enegalan/request-manager/commit/0ba06d3173b7e6152f953db9e5f9b1dafd9b1f6a))
- README rewritten for clarity: key features, usage examples, and guidance for selecting the right method. ([`e1f7a9f`](https://github.com/enegalan/request-manager/commit/e1f7a9f1a0b569f26cbb7b2e0ed51d7b0f06f5ff))

## [1.0.9] - 2026-08-13

### Changed

- `ajax()` aborts Ext.Ajax request objects via `Ext.Ajax.abort(req)` when `Ext.Ajax` is available (so Ext sets `response.aborted`). Consumers can `return Ext.Ajax.request(...)` with no custom `abort` shim.

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
