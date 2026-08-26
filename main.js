/**
 * RequestManager - A library for managing and regulating HTTP requests efficiently.
 * @license MIT
 * @author Eneko Galan <enekogalanelorza@gmail.com>
 * This library allows you to manage HTTP requests from any library (ajax, Ext.Ajax, axios, fetch, etc.)
 * by accepting Promises as parameters. When a request is repeated with the same identifier,
 * the previous request is automatically cancelled and the new one is executed, giving priority to the most recent requests.
 */
class RequestManager {
    constructor(options = {}) {
        /**
         * @type {Map<string, import('./index.d.ts').ActiveRequest>}
         */
        this.activeRequests = new Map();
        /**
         * @type {import('./index.d.ts').Options}
         */
        this.options = options;
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
    request(url, requestPromise, options = {}) {
        return this.#_request(this.getRequestId(url, options), requestPromise, options);
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
    fetch(url, options = {}) {
        return this.#_request(this.getRequestId(url, options), url, options);
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
    axios(url, options = {}, axiosInstance = null) {
        const axiosLib = axiosInstance || (typeof axios !== 'undefined' ? axios : null);
        if (!axiosLib) {
            throw new Error(
                'axios was not found: pass an axios instance as the third argument of requestManager.axios() or make sure axios is available globally'
            );
        }
        this.#_checkAxiosVersion(axiosLib);
        return this.#_request(
            this.getRequestId(url, options),
            ({ options: requestOptions }) => axiosLib({ url, ...requestOptions }),
            options
        );
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
    ajax(ajaxFunction, url, options = {}) {
        if (typeof ajaxFunction !== 'function') throw new Error('ajaxFunction parameter must be a function');
        return this.#_request(
            this.getRequestId(url, options),
            ({ options: requestOptions }) => ajaxFunction({ url, ...requestOptions }),
            options
        );
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
    xhr(url, options = {}) {
        return this.#_request(
            this.getRequestId(url, options),
            () => {
                const xhr = new XMLHttpRequest();
                const method = (options.method || 'GET').toUpperCase();
                xhr.open(method, url, true);
                if (options.responseType) xhr.responseType = options.responseType;
                if (options.withCredentials !== undefined) xhr.withCredentials = options.withCredentials;
                if (options.timeout !== undefined) xhr.timeout = options.timeout;
                if (options.headers) {
                    Object.keys(options.headers).forEach((key) => {
                        xhr.setRequestHeader(key, options.headers[key]);
                    });
                }
                xhr.send(options.body || null);
                return xhr;
            },
            options
        );
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
    getRequestId(url, options = {}) {
        let requestKey = options.requestKey;

        const prefix = 'request_';

        // Generate a unique identifier to prevent cancellation for non cancelable requests
        if (options.noCancel) {
            return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        }

        // Handle function requestKey
        if (typeof requestKey === 'function') {
            try {
                requestKey = requestKey(options);
            } catch {
                requestKey = null;
            }
        }
        if (requestKey != null) return `${prefix}${String(requestKey)}`;

        // Use cleaned URL as key as fallback
        let cleanedUrl = url || '';
        if (cleanedUrl.includes('://')) cleanedUrl = cleanedUrl.split('://')[1];
        if (cleanedUrl.includes('#')) cleanedUrl = cleanedUrl.split('#')[0];
        if (!options.includeQuery && cleanedUrl.includes('?')) cleanedUrl = cleanedUrl.split('?')[0];

        const methodPrefix =
            options.includeMethod === false ? '' : `${(options.method || options.type || 'GET').toUpperCase()}_`;

        return `${prefix}${methodPrefix}${cleanedUrl}`;
    }

    /**
     * Cancels a specific request by its identifier.
     * @param {string} requestId - The unique identifier of the request to cancel
     * @returns {boolean} True if the request was found and cancelled, false otherwise
     */
    cancel(requestId) {
        /** @type {import('./index.d.ts').ActiveRequest|undefined} */
        const request = this.getActiveRequest(requestId);
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
                if (typeof request.cancelToken === 'function') request.cancelToken();
                else if (request.cancelToken.cancel) request.cancelToken.cancel();
            } catch (error) {}
        }

        // Reject the wrapper promise
        const error = this.getOptions().verbose ? new Error(`Request ${requestId} was cancelled`) : null;
        this.#_handleRequestFinish(requestId, error != null, () => request.rejectWrapper(error));
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
        const requestIds = Array.from(this.getActiveRequests().keys());
        let cancelledCount = 0;
        requestIds.forEach((requestId) => {
            if (this.cancel(requestId)) cancelledCount++;
        });
        return cancelledCount;
    }

    /**
     * Resolves the AbortController for a request: explicit option, pending handoff, or new.
     * Clears the pending handoff so concurrent requests do not share it.
     * @param {AbortController|undefined} provided - Optional AbortController from options
     * @returns {AbortController}
     * @private
     */
    #_resolveAbortController(provided) {
        const abortController = provided || this.abortController || new AbortController();
        this.abortController = null;
        return abortController;
    }

    /**
     * Picks the best abort callback for a client request object.
     * @param {Object} req - The request object
     * @returns {Function|null}
     * @private
     */
    #_resolveAbortMethod(req) {
        if (!req) return null;
        if (typeof req.abort === 'function') return () => req.abort();
        const ExtAjax =
            typeof globalThis !== 'undefined' && globalThis.Ext && globalThis.Ext.Ajax ? globalThis.Ext.Ajax : null;
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
    #_prepareRequestOptions(options, signal) {
        const requestOptions = {};
        const customOptions = [
            'abortController',
            'cancelToken',
            'requestKey',
            'noCancel',
            'includeQuery',
            'includeMethod',
            'verbose',
        ];
        Object.keys(options).forEach((key) => {
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
    #_checkAxiosVersion(axiosLib) {
        const version = typeof axiosLib?.VERSION === 'string' ? axiosLib.VERSION : null;
        if (!version) return;
        const [major, minor] = version.split('.').map(Number);
        if (major === 0 && minor < 22) {
            console.warn(
                `[request-manager] axios >= 0.22.0 is required: axios ${version} ignores the AbortSignal used for automatic cancellation. Please upgrade axios.`
            );
        }
    }

    /**
     * Handles the completion of a request by deleting it from the active requests map and resolving/rejecting the wrapper promise
     * @param {string} requestId - The unique identifier of the request
     * @param {boolean} condition - The condition to resolve/reject the wrapper promise
     * @param {Function} wrapperPromise - The function to resolve/reject the wrapper promise
     * @private
     */
    #_handleRequestFinish(requestId, condition, wrapperPromise) {
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
    #_request(requestId, requestPromise, options = {}) {
        const abortController = this.#_resolveAbortController(options.abortController);

        // Handle different types of requestPromise inputs
        // Priority: Function (Custom logic) > String (URL) > Promise (axios, fetch, etc.)
        if (typeof requestPromise === 'function') {
            // Function: custom logic for any library (axios, ajax, etc.)
            try {
                requestPromise = requestPromise({
                    options: this.#_prepareRequestOptions(options, abortController.signal),
                });
            } catch (error) {
                return Promise.reject(error);
            }
        } else if (typeof requestPromise === 'string') {
            // String (URL): make fetch internally
            try {
                requestPromise = fetch(requestPromise, this.#_prepareRequestOptions(options, abortController.signal));
            } catch (error) {
                return Promise.reject(error);
            }
        }

        // Link the request object's abort method (Ext.Ajax, XHR, etc.) to the cancellation signal
        this.addAbortListener(this.#_resolveAbortMethod(requestPromise), abortController.signal);

        // Ext.Ajax / raw XHR: wrap so settle matches thenable clients (resolve ok, reject on error)
        if (!requestPromise || typeof requestPromise.then !== 'function') {
            const raw = requestPromise;
            const xhr =
                raw?.xhr ||
                (typeof XMLHttpRequest !== 'undefined' && raw instanceof XMLHttpRequest ? raw : null) ||
                (typeof raw?.addEventListener === 'function' && typeof raw?.abort === 'function' ? raw : null);
            requestPromise = new Promise((resolve, reject) => {
                if (!xhr || typeof xhr.addEventListener !== 'function') {
                    resolve(raw);
                    return;
                }
                let timedOut = false;
                xhr.addEventListener('timeout', () => {
                    timedOut = true;
                });
                xhr.addEventListener('loadend', () => {
                    if (xhr.aborted) return reject({ message: 'Request was cancelled', xhr });
                    if (timedOut) return reject({ message: 'Request timeout', xhr });
                    if (xhr.status < 200 || xhr.status >= 300) {
                        if (xhr.status === 0) return reject({ message: 'Network error', xhr });
                        return reject({
                            message: `Request failed with status ${xhr.status}`,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            xhr,
                        });
                    }
                    resolve(raw);
                });
            });
        }

        // Cancel previous request with the same identifier if it exists
        if (!options.noCancel) this.cancel(requestId);

        // Create a wrapper promise that will be resolved/rejected based on the request
        let resolveWrapper, rejectWrapper;
        const wrapperPromise = new Promise((resolve, reject) => {
            resolveWrapper = resolve;
            rejectWrapper = reject;
        });

        /**
         * @type {import('./index.d.ts').ActiveRequest}
         */
        const request = {
            promise: requestPromise,
            abortController: abortController,
            cancelToken: options.cancelToken || null,
            resolveWrapper: resolveWrapper,
            rejectWrapper: rejectWrapper,
            isCancelled: false,
        };

        this.getActiveRequests().set(requestId, request);

        // Handle request promise completion
        try {
            let req = requestPromise.then((result) => {
                if (this.getActiveRequest(requestId) !== request) return;
                this.#_handleRequestFinish(requestId, !request.isCancelled, () => resolveWrapper(result));
            });
            if (req.catch)
                req.catch((error) => {
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
            scope.#_handleRequestFinish(requestId, error != null, () => rejectWrapper(error));
        }
        return wrapperPromise;
    }
}

export default RequestManager;

export { RequestManager };
