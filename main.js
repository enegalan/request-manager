/**
 * RequestManager - A library for managing and regulating HTTP requests efficiently.
 * @license MIT
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
         * Verbose mode: if true, cancellation errors will include messages
         * @type {boolean}
         */
        this.verbose = managerOptions.verbose || false;
        /**
         * Manager options: the options that were passed to the constructor
         * @type {Object}
         */
        this.managerOptions = managerOptions;
        /**
         * Options for the current request: will be flushed after the request is completed
         * @type {Object}
         */
        this.options = {};
        /**
         * AbortController instance for the current request: will be flushed after the request is completed
         * @type {AbortController}
         */
        this.abortController = null;
    }

    /**
     * Flushes the options for the current request
     * @private
     */
    #_flushRequestOptions() {
        this.options = {};
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
        if (options.verbose !== undefined) {
            this.verbose = options.verbose;
        }
    }

    /**
     * Sets the options for the current request
     * @param {Object} options - The options to set
     * @private
     */
    #_setRequestOptions(options) {
        this.options = options;
    }

    /**
     * Creates an AbortController and returns its signal.
     * The AbortController is stored internally and will be used by the next request() call.
     * This allows users to get the signal before creating the request.
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
     * Gets the current AbortController instance
     * Creates a new AbortController if none exists or if the current one is aborted
     * @returns {AbortController} The current AbortController instance
     */
    getAbortController() {
        // Create a new AbortController if none exists or if the current one is aborted
        if (!this.abortController || this.abortController.signal.aborted) {
            this.abortController = new AbortController();
        }
        return this.abortController;
    }

    /**
     * Clears the current AbortController
     * @private
     */
    #_clearAbortController() {
        this.abortController = null;
    }

    /**
     * Generates a request identifier based on the requestKey or URL
     * @param {string} url - The URL of the request
     * @param {string|number|Function} requestKey - Optional key to generate a deterministic ID.
     *                                              If provided, requests with the same key will share the same ID.
     *                                              If null or undefined, the cleaned URL will be used as the key.
     * @param {boolean} noCancel - If true, generates a unique ID to prevent cancellation
     * @returns {string} A unique request identifier
     * @private
     */
    #_generateRequestId(url, requestKey = null, noCancel = false) {
        if (noCancel) { // Generate a unique ID to prevent cancellation
            return `request_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        }
        if (requestKey !== null && requestKey !== undefined) {
            if (typeof requestKey === 'function') {
                try {
                    requestKey = requestKey();
                } catch (error) {
                    requestKey = null;
                }
            }
            if (requestKey !== null && requestKey !== undefined) return `request_${String(requestKey)}`;
        }
        // Use cleaned URL as key when requestKey is null/undefined
        let cleanedUrl = url || '';
        let hasProtocol = cleanedUrl.includes('://');
        if (hasProtocol) cleanedUrl = cleanedUrl.split('://')[1];
        let hasParams = cleanedUrl.includes('?');
        if (hasParams) cleanedUrl = cleanedUrl.split('?')[0];
        let hasHash = cleanedUrl.includes('#');
        if (hasHash) cleanedUrl = cleanedUrl.split('#')[0];
        return `request_${cleanedUrl}`;
    }

    /**
     * Prepares fetch options by merging options and removing custom properties
     * @param {Object} options - Configuration options
     * @param {AbortSignal} signal - Abort signal to add to fetch options
     * @param {Object} additionalOptions - Additional options to merge
     * @returns {Object} Prepared fetch options
     * @private
     */
    #_prepareFetchOptions(options, signal, additionalOptions = {}) {
        const fetchOptions = Object.assign({}, additionalOptions);
        const customOptions = ['abortController', 'cancelToken', 'requestKey', 'noCancel'];
        Object.keys(options).forEach(key => {
            if (customOptions.includes(key)) return;
            fetchOptions[key] = options[key];
        });
        fetchOptions.signal = signal;
        return fetchOptions;
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
        this.#_setRequestOptions(options);
        if (!options.abortController) this.#_clearAbortController(); // Clear any existing abortController to ensure each request gets a fresh one
        this.#_flushRequestOptions();
        const abortController = options.abortController || this.getAbortController();

        // Handle different types of requestPromise inputs
        // Priority: Function (Custom logic) > String (URL) > Promise (axios, fetch, etc.)
        if (typeof requestPromise === 'function') {
            // Function: custom logic for any library (axios, ajax, etc.)
            const fetchOptions = this.#_prepareFetchOptions(options, abortController.signal);
            requestPromise = requestPromise({ options: fetchOptions });
        } else if (typeof requestPromise === 'string') {
            // String (URL): make fetch internally
            const fetchOptions = this.#_prepareFetchOptions(options, abortController.signal);
            requestPromise = fetch(requestPromise, fetchOptions);
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
            wrapperPromise: wrapperPromise,
            resolveWrapper: resolveWrapper,
            rejectWrapper: rejectWrapper,
            isCancelled: false,
            verbose: this.verbose
        };

        this.activeRequests.set(requestId, requestInfo);

        // Handle request promise completion
        if (requestPromise && typeof requestPromise.then === 'function') {
            try {
                let req = requestPromise.then((result) => {
                    if (this.activeRequests.get(requestId) === requestInfo && !requestInfo.isCancelled) {
                        this.activeRequests.delete(requestId);
                        resolveWrapper(result);
                    }
                });
                if (req.catch) req.catch((error) => {
                    onError(this, error);
                });
            } catch (error) {
                onError(this, error);
            }
            function onError(scope, error) {
                // Check if this requestInfo is still the active one, or if it was cancelled
                const currentRequestInfo = scope.activeRequests.get(requestId);
                if (currentRequestInfo !== requestInfo) return;
                // Only delete if this is still the active request
                scope.activeRequests.delete(requestId);
                if (!requestInfo.isCancelled) rejectWrapper(error);
                else if (requestInfo.isCancelled && requestInfo.verbose) rejectWrapper(new Error('Request was cancelled'));
            }
        } else {
            // If requestPromise is not a promise, we can't track its completion automatically
            // This can happen with libraries like ExtJS that return request objects instead of promises
            // In this case, the user should handle the request object themselves
            // We'll resolve the wrapper promise immediately to prevent it from hanging
            // The user can still use the request object returned by the library
            setTimeout(() => {
                if (this.activeRequests.get(requestId) === requestInfo && !requestInfo.isCancelled) {
                    this.activeRequests.delete(requestId);
                    resolveWrapper(requestPromise); // Resolve with the request object so the user can use it
                }
            }, 0);
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
        const requestOptions = options || {};
        const requestId = this.#_generateRequestId(url, requestOptions.requestKey, requestOptions.noCancel);
        return this.#_request(requestId, requestPromise, requestOptions);
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
        const requestOptions = options || {};
        const requestId = this.#_generateRequestId(url, requestOptions.requestKey, requestOptions.noCancel);
        return this.#_request(requestId, url, requestOptions);
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
        const requestOptions = options || {};
        const axiosLib = axiosInstance || axios;
        const cancelToken = axiosLib.CancelToken.source();
        const requestId = this.#_generateRequestId(url, requestOptions.requestKey, requestOptions.noCancel);
        return this.#_request(requestId, axiosLib.get(url, { cancelToken: cancelToken.token, ...requestOptions }), {
            cancelToken: cancelToken,
            ...requestOptions
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
        const requestOptions = options || {};
        const requestId = this.#_generateRequestId(url, requestOptions.requestKey, requestOptions.noCancel);
        try {
            // AbortController is needed at this point, so we clear here any existing one.
            // This is the same behavior as in the request method.
            this.#_clearAbortController();
            const abortController = options.abortController || this.getAbortController();
            const req = ajaxFunction({ url, ...requestOptions });
            // Determine abort method
            let abortMethod = null;
            if (req) {
                if (typeof req.abort === 'function') {
                    abortMethod = req.abort.bind(req);
                } else if (req.xhr && typeof req.xhr.abort === 'function') {
                    abortMethod = req.xhr.abort.bind(req.xhr);
                }
            }
            if (abortMethod) this.addAbortListener(abortMethod, abortController.signal);
            // Pass the AbortController to avoid creating another one for this request
            return this.#_request(requestId, req, { ...requestOptions, abortController: abortController });
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
        const requestOptions = options || {};
        const requestId = this.#_generateRequestId(url, requestOptions.requestKey, requestOptions.noCancel);
        const xhrFunction = ({ options: fetchOptions }) => {
            // Create XMLHttpRequest
            const xhr = new XMLHttpRequest();
            const method = (requestOptions.method || 'GET').toUpperCase();
            // Create a promise that wraps the XHR request
            const xhrPromise = new Promise((resolve, reject) => {
                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        let response = xhr.response;
                        if (requestOptions.responseType === 'json' ||
                            (xhr.getResponseHeader('Content-Type') && xhr.getResponseHeader('Content-Type').includes('application/json'))) {
                            try {
                                response = JSON.parse(xhr.responseText);
                            } catch (e) {
                                response = xhr.responseText;
                            }
                        }
                        resolve({
                            data: response,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            headers: xhr.getAllResponseHeaders(),
                            xhr: xhr
                        });
                    } else {
                        reject({
                            message: `Request failed with status ${xhr.status}`,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            xhr: xhr
                        });
                    }
                };
                xhr.onerror = function() {
                    reject({
                        message: 'Network error',
                        xhr: xhr
                    });
                };
                xhr.ontimeout = function() {
                    reject({
                        message: 'Request timeout',
                        xhr: xhr
                    });
                };

                // Open the request
                xhr.open(method, url, true);

                // Set response type
                if (requestOptions.responseType) xhr.responseType = requestOptions.responseType;
                // Set withCredentials
                if (requestOptions.withCredentials !== undefined) xhr.withCredentials = requestOptions.withCredentials;
                // Set timeout
                if (requestOptions.timeout !== undefined) xhr.timeout = requestOptions.timeout;
                // Set headers
                if (requestOptions.headers) Object.keys(requestOptions.headers).forEach(key => {
                    xhr.setRequestHeader(key, requestOptions.headers[key]);
                });

                // Connect abort signal to xhr.abort()
                if (fetchOptions.signal) fetchOptions.signal.addEventListener('abort', () => xhr.abort());

                // Send the request
                xhr.send(requestOptions.body || null);
            });
            return xhrPromise;
        };
        return this.#_request(requestId, xhrFunction, requestOptions);
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
        if (requestInfo.rejectWrapper && this.verbose) {
            requestInfo.rejectWrapper(new Error(`Request ${requestId} was cancelled`));
        }
        this.activeRequests.delete(requestId); // Remove from active requests
        return true;
    }

    /**
     * Link abort signal with HTTP client abort method.
     * Useful for custom HTTP clients that only support the abort method to cancel requests.
     * @param {Function} abortMethod - The abort method to call when the signal is aborted
     * @param {AbortSignal} signal - The signal to listen to
     */
    addAbortListener(abortMethod, signal) {
        if (!signal) return;
        signal.addEventListener("abort", () => {
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
