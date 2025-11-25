/**
 * RequestManager - TypeScript Type Definitions
 * A library for managing and regulating HTTP requests efficiently.
 */

/**
 * A function that generates a request key dynamically
 */
export type RequestKeyFunction = () => string | number | null | undefined;

/**
 * Request key type - can be a string, number, or a function that returns a dynamic key
 */
export type RequestKey = string | number | RequestKeyFunction;

/**
 * Cancel token type (axios compatibility) - can be a function or an object with a cancel method
 */
export type CancelToken = (() => void) | { cancel: () => void };

/**
 * Manager options passed to the RequestManager constructor
 */
export interface ManagerOptions {
    /**
     * If true, cancellation errors will include messages globally for all requests
     */
    verbose?: boolean;
}

/**
 * Base request options shared by all request methods
 */
export interface BaseRequestOptions {
    /**
     * Key to identify duplicate requests.
     * If provided, requests with the same key will cancel previous ones.
     * Can be a string, number, or function that returns a key.
     */
    requestKey?: RequestKey;

    /**
     * AbortController instance (created automatically if not provided)
     */
    abortController?: AbortController;

    /**
     * Cancel token (axios compatibility)
     */
    cancelToken?: CancelToken;

    /**
     * If true, this request will not cancel previous requests with the same ID,
     * allowing concurrent requests.
     */
    noCancel?: boolean;
}

/**
 * Options for the request() method
 */
export interface RequestOptions extends BaseRequestOptions, Omit<RequestInit, 'signal'> {}

/**
 * Options for the fetch() method
 */
export interface FetchOptions extends BaseRequestOptions, Omit<RequestInit, 'signal'> {}

/**
 * Options for the axios() method
 */
export interface AxiosRequestOptions extends BaseRequestOptions {
    /**
     * HTTP method
     */
    method?: string;

    /**
     * Request headers
     */
    headers?: Record<string, string>;

    /**
     * URL parameters
     */
    params?: Record<string, any>;

    /**
     * Request body data
     */
    data?: any;

    /**
     * Base URL for the request
     */
    baseURL?: string;

    /**
     * Request timeout in milliseconds
     */
    timeout?: number;

    /**
     * Whether to send credentials with the request
     */
    withCredentials?: boolean;

    /**
     * Response type
     */
    responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';

    /**
     * Additional axios options
     */
    [key: string]: any;
}

/**
 * Options for the xhr() method
 */
export interface XhrOptions extends BaseRequestOptions {
    /**
     * HTTP method (GET, POST, PUT, DELETE, etc.). Defaults to 'GET'.
     */
    method?: string;

    /**
     * Headers object to set on the request
     */
    headers?: Record<string, string>;

    /**
     * Request body
     */
    body?: string | FormData | Blob | ArrayBuffer | null;

    /**
     * Response type ('text', 'json', 'blob', 'arraybuffer', 'document'). Defaults to 'text'.
     */
    responseType?: XMLHttpRequestResponseType;

    /**
     * Whether to send credentials with the request
     */
    withCredentials?: boolean;

    /**
     * Request timeout in milliseconds
     */
    timeout?: number;
}

/**
 * Response from the xhr() method
 */
export interface XhrResponse<T = any> {
    /**
     * The response data (automatically parsed as JSON if Content-Type is application/json)
     */
    data: T;

    /**
     * HTTP status code
     */
    status: number;

    /**
     * HTTP status text
     */
    statusText: string;

    /**
     * Response headers string
     */
    headers: string;

    /**
     * The XMLHttpRequest instance
     */
    xhr: XMLHttpRequest;
}

/**
 * Options passed to the request function callback
 */
export interface RequestFunctionOptions {
    /**
     * The prepared fetch options including the abort signal
     */
    options: RequestInit & { signal: AbortSignal };
}

/**
 * A function that receives options and returns a Promise
 */
export type RequestFunction<T = any> = (params: RequestFunctionOptions) => Promise<T>;

/**
 * Ajax method function type
 */
export type AjaxMethod<T = any> = (params: { url: string; signal?: AbortSignal } & Record<string, any>) => Promise<T> & { abort?: () => void };

/**
 * Axios instance interface (minimal definition for compatibility)
 */
export interface AxiosInstance {
    get<T = any>(url: string, config?: any): Promise<T>;
    post<T = any>(url: string, data?: any, config?: any): Promise<T>;
    put<T = any>(url: string, data?: any, config?: any): Promise<T>;
    delete<T = any>(url: string, config?: any): Promise<T>;
    patch<T = any>(url: string, data?: any, config?: any): Promise<T>;
    request<T = any>(config: any): Promise<T>;
    head<T = any>(url: string, config?: any): Promise<T>;
    options<T = any>(url: string, config?: any): Promise<T>;
    postForm<T = any>(url: string, data?: any, config?: any): Promise<T>;
    putForm<T = any>(url: string, data?: any, config?: any): Promise<T>;
    patchForm<T = any>(url: string, data?: any, config?: any): Promise<T>;
    CancelToken: {
        source(): {
            token: any;
            cancel: (message?: string) => void;
        };
    };
}

/**
 * Axios static interface (for global axios)
 */
export interface AxiosStatic extends AxiosInstance {
    create(config?: any): AxiosInstance;
    isCancel(value: any): boolean;
}

/**
 * RequestManager - A library for managing and regulating HTTP requests efficiently.
 *
 * This library allows you to manage HTTP requests from any library (ajax, Ext.Ajax, axios, fetch, etc.)
 * by accepting Promises as parameters. When a request is repeated with the same identifier,
 * the previous request is automatically cancelled and the new one is executed.
 */
declare class RequestManager {
    /**
     * Map to store active requests by their unique identifier
     */
    activeRequests: Map<string, any>;

    /**
     * Verbose mode: if true, cancellation errors will include messages
     */
    verbose: boolean;

    /**
     * Manager options that were passed to the constructor
     */
    managerOptions: ManagerOptions;

    /**
     * Options for the current request (flushed after each request)
     */
    options: Record<string, any>;

    /**
     * AbortController instance for the current request
     */
    abortController: AbortController | null;

    /**
     * Creates a new RequestManager instance
     * @param managerOptions - Configuration options for the manager
     */
    constructor(managerOptions?: ManagerOptions);

    /**
     * Sets the manager options
     * @param options - The manager options to set
     */
    setOptions(options: ManagerOptions): void;

    /**
     * Gets the manager options
     * @returns The manager options
     */
    getOptions(): ManagerOptions;

    /**
     * Creates an AbortController and returns its signal.
     * The AbortController is stored internally and will be used by the next request() call.
     * @returns The signal from a new AbortController
     * 
     * @example
     * const signal = requestManager.getSignal();
     * requestManager.request('/api/users', fetch('/api/users', { signal }));
     */
    getSignal(): AbortSignal;

    /**
     * Gets the current AbortController instance.
     * Creates a new AbortController if none exists or if the current one is aborted.
     * @returns The current AbortController instance
     */
    getAbortController(): AbortController;

    /**
     * Executes an HTTP request, cancelling any previous request with the same identifier.
     * 
     * @param url - The URL to request
     * @param requestPromise - The request promise, function that returns a promise, or URL string
     * @param options - Optional configuration
     * @returns A Promise that resolves/rejects based on the most recent request
     * 
     * @example
     * // Request with Promise
     * requestManager.request('/api/users', axios.get('/api/users'));
     * 
     * @example
     * // Request with Function
     * requestManager.request('/api/users', ({ options }) => fetch('/api/users', options));
     * 
     * @example
     * // Request with noCancel for concurrent requests
     * requestManager.request('/api/lazy', fetch('/api/lazy'), { noCancel: true });
     */
    request<T = Response>(
        url: string,
        requestPromise: Promise<T> | RequestFunction<T> | string,
        options?: RequestOptions
    ): Promise<T>;

    /**
     * Executes an HTTP request using fetch, cancelling any previous request with the same identifier.
     * 
     * @param url - The URL to fetch
     * @param options - Optional configuration (fetch options + RequestManager options)
     * @returns A Promise that resolves/rejects based on the most recent request
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
     */
    fetch(url: string, options?: FetchOptions): Promise<Response>;

    /**
     * Executes an HTTP request using axios, cancelling any previous request with the same identifier.
     * 
     * @param url - The URL to request
     * @param options - Optional configuration (axios options + RequestManager options)
     * @param axiosInstance - Optional axios instance to use. If not provided, uses global axios.
     * @returns A Promise that resolves/rejects based on the most recent request
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
     *   data: { name: 'John' }
     * });
     */
    axios<T = any>(
        url: string,
        options?: AxiosRequestOptions,
        axiosInstance?: AxiosInstance | AxiosStatic | null
    ): Promise<T>;

    /**
     * Executes an HTTP request using a custom ajax method, cancelling any previous request with the same identifier.
     * 
     * @param ajaxMethod - A function that receives { url, ...options } and returns a Promise
     * @param url - The URL to request
     * @param options - Optional configuration
     * @returns A Promise that resolves/rejects based on the most recent request
     * 
     * @example
     * // Using with jQuery.ajax
     * requestManager.ajax(
     *   ({ url, ...options }) => $.ajax({ url, ...options }),
     *   '/api/users',
     *   { method: 'GET' }
     * );
     */
    ajax<T = any>(
        ajaxMethod: AjaxMethod<T>,
        url: string,
        options?: BaseRequestOptions & Record<string, any>
    ): Promise<T>;

    /**
     * Executes an HTTP request using XMLHttpRequest, cancelling any previous request with the same identifier.
     * 
     * @param url - The URL to request
     * @param options - Optional configuration
     * @returns A Promise that resolves/rejects based on the most recent request
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
     */
    xhr<T = any>(url: string, options?: XhrOptions): Promise<XhrResponse<T>>;

    /**
     * Cancels a specific request by its identifier.
     * 
     * @param requestId - The unique identifier of the request to cancel
     * @returns True if the request was found and cancelled, false otherwise
     */
    cancel(requestId: string): boolean;

    /**
     * Link abort signal with HTTP client abort method.
     * Useful for custom HTTP clients that only support the abort method to cancel requests.
     * 
     * @param abortMethod - The abort method to call when the signal is aborted
     * @param signal - The signal to listen to
     */
    addAbortListener(abortMethod: (() => void) | undefined, signal: AbortSignal | undefined): void;

    /**
     * Cancels all active requests.
     * 
     * @returns The number of requests that were cancelled
     */
    cancelAll(): number;

    /**
     * Checks if a request with the given identifier is currently active.
     * 
     * @param requestId - The unique identifier to check
     * @returns True if the request is active, false otherwise
     */
    isActive(requestId: string): boolean;

    /**
     * Gets the number of active requests.
     * 
     * @returns The number of currently active requests
     */
    getActiveCount(): number;

    /**
     * Clears all active requests without cancelling them.
     * Use with caution - this will not cancel the underlying HTTP requests.
     */
    clear(): void;
}

export default RequestManager;
export { RequestManager };
