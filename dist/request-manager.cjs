'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _assertClassBrand(e, t, n) {
  if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n;
  throw new TypeError("Private element is not present on this object");
}
function _checkPrivateRedeclaration(e, t) {
  if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object");
}
function _classPrivateMethodInitSpec(e, a) {
  _checkPrivateRedeclaration(e, a), a.add(e);
}
function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e,
      n,
      i,
      u,
      a = [],
      f = true,
      o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) ; else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
    } catch (r) {
      o = true, n = r;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), true).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r);
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}

var _RequestManager_brand = /*#__PURE__*/new WeakSet();
/**
 * RequestManager - A library for managing and regulating HTTP requests efficiently.
 * @license MIT
 * @author Eneko Galan <enekogalanelorza@gmail.com>
 * This library allows you to manage HTTP requests from any library (ajax, Ext.Ajax, axios, fetch, etc.)
 * by accepting Promises as parameters. When a request is repeated with the same identifier,
 * the previous request is automatically cancelled and the new one is executed, giving priority to the most recent requests.
 */
class RequestManager {
  constructor() {
    var _options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    /**
     * Resolves the AbortController for a request: explicit option, pending handoff, or new.
     * Clears the pending handoff so concurrent requests do not share it.
     * @param {AbortController|undefined} provided - Optional AbortController from options
     * @returns {AbortController}
     * @private
     */
    _classPrivateMethodInitSpec(this, _RequestManager_brand);
    /**
     * @type {Map<string, import('./index.d.ts').ActiveRequest>}
     */
    this.activeRequests = new Map();
    /**
     * @type {import('./index.d.ts').Options}
     */
    this.options = _options;
    /**
     * One-shot AbortController for getSignal()/getAbortController() handoff.
     * Consumed by the next request that does not pass options.abortController.
     * @type {AbortController|null}
     */
    this.abortController = null;
  }

  /**
   * Gets the manager options
   * @returns {import('./index.d.ts').Options} Manager options
   */
  getOptions() {
    return this.options;
  }

  /**
   * Sets the manager options
   * @param {import('./index.d.ts').Options} options - The options to set
   */
  setOptions(options) {
    this.options = options;
  }

  /**
   * Creates a new AbortController and returns its signal for the next request()
   * (one getSignal → one request). Do not use for parallel requests; use fetch(),
   * axios(), or request(url, ({ options }) => ...) instead — they create their own signal.
   * @returns {AbortSignal} The signal from a new AbortController
   * @example
   * const signal = requestManager.getSignal();
   * requestManager.request('/api/users', fetch('/api/users', { signal }));
   */
  getSignal() {
    return this.getAbortController().signal;
  }

  /**
   * Creates a new AbortController for the next request handoff.
   * Always returns a fresh controller (never reuses one from another in-flight request).
   * @returns {AbortController} A new AbortController instance
   */
  getAbortController() {
    this.abortController = new AbortController();
    return this.abortController;
  }

  /**
   * Gets the active requests
   * @returns {Map<string, import('./index.d.ts').ActiveRequest>} The active requests
   */
  getActiveRequests() {
    return this.activeRequests;
  }

  /**
   * Gets the active request by its identifier
   * @param {string} requestId - The unique identifier of the request
   * @returns {import('./index.d.ts').ActiveRequest|undefined} The active request or undefined if not found
   */
  getActiveRequest(requestId) {
    return this.activeRequests.get(requestId);
  }

  /**
   * Checks if a request with the given identifier is currently active.
   * @param {string} requestId - The unique identifier to check
   * @returns {boolean} True if the request is active, false otherwise
   */
  isActive(requestId) {
    return this.activeRequests.has(requestId);
  }

  /**
   * Gets the number of active requests.
   * @returns {number} The number of currently active requests
   */
  getActiveCount() {
    return this.activeRequests.size;
  }

  /**
   * Clears all active requests without cancelling them.
   * Use with caution - this will not cancel the underlying HTTP requests.
   */
  clear() {
    this.activeRequests.clear();
  }

  /**
   * Executes an HTTP request, cancelling any previous request with the same identifier.
   * @param {string} url - The URL to request
   * @param {Promise|import('./index.d.ts').RequestFunction|string} requestPromise - The request promise or function that returns a promise
   * @param {import('./index.d.ts').RequestOptions} options - Optional configuration
   * @returns {Promise} A Promise that resolves/rejects based on the most recent request
   * @example
   * // Request with Promise
   * requestManager.request('/api/users', axios.get('/api/users'));
   * @example
   * // Request with Function
   * requestManager.request('/api/users', ({ options }) => fetch('/api/users', { signal: options.signal, ...options }));
   * @example
   * // Request with Promise and custom cancellation grouping with requestKey
   * const options = {
   *   requestKey: 'get-users'
   * }
   * requestManager.request('/api/users', axios.get('/api/users', options), options);
   */
  request(url, requestPromise) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    return _assertClassBrand(_RequestManager_brand, this, _request).call(this, this.getRequestId(url, options), requestPromise, options);
  }

  /**
   * Executes an HTTP request using fetch, cancelling any previous request with the same identifier.
   * @param {string} url - The URL to fetch
   * @param {import('./index.d.ts').FetchOptions} options - Optional configuration
   * @returns {Promise} A Promise that resolves/rejects based on the most recent request
   * @example
   * // Simple GET request
   * requestManager.fetch('/api/users');
   * @example
   * // POST request with options
   * requestManager.fetch('/api/users', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify({ name: 'John' })
   * });
   * @example
   * // Request with requestKey for custom cancellation grouping with requestKey
   * requestManager.fetch('/api/users', {
   *   requestKey: 'get-users'
   * });
   */
  fetch(url) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return _assertClassBrand(_RequestManager_brand, this, _request).call(this, this.getRequestId(url, options), url, options);
  }

  /**
   * Executes an HTTP request using axios, cancelling any previous request with the same identifier.
   * @param {string} url - The URL to request
   * @param {import('./index.d.ts').AxiosRequestOptions} options - Optional configuration
   * @param {import('./index.d.ts').AxiosInstance|import('./index.d.ts').AxiosStatic|null} axiosInstance - Optional axios instance to use. If not provided, uses global axios.
   * @returns {Promise} A Promise that resolves/rejects based on the most recent request
   * @example
   * // Simple GET request (uses global axios)
   * requestManager.axios('/api/users');
   * @example
   * // With custom axios instance
   * const myAxios = axios.create({ baseURL: 'https://api.example.com' });
   * requestManager.axios('/users', {}, myAxios);
   * @example
   * // POST request with options
   * requestManager.axios('/api/users', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify({ name: 'John' })
   * });
   * @example
   * // Request with requestKey for custom cancellation grouping with requestKey
   * requestManager.axios('/api/users', {
   *   requestKey: 'get-users'
   * });
   */
  axios(url) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var axiosInstance = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var axiosLib = axiosInstance || (typeof axios !== 'undefined' ? axios : null);
    if (!axiosLib) {
      throw new Error('axios was not found: pass an axios instance as the third argument of requestManager.axios() or make sure axios is available globally');
    }
    _assertClassBrand(_RequestManager_brand, this, _checkAxiosVersion).call(this, axiosLib);
    return _assertClassBrand(_RequestManager_brand, this, _request).call(this, this.getRequestId(url, options), _ref => {
      var requestOptions = _ref.options;
      return axiosLib(_objectSpread2({
        url
      }, requestOptions));
    }, options);
  }

  /**
   * Executes an HTTP request using jQuery.ajax, cancelling any previous request with the same identifier.
   * @param {import('./index.d.ts').AjaxFunction} ajaxFunction - A function that receives { url, ...options } and returns a Promise
   * @param {string} url - The URL to request
   * @param {import('./index.d.ts').BaseRequestOptions & Record<string, any>} options - Optional configuration
   * @returns {Promise} A Promise that resolves/rejects based on the most recent request
   * @example
   * // Simple GET request
   * requestManager.ajax(ajaxFunction, '/api/users');
   * @example
   * // POST request with options
   * requestManager.ajax(ajaxFunction, '/api/users', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify({ name: 'John' })
   * });
   * @example
   * // Request with requestKey for custom cancellation grouping with requestKey
   * requestManager.ajax(ajaxFunction, '/api/users', {
   *   requestKey: 'get-users'
   * });
   */
  ajax(ajaxFunction, url) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    if (typeof ajaxFunction !== 'function') throw new Error('ajaxFunction parameter must be a function');
    return _assertClassBrand(_RequestManager_brand, this, _request).call(this, this.getRequestId(url, options), _ref2 => {
      var requestOptions = _ref2.options;
      return ajaxFunction(_objectSpread2({
        url
      }, requestOptions));
    }, options);
  }

  /**
   * Executes an HTTP request using XMLHttpRequest, cancelling any previous request with the same identifier.
   * @param {string} url - The URL to request
   * @param {import('./index.d.ts').XhrOptions} options - Optional configuration
   * @returns {Promise<XMLHttpRequest>} A Promise that resolves with the XHR instance (or rejects on error)
   * @example
   * // Simple GET request
   * requestManager.xhr('/api/users');
   * @example
   * // POST request with options
   * requestManager.xhr('/api/users', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify({ name: 'John' })
   * });
   * @example
   * // Request with requestKey for custom cancellation grouping
   * requestManager.xhr('/api/users', {
   *   requestKey: 'get-users'
   * });
   */
  xhr(url) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return _assertClassBrand(_RequestManager_brand, this, _request).call(this, this.getRequestId(url, options), () => {
      var xhr = new XMLHttpRequest();
      var method = (options.method || 'GET').toUpperCase();
      xhr.open(method, url, true);
      if (options.responseType) xhr.responseType = options.responseType;
      if (options.withCredentials !== undefined) xhr.withCredentials = options.withCredentials;
      if (options.timeout !== undefined) xhr.timeout = options.timeout;
      if (options.headers) {
        Object.keys(options.headers).forEach(key => {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }
      xhr.send(options.body || null);
      return xhr;
    }, options);
  }

  /**
   * Returns the request identifier for a URL and options.
   * @param {string} url - The URL used when starting the request
   * @param {import('./index.d.ts').BaseRequestOptions} options - Same options used for the request
   * @returns {string} The request identifier
   * @example
   * requestManager.fetch('/api/users');
   * const id = requestManager.getRequestId('/api/users');
   * requestManager.cancel(id);
   */
  getRequestId(url) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var requestKey = options.requestKey;
    var prefix = 'request_';

    // Generate a unique identifier to prevent cancellation for non cancelable requests
    if (options.noCancel) {
      return "".concat(prefix).concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 11));
    }

    // Handle function requestKey
    if (typeof requestKey === 'function') {
      try {
        requestKey = requestKey(options);
      } catch (_unused) {
        requestKey = null;
      }
    }
    if (requestKey != null) return "".concat(prefix).concat(String(requestKey));

    // Use cleaned URL as key as fallback
    var cleanedUrl = url || '';
    if (cleanedUrl.includes('://')) cleanedUrl = cleanedUrl.split('://')[1];
    if (cleanedUrl.includes('#')) cleanedUrl = cleanedUrl.split('#')[0];
    if (!options.includeQuery && cleanedUrl.includes('?')) cleanedUrl = cleanedUrl.split('?')[0];
    var methodPrefix = options.includeMethod === false ? '' : "".concat((options.method || options.type || 'GET').toUpperCase(), "_");
    return "".concat(prefix).concat(methodPrefix).concat(cleanedUrl);
  }

  /**
   * Cancels a specific request by its identifier.
   * @param {string} requestId - The unique identifier of the request to cancel
   * @returns {boolean} True if the request was found and cancelled, false otherwise
   */
  cancel(requestId) {
    /** @type {import('./index.d.ts').ActiveRequest|undefined} */
    var request = this.getActiveRequest(requestId);
    if (!request) return false;
    request.isCancelled = true; // Mark as cancelled

    // Try to abort using AbortController (for fetch)
    if (request.abortController && !request.abortController.signal.aborted) {
      try {
        request.abortController.abort('Request was cancelled');
      } catch (error) {}
    }

    // Try to cancel using cancel token/function (for axios and others)
    if (request.cancelToken) {
      try {
        if (typeof request.cancelToken === 'function') request.cancelToken();else if (request.cancelToken.cancel) request.cancelToken.cancel();
      } catch (error) {}
    }

    // Reject the wrapper promise
    var error = this.getOptions().verbose ? new Error("Request ".concat(requestId, " was cancelled")) : null;
    _assertClassBrand(_RequestManager_brand, this, _handleRequestFinish).call(this, requestId, error != null, () => request.rejectWrapper(error));
    return true;
  }

  /**
   * Link abort signal with HTTP client abort method.
   * Useful for custom HTTP clients that only support the abort method to cancel requests.
   * @param {Function} abortMethod - The abort method to call when the signal is aborted
   * @param {AbortSignal} signal - The signal to listen to
   */
  addAbortListener(abortMethod, signal) {
    if (!abortMethod || !signal) return;
    signal.addEventListener('abort', () => {
      if (typeof abortMethod === 'function') {
        try {
          abortMethod();
        } catch (error) {}
      }
    });
  }

  /**
   * Cancels all active requests.
   * @returns {number} The number of requests that were cancelled
   */
  cancelAll() {
    var requestIds = Array.from(this.getActiveRequests().keys());
    var cancelledCount = 0;
    requestIds.forEach(requestId => {
      if (this.cancel(requestId)) cancelledCount++;
    });
    return cancelledCount;
  }
}
function _resolveAbortController(provided) {
  var abortController = provided || this.abortController || new AbortController();
  this.abortController = null;
  return abortController;
}
/**
 * Picks the best abort callback for a client request object.
 * @param {Object} req - The request object
 * @returns {Function|null}
 * @private
 */
function _resolveAbortMethod(req) {
  if (!req) return null;
  if (typeof req.abort === 'function') return () => req.abort();
  var ExtAjax = typeof globalThis !== 'undefined' && globalThis.Ext && globalThis.Ext.Ajax ? globalThis.Ext.Ajax : null;
  if (req.xhr && ExtAjax && typeof ExtAjax.abort === 'function') {
    return () => ExtAjax.abort(req);
  }
  if (req.xhr && typeof req.xhr.abort === 'function') return () => req.xhr.abort();
  return null;
}
/**
 * Prepares request options by merging options and removing custom properties
 * @param {import('./index.d.ts').RequestOptions} options - Configuration options
 * @param {AbortSignal} signal - Abort signal to add to request options
 * @returns {Object} Prepared request options
 * @private
 */
function _prepareRequestOptions(options, signal) {
  var requestOptions = {};
  var customOptions = ['abortController', 'cancelToken', 'requestKey', 'noCancel', 'includeQuery', 'includeMethod', 'verbose'];
  Object.keys(options).forEach(key => {
    if (customOptions.includes(key)) return;
    requestOptions[key] = options[key];
  });
  requestOptions.signal = signal;
  return requestOptions;
}
/**
 * Warns when the provided axios instance predates 0.22.0, the first version
 * supporting AbortSignal cancellation. Older instances silently ignore
 * options.signal, so duplicate requests would not be cancelled.
 * @param {object} axiosLib - The axios instance about to be used
 * @private
 */
function _checkAxiosVersion(axiosLib) {
  var version = typeof (axiosLib === null || axiosLib === void 0 ? void 0 : axiosLib.VERSION) === 'string' ? axiosLib.VERSION : null;
  if (!version) return;
  var _version$split$map = version.split('.').map(Number),
    _version$split$map2 = _slicedToArray(_version$split$map, 2),
    major = _version$split$map2[0],
    minor = _version$split$map2[1];
  if (major === 0 && minor < 22) {
    console.warn("[request-manager] axios >= 0.22.0 is required: axios ".concat(version, " ignores the AbortSignal used for automatic cancellation. Please upgrade axios."));
  }
}
/**
 * Handles the completion of a request by deleting it from the active requests map and resolving/rejecting the wrapper promise
 * @param {string} requestId - The unique identifier of the request
 * @param {boolean} condition - The condition to resolve/reject the wrapper promise
 * @param {Function} wrapperPromise - The function to resolve/reject the wrapper promise
 * @private
 */
function _handleRequestFinish(requestId, condition, wrapperPromise) {
  this.getActiveRequests().delete(requestId);
  if (condition) {
    wrapperPromise();
  }
}
/**
 * Internal method that handles the core request logic.
 * @param {string} requestId - Unique identifier for the request
 * @param {Promise|import('./index.d.ts').RequestFunction|string} requestPromise - The request promise, function, or URL string
 * @param {import('./index.d.ts').BaseRequestOptions} options - Configuration options
 * @returns {Promise} A Promise that resolves/rejects based on the most recent request
 * @private
 */
function _request(requestId, requestPromise) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var abortController = _assertClassBrand(_RequestManager_brand, this, _resolveAbortController).call(this, options.abortController);

  // Handle different types of requestPromise inputs
  // Priority: Function (Custom logic) > String (URL) > Promise (axios, fetch, etc.)
  if (typeof requestPromise === 'function') {
    // Function: custom logic for any library (axios, ajax, etc.)
    try {
      requestPromise = requestPromise({
        options: _assertClassBrand(_RequestManager_brand, this, _prepareRequestOptions).call(this, options, abortController.signal)
      });
    } catch (error) {
      return Promise.reject(error);
    }
  } else if (typeof requestPromise === 'string') {
    // String (URL): make fetch internally
    try {
      requestPromise = fetch(requestPromise, _assertClassBrand(_RequestManager_brand, this, _prepareRequestOptions).call(this, options, abortController.signal));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  // Link the request object's abort method (Ext.Ajax, XHR, etc.) to the cancellation signal
  this.addAbortListener(_assertClassBrand(_RequestManager_brand, this, _resolveAbortMethod).call(this, requestPromise), abortController.signal);

  // Ext.Ajax / raw XHR: wrap so settle matches thenable clients (resolve ok, reject on error)
  if (!requestPromise || typeof requestPromise.then !== 'function') {
    var raw = requestPromise;
    var xhr = (raw === null || raw === void 0 ? void 0 : raw.xhr) || (typeof XMLHttpRequest !== 'undefined' && raw instanceof XMLHttpRequest ? raw : null) || (typeof (raw === null || raw === void 0 ? void 0 : raw.addEventListener) === 'function' && typeof (raw === null || raw === void 0 ? void 0 : raw.abort) === 'function' ? raw : null);
    requestPromise = new Promise((resolve, reject) => {
      if (!xhr || typeof xhr.addEventListener !== 'function') {
        resolve(raw);
        return;
      }
      var timedOut = false;
      xhr.addEventListener('timeout', () => {
        timedOut = true;
      });
      xhr.addEventListener('loadend', () => {
        if (xhr.aborted) return reject({
          message: 'Request was cancelled',
          xhr
        });
        if (timedOut) return reject({
          message: 'Request timeout',
          xhr
        });
        if (xhr.status < 200 || xhr.status >= 300) {
          if (xhr.status === 0) return reject({
            message: 'Network error',
            xhr
          });
          return reject({
            message: "Request failed with status ".concat(xhr.status),
            status: xhr.status,
            statusText: xhr.statusText,
            xhr
          });
        }
        resolve(raw);
      });
    });
  }

  // Cancel previous request with the same identifier if it exists
  if (!options.noCancel) this.cancel(requestId);

  // Create a wrapper promise that will be resolved/rejected based on the request
  var resolveWrapper, rejectWrapper;
  var wrapperPromise = new Promise((resolve, reject) => {
    resolveWrapper = resolve;
    rejectWrapper = reject;
  });

  /**
   * @type {import('./index.d.ts').ActiveRequest}
   */
  var request = {
    promise: requestPromise,
    abortController: abortController,
    cancelToken: options.cancelToken || null,
    resolveWrapper: resolveWrapper,
    rejectWrapper: rejectWrapper,
    isCancelled: false
  };
  this.getActiveRequests().set(requestId, request);

  // Handle request promise completion
  try {
    var req = requestPromise.then(result => {
      if (this.getActiveRequest(requestId) !== request) return;
      _assertClassBrand(_RequestManager_brand, this, _handleRequestFinish).call(this, requestId, !request.isCancelled, () => resolveWrapper(result));
    });
    if (req.catch) req.catch(error => {
      onError(this, error);
    });
  } catch (error) {
    onError(this, error);
  }
  function onError(scope, error) {
    // Check if this request is still the active one, or if it was cancelled
    if (scope.getActiveRequest(requestId) !== request) return;
    if (request.isCancelled) {
      // Already cancelled: let cancel() handle cleanup and reject the wrapper promise
      scope.cancel(requestId);
      return;
    }
    // Only delete if this is still the active request
    _assertClassBrand(_RequestManager_brand, scope, _handleRequestFinish).call(scope, requestId, error != null, () => rejectWrapper(error));
  }
  return wrapperPromise;
}

exports.RequestManager = RequestManager;
exports.default = RequestManager;
//# sourceMappingURL=request-manager.cjs.map
