# @enegalan/request-manager

[![npm version](https://img.shields.io/npm/v/@enegalan/request-manager.svg)](https://www.npmjs.com/package/@enegalan/request-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

RequestManager is a JavaScript library designed to manage and regulate HTTP requests efficiently. It allows you to use HTTP calls from any library (ajax, Ext.Ajax, axios, fetch, etc.) by accepting Promises as parameters.

## Key Features

- **Universal Compatibility**: Works with any HTTP library that returns a Promise (fetch, axios, Ext.Ajax, etc.)
- **Automatic Cancellation**: When a request is repeated with the same `requestKey`, the previous request is automatically cancelled. This identifier is generated with `url` parameter or can be manually specified in `options`.
- **Prioritizes Recent Requests**: The library ensures that only the most recent request is processed, cancelling older ones
- **Simple API**: Easy to use and integrate into existing projects
- **Adapt to your requirements**: The library supports `options` for custom request management
- **TypeScript Support**: Full TypeScript type definitions included
- **Multiple Module Formats**: ESM, CommonJS, and UMD builds available

## Installation

```bash
npm install @enegalan/request-manager
```

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

## Usage

### Basic Example with fetch()

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

requestManager.fetch('/api/users')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => {
    if (error.message === 'Request was cancelled') {
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

requestManager.fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' })
})
.then(response => response.json())
.then(data => console.log(data));
```

### Using request() with Promise

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

requestManager.request('/api/users', fetch('/api/users'))
  .then(response => response.json())
  .then(data => console.log(data));
```

### Using request() with Function

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// Custom logic
requestManager.request('/api/users', ({ options }) => {
  return fetch('/api/users', options);
})
.then(response => response.json())
.then(data => console.log(data));
```

### Automatic Cancellation with Same URL

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// By default, requests with the same URL (cleaned) will cancel previous ones
// The URL is automatically cleaned (protocol and query params removed) to generate the request ID
requestManager.fetch('/api/search?q=test')
  .catch(error => {
    console.log('First request cancelled:', error.message);
  });

// This second request will automatically cancel the first one
// because they share the same cleaned URL
setTimeout(() => {
  requestManager.fetch('/api/search?q=updated')
    .then(response => response.json())
    .then(data => console.log('Second request completed:', data));
}, 100);
```

### Using requestKey to Override URL-based ID

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// You can use requestKey to override the default URL-based ID generation
requestManager.fetch('/api/search?q=test', {
  requestKey: 'search-users' // Custom key instead of cleaned URL
})
.catch(error => {
  console.log('First request cancelled:', error.message);
});

// This second request will cancel the first one because they share the same requestKey
setTimeout(() => {
  requestManager.fetch('/api/search?q=updated', {
    requestKey: 'search-users' // Same key = same request ID = cancellation
  })
  .then(response => response.json())
  .then(data => console.log('Second request completed:', data));
}, 100);
```

### Using requestKey with Function

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// You can use a function to generate the requestKey dynamically
function searchUsers(query) {
  return requestManager.fetch(`/api/search?q=${query}`, {
    requestKey: () => `search-${query}` // Function that returns the key
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
requestManager.fetch('/api/lazy?load=1', { noCancel: true })
  .then(response => response.json())
  .then(data => console.log('Load 1:', data));

requestManager.fetch('/api/lazy?load=2', { noCancel: true })
  .then(response => response.json())
  .then(data => console.log('Load 2:', data));

requestManager.fetch('/api/lazy?load=3', { noCancel: true })
  .then(response => response.json())
  .then(data => console.log('Load 3:', data));

// All three requests will execute concurrently without canceling each other
// Even though they share the same cleaned URL (without query params)
```

### Using with Axios

```javascript
import axios from 'axios';
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

const CancelToken = axios.CancelToken;
const source = CancelToken.source();

requestManager.request('/api/users', axios.get('/api/users', {
  cancelToken: source.token
}), {
  cancelToken: () => source.cancel()
})
.then(response => console.log(response.data))
.catch(error => {
  if (axios.isCancel(error)) {
    console.log('Request was cancelled');
  } else {
    console.error('Request failed:', error);
  }
});
```

### Using with Axios and Function

```javascript
import axios from 'axios';
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

requestManager.request('/api/users', ({ options }) => {
  const CancelToken = axios.CancelToken;
  const source = CancelToken.source();
  return axios.get('/api/users', { cancelToken: source.token });
})
.then(response => console.log(response.data))
.catch(error => {
  if (axios.isCancel(error)) {
    console.log('Request was cancelled');
  } else {
    console.error('Request failed:', error);
  }
});
```

### Using with Other Libraries

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

requestManager.request('/api/data', ({ options }) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(new Error('Request failed'));
    xhr.send();
    
    // Use signal to cancel if needed
    options.signal.addEventListener('abort', () => {
      xhr.abort();
      reject(new Error('Request was cancelled'));
    });
  });
})
.then(data => console.log(data))
.catch(error => console.error(error));
```

### Using with Pre-created Promises

```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

const existingPromise = fetch('/api/data');

requestManager.request('/api/data', existingPromise, {
  // You can still provide cancelToken if your library supports it
  cancelToken: () => {
    // Custom cancellation logic
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

## API Reference

### `new RequestManager(options)`

Creates a new RequestManager instance.

**Parameters:**
- `options` (Object, optional): Configuration options
  - `verbose` (boolean, optional): If true, cancellation errors will include messages globally for all requests.

**Example:**
```javascript
// Create with verbose mode enabled
const requestManager = new RequestManager({ verbose: true });
```

### `request(url, requestPromise, options)`

Executes an HTTP request, cancelling any previous request with the same identifier.

**Parameters:**
- `url` (string): The URL of the request (used to generate request ID from cleaned URL)
- `requestPromise` (Promise|Function|string): The Promise returned by any HTTP library (fetch, axios, etc.), a Function that can receive `{ options }` and returns a Promise, or a URL string (which will be used with fetch internally)
- `options` (Object, optional): Configuration options
  - `abortController` (AbortController): AbortController instance (created automatically if not provided)
  - `cancelToken` (Function|Object): Cancel token or cancel function for other libraries
  - `requestKey` (string|number|Function, optional): Key to identify duplicate requests. If provided, requests with the same key will share the same ID and cancel previous ones. If not provided, the cleaned URL is used as the key. Can be a string, number, or function that returns a key.
  - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests. Useful for lazy loading scenarios where multiple requests should execute in parallel.

> [!TIP]
> When `requestPromise` is a Function, you can pass custom properties in `options`. These will be accessible inside the callback via the `{ options }` parameter.

**Returns:** Promise that resolves/rejects based on the most recent request

**Note:** The request ID is automatically generated from the cleaned URL (protocol and query params removed) unless `requestKey` is specified. When `noCancel` is true, a unique ID is generated for each request to prevent cancellation. When `requestPromise` is a Function, it receives `{ options }` where `options` contains the `signal` (AbortSignal) and any other fetch options.

### `fetch(url, options)`

Executes an HTTP request using fetch, cancelling any previous request with the same identifier.

**Parameters:**
- `url` (string): The URL to fetch
- `options` (Object, optional): Configuration options (same as `request()` method)
  - `requestKey` (string|number|Function, optional): Key to identify duplicate requests. If not provided, the cleaned URL is used as the key.
  - `abortController` (AbortController): AbortController instance (created automatically if not provided)
  - `cancelToken` (Function|Object): Cancel token or cancel function for other libraries
  - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
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
  - Any other properties are passed as axios options (method, headers, params, data, etc.)
- `axiosInstance` (Object, optional): Custom axios instance to use. If not provided, uses the global `axios` object.

**Returns:** Promise that resolves/rejects based on the most recent request

**Note:** This method automatically creates a CancelToken for axios cancellation. The request ID is automatically generated from the cleaned URL unless `requestKey` is specified. When `noCancel` is true, a unique ID is generated for each request.

**Example:**
```javascript
import axios from 'axios';
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// Simple GET request (uses global axios)
requestManager.axios('/api/users')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));

// With custom axios instance
const apiClient = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000
});

requestManager.axios('/users', {}, apiClient)
  .then(response => console.log(response.data));

// POST request with options
requestManager.axios('/api/users', {
  method: 'POST',
  data: { name: 'John' },
  headers: { 'Content-Type': 'application/json' }
})
.then(response => console.log(response.data));
```

### `ajax(ajaxFunction, url, options)`

Executes an HTTP request using a custom ajax method function, cancelling any previous request with the same identifier.

**Parameters:**
- `ajaxFunction` (Function): A function that receives `{ url, ...options }` and returns a Promise. The function should accept an object with `url` and other options including the `signal` (AbortSignal).
- `url` (string): The URL to request
- `options` (Object, optional): Configuration options
  - `requestKey` (string|number|Function, optional): Key to identify duplicate requests. If provided, requests with the same key will cancel previous ones. Can be a string, number, or function that returns a key.
  - `abortController` (AbortController): AbortController instance (created automatically if not provided)
  - `cancelToken` (Function|Object): Cancel token or cancel function for other libraries
  - `verbose` (boolean): If true, cancellation errors will include messages
  - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
  - Any other properties are passed to the ajax method function

**Returns:** Promise that resolves/rejects based on the most recent request

**Example:**
```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// Using with jQuery.ajax
requestManager.ajax(
  ({ url, ...options }) => {
    return new Promise((resolve, reject) => {
      $.ajax({
        url: url,
        ...options,
        success: resolve,
        error: reject
      });
    });
  },
  '/api/users',
  {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  }
)
.then(data => console.log(data))
.catch(error => console.error(error));
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
  - `verbose` (boolean): If true, cancellation errors will include messages
  - `noCancel` (boolean): If true, this request will not cancel previous requests with the same ID, allowing concurrent requests

**Returns:** Promise that resolves/rejects based on the most recent request. The resolved value is an object with:
  - `data`: The response data (automatically parsed as JSON if Content-Type is application/json)
  - `status`: HTTP status code
  - `statusText`: HTTP status text
  - `headers`: Response headers string
  - `xhr`: The XMLHttpRequest instance

**Example:**
```javascript
import RequestManager from '@enegalan/request-manager';

const requestManager = new RequestManager();

// Simple GET request
requestManager.xhr('/api/users')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));

// POST request with options
requestManager.xhr('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' }),
  responseType: 'json'
})
.then(response => console.log(response.data));
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

Gets the AbortSignal from the current AbortController. Creates a new AbortController if one doesn't exist or if the current one is aborted.

**Returns:** AbortSignal from the current AbortController

**Example:**
```javascript
const signal = requestManager.getSignal();
requestManager.request('/api/users', fetch('/api/users', { signal }));
```

### `getAbortController()`

Gets the current AbortController instance. Creates a new AbortController if one doesn't exist or if the current one is aborted.

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
  - `verbose` (boolean, optional): If true, cancellation errors will include messages

**Example:**
```javascript
const requestManager = new RequestManager();

// Enable verbose mode at runtime
requestManager.setOptions({ verbose: true });

// Disable verbose mode
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
