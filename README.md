<div align="center">

# @enegalan/request-manager

[![npm version](https://img.shields.io/npm/v/@enegalan/request-manager.svg)](https://www.npmjs.com/package/@enegalan/request-manager)
[![CI](https://github.com/enegalan/request-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/enegalan/request-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue.svg)](index.d.ts)
[![Bundle formats](https://img.shields.io/badge/modules-ESM%20%7C%20CJS%20%7C%20UMD-green.svg)](#installation)

RequestManager is a JavaScript library designed to manage and regulate HTTP requests efficiently. It cancels duplicate in-flight calls and works with fetch, axios, jQuery.ajax, Ext.Ajax, raw XHR, and custom clients.

[Getting started](#installation) · [Usage](#usage) · [API Reference](#api-reference)

</div>

---

## Why?

RequestManager **avoids repeated HTTP requests**: when a new call starts with the same identifier (cleaned URL, method, or a custom `requestKey`), the previous one is aborted on the spot. You decide what cancels what — group by URL, key, or query string; or let requests run concurrently with `noCancel`.

```javascript
requestManager.fetch('/api/search?q=hi'); // aborted when...
requestManager.fetch('/api/search?q=ho'); // ...this one starts (same cleaned URL)
requestManager.fetch('/api/feed', { noCancel: true }); // never cancelled
```

## Key Features

|                             |                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Universal compatibility** | Dedicated helpers for `fetch`, `axios`, ajax-style clients (jQuery / Ext.Ajax), and `XMLHttpRequest` — plus a low-level `request()` escape hatch |
| **Real cancellation**       | Duplicates are aborted at the network level (`AbortSignal`, `req.abort()`, `xhr.abort()`) — not silently discarded                               |
| **Latest request wins**     | Only the most recent request per identifier survives; older ones are aborted automatically                                                       |
| **Simple API**              | Pick the helper for your client and everything is wired for you. Manual abort plumbing only if you drop to `request()`                           |
| **Configurable grouping**   | Shared options across helpers: `requestKey`, `noCancel`, `includeQuery`, `includeMethod`                                                         |
| **TypeScript support**      | Full type definitions included and resolved automatically                                                                                        |
| **Every module format**     | ESM, CommonJS, UMD, and minified CDN bundles                                                                                                     |

## Table of Contents

- [@enegalan/request-manager](#enegalanrequest-manager)
    - [Why?](#why)
    - [Key Features](#key-features)
    - [Table of Contents](#table-of-contents)
    - [Installation](#installation)
    - [Usage](#usage)
        - [Usage in Different Environments](#usage-in-different-environments)
        - [TypeScript](#typescript)
        - [Which method should I use?](#which-method-should-i-use)
        - [Basic Example with fetch()](#basic-example-with-fetch)
        - [POST Request with Options](#post-request-with-options)
        - [Using request()](#using-request)
        - [Automatic Cancellation with Same URL](#automatic-cancellation-with-same-url)
        - [Using requestKey to Override URL-based ID](#using-requestkey-to-override-url-based-id)
        - [Using requestKey with Function](#using-requestkey-with-function)
        - [Using noCancel to Allow Concurrent Requests](#using-nocancel-to-allow-concurrent-requests)
        - [Using includeQuery to Distinguish Query Strings](#using-includequery-to-distinguish-query-strings)
        - [Using with Axios](#using-with-axios)
        - [Using with jQuery / Ext.Ajax (`ajax()`)](#using-with-jquery--extajax-ajax)
        - [Using with Other Libraries](#using-with-other-libraries)
    - [API Reference](#api-reference)
        - [`new RequestManager(options)`](#new-requestmanageroptions)
        - [`request(url, requestPromise, options)`](#requesturl-requestpromise-options)
        - [`fetch(url, options)`](#fetchurl-options)
        - [`axios(url, options, axiosInstance)`](#axiosurl-options-axiosinstance)
        - [`ajax(ajaxFunction, url, options)`](#ajaxajaxfunction-url-options)
        - [`xhr(url, options)`](#xhrurl-options)
        - [`getRequestId(url, options)`](#getrequestidurl-options)
        - [`cancel(requestId)`](#cancelrequestid)
        - [`cancelAll()`](#cancelall)
        - [`isActive(requestId)`](#isactiverequestid)
        - [`getActiveCount()`](#getactivecount)
        - [`clear()`](#clear)
        - [`getSignal()`](#getsignal)
        - [`getAbortController()`](#getabortcontroller)
        - [`getOptions()`](#getoptions)
        - [`setOptions(options)`](#setoptionsoptions)
        - [`addAbortListener(abortMethod, signal)`](#addabortlistenerabortmethod-signal)
    - [Browser Support](#browser-support)
    - [Contributing](#contributing)
    - [License](#license)

## Installation

```bash
npm install @enegalan/request-manager
# or
yarn add @enegalan/request-manager
# or
pnpm add @enegalan/request-manager
```

## Usage

### Usage in Different Environments

**ES Modules (recommended):**

```javascript
import RequestManager from '@enegalan/request-manager';
```

**CommonJS:**

```javascript
const { RequestManager } = require('@enegalan/request-manager');
```

**Browser (CDN):**

```html
<!-- Using unpkg -->
<script src="https://unpkg.com/@enegalan/request-manager/dist/request-manager.min.js"></script>

<!-- Or using jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@enegalan/request-manager/dist/request-manager.min.js"></script>

<script>
    const requestManager = new RequestManager();
</script>
```

### TypeScript

Full TypeScript support is included. Types are automatically resolved:

```typescript
import RequestManager, { RequestOptions, XhrResponse } from '@enegalan/request-manager';

const requestManager = new RequestManager({ verbose: true });

const response: Response = await requestManager.fetch('/api/users');
const xhrResult: XhrResponse<{ name: string }> = await requestManager.xhr('/api/user/1');
```

### Which method should I use?

Pick the **dedicated helper** for your HTTP client. Use `request()` only when none of the helpers fit.

| Client                            | Use this                                  | Why                                                                                                    |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `fetch`                           | **`fetch(url, options)`**                 | Creates the AbortSignal and passes it to `fetch` for you                                               |
| `axios`                           | **`axios(url, options, axiosInstance?)`** | Creates an `AbortSignal` and wires cancel for you (axios ≥ 0.22)                                       |
| jQuery `.ajax`, Ext.Ajax, similar | **`ajax(ajaxFunction, url, options)`**    | Runs your ajax function, then wires abort for you (`req.abort`, `Ext.Ajax.abort(req)`, or `xhr.abort`) |
| Raw `XMLHttpRequest`              | **`xhr(url, options)`**                   | Owns open/send and abort lifecycle                                                                     |
| Custom / already-started Promise  | **`request(url, promiseOrFn, options)`**  | Escape hatch — **you** must pass `signal` / `cancelToken` / `addAbortListener`                         |

**Rule of thumb**

1. Known client → use its helper (`fetch` / `axios` / `ajax` / `xhr`).
2. Helper already cancels the real network call — no manual abort wiring.
3. `request()` is for edge cases (wrapping an existing Promise, exotic clients). Same cancellation _map_ as the helpers, but abort plumbing is your job.

```javascript
// Preferred
requestManager.fetch('/api/users');
requestManager.axios('/api/users');
requestManager.ajax(({ url, ...opts }) => $.ajax({ url, ...opts }), '/api/users');
requestManager.ajax(({ url, ...opts }) => Ext.Ajax.request({ url, ...opts }), '/api/users');
requestManager.xhr('/api/users');

// Escape hatch — you wire cancel yourself (see API notes below)
requestManager.request('/api/users', ({ options }) => fetch('/api/users', { signal: options.signal, ...options }));
```

> [!IMPORTANT]
> Calling `request(url, Ext.Ajax.request(...))` or `request(url, $.ajax(...))` **without** linking abort (via `addAbortListener` / `cancelToken` / `signal`) does **not** abort the browser request when a duplicate starts. Use **`ajax()`** for those clients.

### Basic Example with fetch()

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager({ verbose: true });

requestManager
    .fetch('/api/users')
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => {
        if (error.message.includes('was cancelled')) {
            console.log('Request was cancelled');
        } else {
            console.error('Request failed:', error);
        }
    });
```

### POST Request with Options

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

requestManager
    .fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }),
    })
    .then((response) => response.json())
    .then((data) => console.log(data));
```

### Using request()

`request()` is the low-level API when you already have a Promise or need custom wiring.

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// Function form — options include signal; pass it into fetch (or prefer requestManager.fetch)
requestManager
    .request('/api/users', ({ options }) => {
        return fetch('/api/users', { signal: options.signal, ...options });
    })
    .then((response) => response.json())
    .then((data) => console.log(data));

// Pre-created Promise — must also pass abortController / cancelToken or cancel is incomplete
const abortController = requestManager.getAbortController();
requestManager.request('/api/users', fetch('/api/users', { signal: abortController.signal }), {
    abortController,
});
```

### Automatic Cancellation with Same URL

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// By default, requests with the same method + URL (cleaned) will cancel previous ones
// The URL is automatically cleaned (protocol and query params removed) and the HTTP
// method is prepended to generate the request ID (e.g. request_GET_/api/search)
requestManager.fetch('/api/search?q=test').catch((error) => {
    console.log('First request cancelled:', error.message);
});

// This second request will automatically cancel the first one
// because they share the same cleaned URL
setTimeout(() => {
    requestManager
        .fetch('/api/search?q=updated')
        .then((response) => response.json())
        .then((data) => console.log('Second request completed:', data));
}, 100);
```

### Using requestKey to Override URL-based ID

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// You can use requestKey to override the default URL-based ID generation
requestManager
    .fetch('/api/search?q=test', {
        requestKey: 'search-users', // Custom key instead of cleaned URL
    })
    .catch((error) => {
        console.log('First request cancelled:', error.message);
    });

// This second request will cancel the first one because they share the same requestKey
setTimeout(() => {
    requestManager
        .fetch('/api/search?q=updated', {
            requestKey: 'search-users', // Same key = same request ID = cancellation
        })
        .then((response) => response.json())
        .then((data) => console.log('Second request completed:', data));
}, 100);
```

### Using requestKey with Function

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// You can use a function to generate the requestKey dynamically
function searchUsers(query) {
    return requestManager.fetch(`/api/search?q=${query}`, {
        requestKey: () => `search-${query}`, // Function that returns the key
    });
}

// Both calls will share the same requestKey and cancel each other
searchUsers('test');
searchUsers('test'); // This will cancel the previous one
```

### Using noCancel to Allow Concurrent Requests

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// Use noCancel: true to allow multiple requests to execute concurrently
// This is useful for lazy loading scenarios where you want all requests to complete
requestManager
    .fetch('/api/lazy?load=1', { noCancel: true })
    .then((response) => response.json())
    .then((data) => console.log('Load 1:', data));

requestManager
    .fetch('/api/lazy?load=2', { noCancel: true })
    .then((response) => response.json())
    .then((data) => console.log('Load 2:', data));

requestManager
    .fetch('/api/lazy?load=3', { noCancel: true })
    .then((response) => response.json())
    .then((data) => console.log('Load 3:', data));

// All three requests will execute concurrently without canceling each other
// Even though they share the same cleaned URL (without query params)
```

### Using includeQuery to Distinguish Query Strings

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// By default, query params are stripped from the ID:
// /api/users?page=1 and /api/users?page=2 share the same ID and cancel each other.

// With includeQuery: true, the query string is part of the ID
requestManager.fetch('/api/users?page=1', { includeQuery: true });
requestManager.fetch('/api/users?page=2', { includeQuery: true });
// Both run — different query = different ID

// Same full URL still cancels the previous one
requestManager.fetch('/api/users?page=1', { includeQuery: true });
requestManager.fetch('/api/users?page=1', { includeQuery: true }); // cancels the previous page=1
```

### Using with Axios

```javascript
import axios from 'axios';
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

requestManager
    .axios('/api/users')
    .then((response) => console.log(response.data))
    .catch((error) => {
        if (axios.isCancel(error)) {
            console.log('Request was cancelled');
        } else {
            console.error('Request failed:', error);
        }
    });
```

### Using with jQuery / Ext.Ajax (`ajax()`)

`ajax()` invokes your function, inspects the returned request object, and registers abort automatically (`req.abort`, `Ext.Ajax.abort(req)`, or `xhr.abort`).

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// jQuery
requestManager.ajax($.ajax.bind($), '/api/users', { method: 'GET' });

// Ext.Ajax — return the Ext request object (not a Promise)
requestManager.ajax(({ url, ...options }) => Ext.Ajax.request({ url, ...options }), '/api/users');

// Or bind Ext.Ajax.request directly when options shape matches
requestManager.ajax(Ext.Ajax.request.bind(Ext.Ajax), '/api/users');
```

Equivalent with `request()` (more boilerplate — not recommended):

```javascript
requestManager.request('/api/users', ({ options }) => {
    const req = Ext.Ajax.request({ url: '/api/users', ...options });
    requestManager.addAbortListener(() => Ext.Ajax.abort(req), options.signal);
    return req;
});
```

### Using with Other Libraries

If there is no dedicated helper, use `request()` and make sure you wire abort yourself via `options.signal` (or pass `cancelToken` / `addAbortListener`).

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

requestManager
    .request('/api/data', ({ options }) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/api/data');
            xhr.onload = () => resolve(xhr.responseText);
            xhr.onerror = () => reject(new Error('Request failed'));
            xhr.send();

            options.signal.addEventListener('abort', () => {
                xhr.abort();
                reject(new Error('Request was cancelled'));
            });
        });
    })
    .then((data) => console.log(data))
    .catch((error) => console.error(error));
```

## API Reference

### `new RequestManager(options)`

Creates a new RequestManager instance.

**Parameters:**

- `options` (Object, optional): Configuration options
    - `verbose` (boolean, optional): If true, cancellation rejects with a message that includes the request id. If false (default), cancellation is silent (wrapper promise does not settle; nothing is logged).

**Example:**

```javascript
// Create with verbose mode enabled
const requestManager = new RequestManager({ verbose: true });
```

### `request(url, requestPromise, options)`

Low-level entry point. Tracks the call by ID and cancels the previous one with the same ID — but **you** must connect abort to the underlying client (`signal`, `cancelToken`, or `addAbortListener`). Otherwise the manager drops the tracked entry while the HTTP request may keep running.

**Parameters:**

- `url` (string): The URL of the request (used to generate request ID from cleaned URL)
- `requestPromise` (Promise|Function|string): A Promise from any HTTP library, a Function that receives `{ options }` and returns a Promise/request object, or a URL string (fetch internally)
- `options` (Object, optional): Configuration options
    - `abortController` (AbortController): AbortController instance (created automatically if not provided)
    - `cancelToken` (Function|Object): Cancel token or cancel function for other libraries
    - `requestKey` (string|number|Function, optional): Key to identify duplicate requests. If provided, requests with the same key will share the same ID and cancel previous ones. If not provided, the cleaned URL is used as the key. Can be a string, number, or function that returns a key.
    - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests. Useful for lazy loading scenarios where multiple requests should execute in parallel.
    - `includeQuery` (boolean): If true, keeps the query string when generating the request ID from the URL.
    - `includeMethod` (boolean): If true (default), the HTTP method is part of the URL-based request ID

> [!TIP]
> When `requestPromise` is a Function, you can pass custom properties in `options`. These will be accessible inside the callback via the `{ options }` parameter.

**Returns:** Promise that resolves/rejects based on the most recent request

**Note:** The request ID is automatically generated from the cleaned URL (protocol and hash removed; query params removed unless `includeQuery` is true; HTTP method included unless `includeMethod` is false) unless `requestKey` is specified. When `noCancel` is true, a unique ID is generated for each request to prevent cancellation. When `requestPromise` is a Function, it receives `{ options }` where `options` contains the `signal` (AbortSignal) and any other fetch options.

### `fetch(url, options)`

Executes an HTTP request using fetch, cancelling any previous request with the same identifier.

**Parameters:**

- `url` (string): The URL to fetch
- `options` (Object, optional): Configuration options (same as `request()` method)
    - `requestKey` (string|number|Function, optional): Key to identify duplicate requests. If not provided, the cleaned URL is used as the key.
    - `abortController` (AbortController): AbortController instance (created automatically if not provided)
    - `cancelToken` (Function|Object): Cancel token or cancel function for other libraries
    - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
    - `includeQuery` (boolean): If true, keeps the query string in the URL-based request ID
    - `includeMethod` (boolean): If true (default), the HTTP method is part of the URL-based request ID

    - Any other properties are passed as fetch options (method, headers, body, etc.)

**Returns:** Promise that resolves/rejects based on the most recent request

**Note:** This is a convenience method that internally calls `request()` with the URL as the requestPromise. The request ID is automatically generated from the cleaned URL unless `requestKey` is specified. When `noCancel` is true, a unique ID is generated for each request.

### `axios(url, options, axiosInstance)`

Executes an HTTP request using axios, cancelling any previous request with the same identifier.

**Parameters:**

- `url` (string): The URL to request
- `options` (Object, optional): Configuration options
    - `requestKey` (string|number|Function, optional): Key to identify duplicate requests. If provided, requests with the same key will cancel previous ones. Can be a string, number, or function that returns a key.
    - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
    - `includeQuery` (boolean): If true, keeps the query string in the URL-based request ID
    - `includeMethod` (boolean): If true (default), the HTTP method is part of the URL-based request ID

    - Any other properties are passed as axios options (method, headers, params, data, etc.)
- `axiosInstance` (Object, optional): Custom axios instance to use. If not provided, uses the global `axios` object.

**Returns:** Promise that resolves/rejects based on the most recent request

**Note:** This method automatically creates an AbortController and passes its `signal` in the axios config, so **cancellation requires axios >= 0.22.0** (the first version supporting `AbortSignal`). Older versions silently ignore the signal; a console warning is emitted when one is detected. The request ID is automatically generated from the cleaned URL unless `requestKey` is specified. When `noCancel` is true, a unique ID is generated for each request.

**Example:**

```javascript
import axios from 'axios';
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// Simple GET request (uses global axios)
requestManager
    .axios('/api/users')
    .then((response) => console.log(response.data))
    .catch((error) => console.error(error));

// With custom axios instance
const apiClient = axios.create({
    baseURL: 'https://api.example.com',
    timeout: 5000,
});

requestManager.axios('/users', {}, apiClient).then((response) => console.log(response.data));

// POST request with options
requestManager
    .axios('/api/users', {
        method: 'POST',
        data: { name: 'John' },
        headers: { 'Content-Type': 'application/json' },
    })
    .then((response) => console.log(response.data));
```

### `ajax(ajaxFunction, url, options)`

Helper for **ajax-style clients** (jQuery.ajax, Ext.Ajax, etc.) that return a request object rather than (or in addition to) a Promise.

Calls `ajaxFunction({ url, ...options })`, then auto-wires cancel by inspecting the returned object:

1. `req.abort` if present (jQuery)
2. else `Ext.Ajax.abort(req)` when Ext is available and `req.xhr` exists
3. else `req.xhr.abort` / raw `XMLHttpRequest.abort`

**Parameters:**

- `ajaxFunction` (Function): Receives `{ url, ...options }` and returns the library request object (or a Promise).
- `url` (string): The URL to request
- `options` (Object, optional): Configuration options
    - `requestKey` (string|number|Function, optional): Key to identify duplicate requests. If provided, requests with the same key will cancel previous ones. Can be a string, number, or function that returns a key.
    - `abortController` (AbortController): AbortController instance (created automatically if not provided)
    - `cancelToken` (Function|Object): Cancel token or cancel function for other libraries
    - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
    - `includeQuery` (boolean): If true, keeps the query string in the URL-based request ID
    - `includeMethod` (boolean): If true (default), the HTTP method is part of the URL-based request ID

    - Any other properties are passed to the ajax method function

**Returns:** Promise that resolves/rejects based on the most recent request

**Example:**

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// jQuery
requestManager
    .ajax($.ajax.bind($), '/api/users', { method: 'GET' })
    .then((data) => console.log(data))
    .catch((error) => console.error(error));

// Ext.Ajax
requestManager.ajax(({ url, ...options }) => Ext.Ajax.request({ url, ...options }), '/api/users');
```

### `xhr(url, options)`

Executes an HTTP request using XMLHttpRequest, cancelling any previous request with the same identifier.

**Parameters:**

- `url` (string): The URL to request
- `options` (Object, optional): Configuration options
    - `method` (string): HTTP method (GET, POST, PUT, DELETE, etc.). Defaults to 'GET'.
    - `headers` (Object): Headers object to set on the request
    - `body` (string|FormData|Blob|ArrayBuffer): Request body
    - `responseType` (string): Response type ('text', 'json', 'blob', 'arraybuffer', 'document'). Defaults to 'text'.
    - `withCredentials` (boolean): Whether to send credentials with the request
    - `timeout` (number): Request timeout in milliseconds
    - `requestKey` (string|number|Function, optional): Key to identify duplicate requests. If provided, requests with the same key will cancel previous ones. Can be a string, number, or function that returns a key.
    - `abortController` (AbortController): AbortController instance (created automatically if not provided)
    - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
    - `includeQuery` (boolean): If true, keeps the query string in the URL-based request ID
    - `includeMethod` (boolean): If true (default), the HTTP method is part of the URL-based request ID

**Returns:** Promise that resolves/rejects based on the most recent request. The resolved value is an object with:

- `data`: The response data (automatically parsed as JSON if Content-Type is application/json)
- `status`: HTTP status code
- `statusText`: HTTP status text
- `headers`: Response headers string
- `xhr`: The XMLHttpRequest instance

**Note:** If you abort the request yourself (via your own `AbortController` or `xhr.abort()`), the returned promise rejects with `{ message: 'Request was cancelled', xhr }` and the manager removes the entry from its active requests.

**Example:**

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// Simple GET request
requestManager
    .xhr('/api/users')
    .then((response) => console.log(response.data))
    .catch((error) => console.error(error));

// POST request with options
requestManager
    .xhr('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }),
        responseType: 'json',
    })
    .then((response) => console.log(response.data));
```

### `getRequestId(url, options)`

Returns the request ID that RequestManager assigns for a URL and options.

**Parameters:**

- `url` (string): The URL used when starting the request
- `options` (Object, optional): Same options used for the request
    - `requestKey` (string|number|Function, optional): Key override
    - `includeQuery` (boolean, optional): Keep query string in the URL-based ID
    - `includeMethod` (boolean, optional): If false, the HTTP method is not part of the URL-based ID (default true)
    - `noCancel` (boolean, optional): If true, returns a **new** unique ID (will not match an already in-flight `noCancel` request)

**Returns:** `string` — the request identifier

**Example:**

```javascript
requestManager.fetch('/api/users');

const id = requestManager.getRequestId('/api/users');
if (requestManager.isActive(id)) {
    requestManager.cancel(id);
}

// With the same options used for the request:
const searchId = requestManager.getRequestId('/api/search?q=test', { requestKey: 'search-users' });
requestManager.cancel(searchId);
```

### `cancel(requestId)`

Cancels a specific request by its identifier.

**Parameters:**

- `requestId` (string): The unique identifier of the request to cancel

**Returns:** `true` if the request was found and cancelled, `false` otherwise

### `cancelAll()`

Cancels all active requests.

**Returns:** The number of requests that were cancelled

### `isActive(requestId)`

Checks if a request with the given identifier is currently active.

**Parameters:**

- `requestId` (string): The unique identifier to check

**Returns:** `true` if the request is active, `false` otherwise

### `getActiveCount()`

Gets the number of active requests.

**Returns:** The number of currently active requests

### `clear()`

Clears all active requests without cancelling them. Use with caution - this will not cancel the underlying HTTP requests.

### `getSignal()`

Creates a new AbortController and returns its signal for the next `request()` (one `getSignal` → one request). Do not use for parallel requests; use `fetch()`, `axios()`, or `request(url, ({ options }) => ...)` instead — they create their own signal.

**Returns:** AbortSignal from a new AbortController

**Example:**

```javascript
const signal = requestManager.getSignal();
requestManager.request('/api/users', fetch('/api/users', { signal }));
```

### `getAbortController()`

Creates a new AbortController for the next request handoff. Always returns a fresh controller (never reuses one from another in-flight request).

**Returns:** AbortController instance

**Example:**

```javascript
const abortController = requestManager.getAbortController();
requestManager.request('/api/users', fetch('/api/users', { signal: abortController.signal }));
```

### `getOptions()`

Gets the manager options that were passed to the constructor or set via `setOptions`.

**Returns:** Object containing the manager options

### `setOptions(options)`

Sets the manager options.

**Parameters:**

- `options` (Object): Configuration options
    - `verbose` (boolean, optional): If true, cancellation rejects with a message that includes the request id. If false (default), cancellation is silent.

**Example:**

```javascript
const requestManager = new RequestManager();

// Enable verbose cancellation messages at runtime
requestManager.setOptions({ verbose: true });

// Silent cancellation (default) — no rejection / no console noise
requestManager.setOptions({ verbose: false });
```

### `addAbortListener(abortMethod, signal)`

Links an abort signal with an HTTP client abort method. Useful for custom HTTP clients that only support the abort method to cancel requests.

**Parameters:**

- `abortMethod` (Function): The abort method to call when the signal is aborted
- `signal` (AbortSignal): The signal to listen to

**Example:**

```javascript
const abortController = new AbortController();
const req = $.ajax({ url });
requestManager.addAbortListener(req.abort, abortController.signal);
requestManager.request(url, req, { abortController: abortController });
```

## Browser Support

Bundles are transpiled with Babel (`@babel/preset-env`), so modern syntax does not leak into `dist/`.

| Environment    | Supported                   |
| -------------- | --------------------------- |
| Chrome / Edge  | Last 2 versions             |
| Firefox        | Last 2 versions + ESR       |
| Safari         | ≥ 10                        |
| Node.js        | ≥ 14                        |
| Module formats | ESM · CommonJS · UMD · IIFE |

## Contributing

Issues and pull requests are welcome at [github.com/enegalan/request-manager](https://github.com/enegalan/request-manager).

```bash
git clone https://github.com/enegalan/request-manager.git
cd request-manager
npm install

npm test           # run the test suite
npm run test:watch # run tests on file changes
npm run lint       # check code style
npm run build      # generate dist/ bundles
```

## License

[MIT](LICENSE) © [Eneko Galan](https://github.com/enegalan)
