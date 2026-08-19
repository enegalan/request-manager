/**
 * RequestManager - A library for managing and regulating HTTP requests efficiently.
 * @license MIT
 * @author Eneko Galan <enekogalanelorza@gmail.com>
 * This library allows you to manage HTTP requests from any library (ajax, Ext.Ajax, axios, fetch, etc.)
 * by accepting Promises as parameters. When a request is repeated with the same identifier,
 * the previous request is automatically cancelled and the new one is executed, giving priority to the most recent requests.

 * @param {Object} managerOptions - The options for the manager
 * @param {boolean} managerOptions.verbose - If true, cancellation errors will include messages
 * @returns {RequestManager} A new RequestManager instance
*/
class RequestManager {
    constructor(managerOptions = {}) {
        /**
         * Map to store active requests by their unique identifier.
         * Each entry contains:
         * - promise: The original promise
         * - abortController: AbortController instance (if available)
         * - cancelToken: Cancel token (for axios compatibility)
         * - wrapperPromise: The promise that wraps the request
         * - resolveWrapper: The function to resolve the wrapper promise
         * - rejectWrapper: The function to reject the wrapper promise
         * - isCancelled: Whether the request has been cancelled
         * - verbose: Whether to include verbose messages in the cancellation error
         */
        this.activeRequests = new Map();
        /**
         * Manager options: the options that were passed to the constructor
         * @type {Object}
         */
        this.managerOptions = managerOptions;
        /**
         * One-shot AbortController for getSignal()/getAbortController() handoff.
         * Consumed by the next request that does not pass options.abortController.
         * @type {AbortController|null}
         */
        this.abortController = null;
    }

    /**
     * Gets the manager options
     * @returns {Object} Manager options
     */
    getOptions() {
        return this.managerOptions;
    }

    /**
     * Sets the manager options
     * @param {Object} options - The options to set
     */
    setOptions(options) {
        this.managerOptions = options;
    }

    /**
     * Creates a new AbortController and returns its signal for the next request()
     * (one getSignal → one request). Do not use for parallel requests; use fetch(),
     * axios(), or request(url, ({ options }) => ...) instead — they create their own signal.
     *
     * @returns {AbortSignal} The signal from a new AbortController
     *
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
     * Prepares fetch options by merging options and removing custom properties
     * @param {Object} options - Configuration options
     * @param {AbortSignal} signal - Abort signal to add to fetch options
     * @returns {Object} Prepared fetch options
     * @private
     */
    #_prepareFetchOptions(options, signal) {
        const fetchOptions = {};
        const customOptions = ['abortController', 'cancelToken', 'requestKey', 'noCancel', 'includeQuery'];
        Object.keys(options).forEach((key) => {
            if (customOptions.includes(key)) return;
            fetchOptions[key] = options[key];
        });
        fetchOptions.signal = signal;
        return fetchOptions;
    }

    /**
     * Deletes a request from the active requests map and rejects the wrapper promise
     * @param {string} requestId - The unique identifier of the request
     * @param {Function} rejectWrapper - The function to reject the wrapper promise
     * @param {*} error - The error to reject the wrapper promise with; the wrapper is not rejected if null/undefined
     * @private
     */
    #_deleteRequest(requestId, rejectWrapper, error) {
        this.activeRequests.delete(requestId);
        if (error !== null && error !== undefined) {
            rejectWrapper(error);
        }
    }

    /**
     * Completes a request by deleting it from the active requests map and resolving the wrapper promise
     * @param {string} requestId - The unique identifier of the request
     * @param {Function} resolveWrapper - The function to resolve the wrapper promise
     * @param {Promise} requestPromise - The request promise
     * @param {boolean} isCancelled - Whether the request was cancelled
     * @private
     */
    #_completeRequest(requestId, resolveWrapper, requestPromise, isCancelled) {
        this.activeRequests.delete(requestId);
        if (!isCancelled) {
            resolveWrapper(requestPromise);
        }
    }

    /**
     * Internal method that handles the core request logic.
     *
     * @param {string} requestId - Unique identifier for the request
     * @param {Promise|Function|string} requestPromise - The request promise, function, or URL string
     * @param {Object} options - Configuration options
     * @param {AbortController} options.abortController - AbortController instance
     * @param {Function} options.cancelToken - Cancel token or cancel function
     * @param {boolean} options.noCancel - If true, this request will not cancel previous requests with the same ID
     * @returns {Promise} A Promise that resolves/rejects based on the most recent request
     * @private
     */
    #_request(requestId, requestPromise, options = {}) {
        const abortController = this.#_resolveAbortController(options.abortController);

        // Handle different types of requestPromise inputs
        // Priority: Function (Custom logic) > String (URL) > Promise (axios, fetch, etc.)
        if (typeof requestPromise === 'function') {
            // Function: custom logic for any library (axios, ajax, etc.)
            requestPromise = requestPromise({ options: this.#_prepareFetchOptions(options, abortController.signal) });
        } else if (typeof requestPromise === 'string') {
            // String (URL): make fetch internally
            requestPromise = fetch(requestPromise, this.#_prepareFetchOptions(options, abortController.signal));
        }

        // Cancel previous request with the same ID if it exists
        if (!options.noCancel) this.cancel(requestId);

        // Create a wrapper promise that will be resolved/rejected based on the request
        let resolveWrapper, rejectWrapper;
        const wrapperPromise = new Promise((resolve, reject) => {
            resolveWrapper = resolve;
            rejectWrapper = reject;
        });

        // Store the request information
        const requestInfo = {
            promise: requestPromise,
            abortController: abortController,
            cancelToken: options.cancelToken || null,
            resolveWrapper: resolveWrapper,
            rejectWrapper: rejectWrapper,
            isCancelled: false,
        };

        this.activeRequests.set(requestId, requestInfo);

        // Handle request promise completion
        if (requestPromise && typeof requestPromise.then === 'function') {
            try {
                let req = requestPromise.then((result) => {
                    if (this.activeRequests.get(requestId) === requestInfo) {
                        this.#_completeRequest(requestId, resolveWrapper, result, requestInfo.isCancelled);
                    }
                });
                if (req.catch)
                    req.catch((error) => {
                        onError(this, error);
                    });
            } catch (error) {
                onError(this, error);
            }
            function onError(scope, error) {
                // Check if this requestInfo is still the active one, or if it was cancelled
                const currentRequestInfo = scope.activeRequests.get(requestId);
                if (currentRequestInfo !== requestInfo) return;
                if (requestInfo.isCancelled) {
                    // Already cancelled: let cancel() handle cleanup and reject the wrapper promise
                    scope.cancel(requestId);
                    return;
                }
                // Only delete if this is still the active request
                scope.#_deleteRequest(requestId, rejectWrapper, error);
            }
        } else {
            // Non-promise (Ext.Ajax request object, raw XHR, etc.). Keep tracked until the
            // underlying XHR finishes so a later duplicate can still cancel it.
            const xhr =
                requestPromise &&
                (requestPromise.xhr ||
                    (typeof XMLHttpRequest !== 'undefined' && requestPromise instanceof XMLHttpRequest
                        ? requestPromise
                        : null));
            const finish = () => {
                if (this.activeRequests.get(requestId) !== requestInfo) return;
                this.#_completeRequest(requestId, resolveWrapper, requestPromise, requestInfo.isCancelled);
            };
            if (xhr && typeof xhr.addEventListener === 'function') {
                xhr.addEventListener('loadend', finish);
            } else {
                setTimeout(finish, 0);
            }
        }
        return wrapperPromise;
    }

    /**
     * Executes an HTTP request, cancelling any previous request with the same identifier.
     *
     * @param {string} url - The URL to request
     * @param {Promise|Function} requestPromise - The request promise or function that returns a promise
     * @param {Object} options - Optional configuration
     * @param {string|number|Function} options.requestKey - Key to identify duplicate requests.
     *                                                    If provided, requests with the same key will cancel previous ones.
     *                                                    Can be a string, number, or function that returns a key.
     * @param {AbortController} options.abortController - AbortController instance (created automatically if not provided)
     * @param {Function} options.cancelToken - Cancel token or cancel function for other libraries
     * @param {boolean} options.noCancel - If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
     *                                                    Any other properties are passed as fetch options (method, headers, body, etc.)
     * @returns {Promise} A Promise that resolves/rejects based on the most recent request
     *
     * @example
     * // Request with Promise
     * requestManager.request('/api/users', axios.get('/api/users', { cancelToken: axios.CancelToken.source().token }));
     *
     * @example
     * // Request with Function
     * requestManager.request('/api/users', ({ options }) => fetch('/api/users', { signal: options.signal, ...options }));
     *
     * @example
     * // Request with Promise and custom cancellation grouping with requestKey
     * const options = {
     *   requestKey: 'get-users',
     *   cancelToken: axios.CancelToken.source().cancel
     * }
     * requestManager.request('/api/users', axios.get('/api/users', options), options);
     *
     * @example
     * // Request with noCancel to allow concurrent requests (e.g., lazy loading)
     * requestManager.request('/api/lazy?load=1', fetch('/api/lazy?load=1'), { noCancel: true });
     * requestManager.request('/api/lazy?load=2', fetch('/api/lazy?load=2'), { noCancel: true });
     * // Both requests will execute concurrently without canceling each other
     */
    request(url, requestPromise, options = {}) {
        return this.#_request(this.getRequestId(url, options), requestPromise, options);
    }

    /**
     * Executes an HTTP request using fetch, cancelling any previous request with the same identifier.
     *
     * @param {string} url - The URL to fetch
     * @param {Object} options - Optional configuration
     * @param {string|number|Function} options.requestKey - Key to identify duplicate requests.
     *                                                    If provided, requests with the same key will cancel previous ones.
     *                                                    Can be a string, number, or function that returns a key.
     * @param {AbortController} options.abortController - AbortController instance (created automatically if not provided)
     * @param {Function} options.cancelToken - Cancel token or cancel function for other libraries
     * @param {boolean} options.noCancel - If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
     *                                                    Any other properties are passed as fetch options (method, headers, body, etc.)
     * @returns {Promise} A Promise that resolves/rejects based on the most recent request
     *
     * @example
     * // Simple GET request
     * requestManager.fetch('/api/users');
     *
     * @example
     * // POST request with options
     * requestManager.fetch('/api/users', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify({ name: 'John' })
     * });
     *
     * @example
     * // Request with requestKey for custom cancellation grouping with requestKey
     * requestManager.fetch('/api/users', {
     *   requestKey: 'get-users'
     * });
     *
     * @example
     * // Request with noCancel to allow concurrent requests (e.g., lazy loading)
     * requestManager.fetch('/api/lazy?load=1', { noCancel: true });
     * requestManager.fetch('/api/lazy?load=2', { noCancel: true });
     * // Both requests will execute concurrently without canceling each other
     */
    fetch(url, options = {}) {
        return this.#_request(this.getRequestId(url, options), url, options);
    }

    /**
     * Executes an HTTP request using axios, cancelling any previous request with the same identifier.
     *
     * @param {string} url - The URL to request
     * @param {Object} options - Optional configuration
     * @param {string|number|Function} options.requestKey - Key to identify duplicate requests.
     *                                                    If provided, requests with the same key will cancel previous ones.
     *                                                    Can be a string, number, or function that returns a key.
     * @param {boolean} options.noCancel - If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
     *                                                    Any other properties are passed as axios options (method, headers, params, data, etc.)
     * @param {Object} axiosInstance - Optional axios instance to use. If not provided, uses global axios.
     * @returns {Promise} A Promise that resolves/rejects based on the most recent request
     *
     * @example
     * // Simple GET request (uses global axios)
     * requestManager.axios('/api/users');
     *
     * @example
     * // With custom axios instance
     * const myAxios = axios.create({ baseURL: 'https://api.example.com' });
     * requestManager.axios('/users', {}, myAxios);
     *
     * @example
     * // POST request with options
     * requestManager.axios('/api/users', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify({ name: 'John' })
     * });
     *
     * @example
     * // Request with requestKey for custom cancellation grouping with requestKey
     * requestManager.axios('/api/users', {
     *   requestKey: 'get-users'
     * });
     *
     * @example
     * // Request with noCancel to allow concurrent requests
     * requestManager.axios('/api/lazy?load=1', { noCancel: true });
     * requestManager.axios('/api/lazy?load=2', { noCancel: true });
     */
    axios(url, options = {}, axiosInstance = null) {
        const axiosLib = axiosInstance || axios;
        const cancelToken = axiosLib.CancelToken.source();
        const requestId = this.getRequestId(url, options);
        return this.#_request(requestId, axiosLib({ url, cancelToken: cancelToken.token, ...options }), {
            cancelToken: cancelToken,
            ...options,
        });
    }

    /**
     * Executes an HTTP request using jQuery.ajax, cancelling any previous request with the same identifier.
     *
     * @param {Function} ajaxFunction - A function that receives { url, ...options } and returns a Promise
     * @param {string} url - The URL to request
     * @param {Object} options - Optional configuration
     * @param {string|number|Function} options.requestKey - Key to identify duplicate requests.
     *                                                    If provided, requests with the same key will cancel previous ones.
     *                                                    Can be a string, number, or function that returns a key.
     * @param {boolean} options.noCancel - If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
     *                                                    Any other properties are passed to the ajax method function
     * @returns {Promise} A Promise that resolves/rejects based on the most recent request
     *
     * @example
     * // Simple GET request
     * requestManager.ajax(ajaxFunction, '/api/users');
     *
     * @example
     * // POST request with options
     * requestManager.ajax(ajaxFunction, '/api/users', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify({ name: 'John' })
     * });
     *
     * @example
     * // Request with requestKey for custom cancellation grouping with requestKey
     * requestManager.ajax(ajaxFunction, '/api/users', {
     *   requestKey: 'get-users'
     * });
     */
    ajax(ajaxFunction, url, options = {}) {
        if (typeof ajaxFunction !== 'function') throw new Error('ajaxFunction parameter must be a function');
        try {
            const abortController = this.#_resolveAbortController(options.abortController);
            const req = ajaxFunction({ url, ...options });
            this.addAbortListener(this.#_resolveAbortMethod(req), abortController.signal);
            // Pass the AbortController to avoid creating another one for this request
            return this.#_request(this.getRequestId(url, options), req, { ...options, abortController: abortController });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     * Executes an HTTP request using XMLHttpRequest, cancelling any previous request with the same identifier.
     *
     * @param {string} url - The URL to request
     * @param {Object} options - Optional configuration
     * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE, etc.). Defaults to 'GET'.
     * @param {Object} options.headers - Headers object to set on the request
     * @param {string|FormData|Blob|ArrayBuffer} options.body - Request body
     * @param {string} options.responseType - Response type ('text', 'json', 'blob', 'arraybuffer', 'document'). Defaults to 'text'.
     * @param {boolean} options.withCredentials - Whether to send credentials with the request
     * @param {number} options.timeout - Request timeout in milliseconds
     * @param {string|number|Function} options.requestKey - Key to identify duplicate requests.
     *                                                    If provided, requests with the same key will cancel previous ones.
     *                                                    Can be a string, number, or function that returns a key.
     * @param {boolean} options.noCancel - If true, this request will not cancel previous requests with the same ID, allowing concurrent requests
     * @returns {Promise} A Promise that resolves/rejects based on the most recent request
     *
     * @example
     * // Simple GET request
     * requestManager.xhr('/api/users');
     *
     * @example
     * // POST request with options
     * requestManager.xhr('/api/users', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify({ name: 'John' })
     * });
     *
     * @example
     * // Request with requestKey for custom cancellation grouping
     * requestManager.xhr('/api/users', {
     *   requestKey: 'get-users'
     * });
     *
     * @example
     * // Request with noCancel to allow concurrent requests
     * requestManager.xhr('/api/lazy?load=1', { noCancel: true });
     * requestManager.xhr('/api/lazy?load=2', { noCancel: true });
     */
    xhr(url, options = {}) {
        const requestId = this.getRequestId(url, options);
        const xhrFunction = ({ options: fetchOptions }) => {
            // Create XMLHttpRequest
            const xhr = new XMLHttpRequest();
            const method = (options.method || 'GET').toUpperCase();
            // Create a promise that wraps the XHR request
            const xhrPromise = new Promise((resolve, reject) => {
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        let response = xhr.response;
                        if (
                            options.responseType === 'json' ||
                            (xhr.getResponseHeader('Content-Type') &&
                                xhr.getResponseHeader('Content-Type').includes('application/json'))
                        ) {
                            try {
                                response = JSON.parse(xhr.responseText);
                            } catch {
                                response = xhr.responseText;
                            }
                        }
                        resolve({
                            data: response,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            headers: xhr.getAllResponseHeaders(),
                            xhr: xhr,
                        });
                    } else {
                        reject({
                            message: `Request failed with status ${xhr.status}`,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            xhr: xhr,
                        });
                    }
                };
                xhr.onerror = function () {
                    reject({
                        message: 'Network error',
                        xhr: xhr,
                    });
                };
                xhr.ontimeout = function () {
                    reject({
                        message: 'Request timeout',
                        xhr: xhr,
                    });
                };

                // Open the request
                xhr.open(method, url, true);

                // Set response type
                if (options.responseType) xhr.responseType = options.responseType;
                // Set withCredentials
                if (options.withCredentials !== undefined) xhr.withCredentials = options.withCredentials;
                // Set timeout
                if (options.timeout !== undefined) xhr.timeout = options.timeout;
                // Set headers
                if (options.headers)
                    Object.keys(options.headers).forEach((key) => {
                        xhr.setRequestHeader(key, options.headers[key]);
                    });

                // Connect abort signal to xhr.abort()
                if (fetchOptions.signal) fetchOptions.signal.addEventListener('abort', () => xhr.abort());

                // Send the request
                xhr.send(options.body || null);
            });
            return xhrPromise;
        };
        return this.#_request(requestId, xhrFunction, options);
    }

    /**
     * Returns the request ID that RequestManager would assign for a URL and options.
     *
     * @param {string} url - The URL used when starting the request
     * @param {Object} options - Same options used for the request
     * @param {string|number|Function} options.requestKey - Optional key override
     * @param {boolean} options.includeQuery - Keep query string in the URL-based ID
     * @param {boolean} options.noCancel - If true, returns a new unique ID
     * @returns {string} The request identifier
     *
     * @example
     * requestManager.fetch('/api/users');
     * const id = requestManager.getRequestId('/api/users');
     * requestManager.cancel(id);
     */
    getRequestId(url, options = {}) {
        let requestKey = options.requestKey;

        const prefix = 'request_';

        // Generate a unique ID to prevent cancellation for non cancelable requests
        if (options.noCancel) {
            return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        }

        // Handle function requestKey
        if (typeof requestKey === 'function') {
            try {
                requestKey = requestKey();
            } catch {
                requestKey = null;
            }
        }
        if (requestKey !== null && requestKey !== undefined) return `${prefix}${String(requestKey)}`;

        // Use cleaned URL as key as fallback
        let cleanedUrl = url || '';
        if (cleanedUrl.includes('://')) cleanedUrl = cleanedUrl.split('://')[1];
        if (cleanedUrl.includes('#')) cleanedUrl = cleanedUrl.split('#')[0];
        if (!options.includeQuery && cleanedUrl.includes('?')) cleanedUrl = cleanedUrl.split('?')[0];
        return `${prefix}${cleanedUrl}`;
    }

    /**
     * Cancels a specific request by its identifier.
     *
     * @param {string} requestId - The unique identifier of the request to cancel
     * @returns {boolean} True if the request was found and cancelled, false otherwise
     */
    cancel(requestId) {
        const requestInfo = this.activeRequests.get(requestId);
        if (!requestInfo) return false;

        requestInfo.isCancelled = true; // Mark as cancelled

        // Try to abort using AbortController (for fetch)
        if (requestInfo.abortController && !requestInfo.abortController.signal.aborted) {
            try {
                requestInfo.abortController.abort('Request was cancelled');
            } catch (error) {}
        }

        // Try to cancel using cancel token/function (for axios and others)
        if (requestInfo.cancelToken) {
            try {
                if (typeof requestInfo.cancelToken === 'function') requestInfo.cancelToken();
                else if (requestInfo.cancelToken.cancel) requestInfo.cancelToken.cancel();
            } catch (error) {}
        }

        // Reject the wrapper promise
        this.#_deleteRequest(requestId, requestInfo.rejectWrapper, this.getOptions().verbose ? new Error(`Request ${requestId} was cancelled`) : null);
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
     *
     * @returns {number} The number of requests that were cancelled
     */
    cancelAll() {
        const requestIds = Array.from(this.activeRequests.keys());
        let cancelledCount = 0;
        requestIds.forEach((requestId) => {
            if (this.cancel(requestId)) cancelledCount++;
        });
        return cancelledCount;
    }

    /**
     * Checks if a request with the given identifier is currently active.
     *
     * @param {string} requestId - The unique identifier to check
     * @returns {boolean} True if the request is active, false otherwise
     */
    isActive(requestId) {
        return this.activeRequests.has(requestId);
    }

    /**
     * Gets the number of active requests.
     *
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
}

export default RequestManager;

export { RequestManager };
