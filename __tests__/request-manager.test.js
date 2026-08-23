import RequestManager from '../main.js';

// Helper function to generate request ID (replicates private #_generateRequestId logic)
function generateRequestId(url, requestKey = null, includeQuery = false) {
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
    if (cleanedUrl.includes('://')) cleanedUrl = cleanedUrl.split('://')[1];
    if (cleanedUrl.includes('#')) cleanedUrl = cleanedUrl.split('#')[0];
    if (!includeQuery && cleanedUrl.includes('?')) cleanedUrl = cleanedUrl.split('?')[0];
    return `request_${cleanedUrl}`;
}

describe('RequestManager', () => {
    let requestManager;

    beforeEach(() => {
        requestManager = new RequestManager();
    });

    describe('Constructor', () => {
        test('should create a new RequestManager instance', () => {
            expect(requestManager).toBeInstanceOf(RequestManager);
            expect(requestManager.activeRequests).toBeInstanceOf(Map);
            expect(requestManager.getActiveCount()).toBe(0);
        });
    });

    describe('request() - with requestId', () => {
        test('should execute a request with explicit requestId', async () => {
            const mockPromise = Promise.resolve('success');
            const result = await requestManager.request('test-id', mockPromise);

            expect(result).toBe('success');
            expect(requestManager.getActiveCount()).toBe(0);
        });

        test('should cancel previous request with same requestId', async () => {
            let firstResolved = false;
            let secondResolved = false;

            const controller1 = new AbortController();
            const promise1 = new Promise((resolve) => {
                setTimeout(() => {
                    firstResolved = true;
                    resolve('first');
                }, 100);
            });

            requestManager
                .request('same-id', promise1, {
                    abortController: controller1,
                })
                .catch(() => {
                    // First request should be cancelled
                });

            // Wait a bit before making second request
            await new Promise((resolve) => setTimeout(resolve, 10));

            const controller2 = new AbortController();
            const promise2 = Promise.resolve('second');

            const result = await requestManager.request('same-id', promise2, {
                abortController: controller2,
            });

            expect(result).toBe('second');
            expect(firstResolved).toBe(false);
            expect(secondResolved).toBe(false);
            expect(controller1.signal.aborted).toBe(true);
        });

        test('should handle request errors', async () => {
            const errorPromise = Promise.reject(new Error('Request failed'));

            await expect(requestManager.request('error-id', errorPromise)).rejects.toThrow('Request failed');
        });
    });

    describe('request() - without requestId (auto-generated)', () => {
        test('should generate unique ID when requestId is not provided', async () => {
            const promise1 = Promise.resolve('first');
            const promise2 = Promise.resolve('second');

            const result1 = await requestManager.request('/api/test1', promise1);
            const result2 = await requestManager.request('/api/test2', promise2);

            expect(result1).toBe('first');
            expect(result2).toBe('second');
            expect(requestManager.getActiveCount()).toBe(0);
        });

        test('should not cancel requests without requestId and without requestKey', async () => {
            const promise1 = new Promise((resolve) => {
                setTimeout(() => resolve('first'), 50);
            });
            const promise2 = Promise.resolve('second');

            const result1Promise = requestManager.request('/api/test1', promise1);
            const result2 = await requestManager.request('/api/test2', promise2);

            expect(result2).toBe('second');
            expect(requestManager.getActiveCount()).toBe(1);

            const result1 = await result1Promise;
            expect(result1).toBe('first');
        });
    });

    describe('request() - with requestKey', () => {
        test('should use requestKey to generate deterministic ID', async () => {
            let firstCancelled = false;

            const controller1 = new AbortController();
            const promise1 = new Promise((resolve) => {
                setTimeout(() => resolve('first'), 100);
            });

            requestManager
                .request('/api/test', promise1, {
                    abortController: controller1,
                    requestKey: 'test-key',
                })
                .catch(() => {
                    firstCancelled = true;
                });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const controller2 = new AbortController();
            const promise2 = Promise.resolve('second');

            const result = await requestManager.request('/api/test', promise2, {
                abortController: controller2,
                requestKey: 'test-key',
            });

            expect(result).toBe('second');
            expect(controller1.signal.aborted).toBe(true);
        });

        test('should handle requestKey as function', async () => {
            let firstCancelled = false;

            const controller1 = new AbortController();
            const promise1 = new Promise((resolve) => {
                setTimeout(() => resolve('first'), 100);
            });

            requestManager
                .request('/api/test', promise1, {
                    abortController: controller1,
                    requestKey: () => 'dynamic-key',
                })
                .catch(() => {
                    firstCancelled = true;
                });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const controller2 = new AbortController();
            const promise2 = Promise.resolve('second');

            const result = await requestManager.request('/api/test', promise2, {
                abortController: controller2,
                requestKey: () => 'dynamic-key',
            });

            expect(result).toBe('second');
            expect(controller1.signal.aborted).toBe(true);
        });

        test('should handle requestKey function that throws', async () => {
            const promise = Promise.resolve('success');

            const result = await requestManager.request('/api/test', promise, {
                requestKey: () => {
                    throw new Error('Key generation failed');
                },
            });

            expect(result).toBe('success');
        });

        test('should handle requestKey as number', async () => {
            let firstCancelled = false;

            const controller1 = new AbortController();
            const promise1 = new Promise((resolve) => {
                setTimeout(() => resolve('first'), 100);
            });

            requestManager
                .request('/api/test', promise1, {
                    abortController: controller1,
                    requestKey: 12345,
                })
                .catch(() => {
                    firstCancelled = true;
                });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const controller2 = new AbortController();
            const promise2 = Promise.resolve('second');

            const result = await requestManager.request('/api/test', promise2, {
                abortController: controller2,
                requestKey: 12345,
            });

            expect(result).toBe('second');
            expect(controller1.signal.aborted).toBe(true);
        });
    });

    describe('cancel()', () => {
        test('should cancel a specific request by ID', () => {
            const controller = new AbortController();
            const promise = new Promise(() => {}); // Never resolves

            const requestPromise = requestManager.request('/api/cancel-test', promise, {
                abortController: controller,
            });
            requestPromise.catch(() => {}); // Handle cancellation error

            const requestId = generateRequestId('/api/cancel-test');
            expect(requestManager.isActive(requestId)).toBe(true);
            expect(requestManager.cancel(requestId)).toBe(true);
            expect(requestManager.isActive(requestId)).toBe(false);
            expect(controller.signal.aborted).toBe(true);
        });

        test('should return false when cancelling non-existent request', () => {
            expect(requestManager.cancel('non-existent')).toBe(false);
        });

        test('should cancel request with cancelToken function', () => {
            let cancelled = false;
            const cancelFn = () => {
                cancelled = true;
            };

            const promise = new Promise(() => {});

            const requestPromise = requestManager.request('/api/cancel-token-test', promise, {
                cancelToken: cancelFn,
            });
            requestPromise.catch(() => {}); // Handle cancellation error

            const requestId = generateRequestId('/api/cancel-token-test');
            expect(requestManager.cancel(requestId)).toBe(true);
            expect(cancelled).toBe(true);
        });

        test('should cancel request with cancelToken object', () => {
            let cancelled = false;
            const cancelToken = {
                cancel: () => {
                    cancelled = true;
                },
            };

            const promise = new Promise(() => {});

            const requestPromise = requestManager.request('/api/cancel-object-test', promise, {
                cancelToken: cancelToken,
            });
            requestPromise.catch(() => {}); // Handle cancellation error

            const requestId = generateRequestId('/api/cancel-object-test');
            expect(requestManager.cancel(requestId)).toBe(true);
            expect(cancelled).toBe(true);
        });

        test('should not reject wrapper promise when verbose is false (default)', async () => {
            const controller = new AbortController();
            const promise = new Promise(() => {}); // Never resolves

            const requestPromise = requestManager.request('verbose-test', promise, {
                abortController: controller,
            });

            let settled = false;
            requestPromise
                .then(() => {
                    settled = true;
                })
                .catch(() => {
                    settled = true;
                });

            const requestId = generateRequestId('verbose-test');
            requestManager.cancel(requestId);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(settled).toBe(false);
        });

        test('should reject wrapper promise with request id when verbose is true globally', async () => {
            const verboseManager = new RequestManager({ verbose: true });
            const controller = new AbortController();
            const promise = new Promise(() => {}); // Never resolves

            const requestPromise = verboseManager.request('/api/verbose-global-test', promise, {
                abortController: controller,
            });

            let errorMessage = null;
            requestPromise.catch((error) => {
                errorMessage = error.message;
            });

            const requestId = generateRequestId('/api/verbose-global-test');
            verboseManager.cancel(requestId);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(errorMessage).toBe(`Request ${requestId} was cancelled`);
        });

        test('should reject wrapper promise with request id when verbose is enabled via setOptions', async () => {
            const controller = new AbortController();
            const promise = new Promise(() => {}); // Never resolves

            requestManager.setOptions({ verbose: true });

            const requestPromise = requestManager.request('/api/verbose-setmanageroptions-test', promise, {
                abortController: controller,
            });

            let errorMessage = null;
            requestPromise.catch((error) => {
                errorMessage = error.message;
            });

            const requestId = generateRequestId('/api/verbose-setmanageroptions-test');
            requestManager.cancel(requestId);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(errorMessage).toBe(`Request ${requestId} was cancelled`);

            requestManager.setOptions({ verbose: false });
        });

        test('should allow changing verbose mode at runtime via setOptions', async () => {
            const verboseManager = new RequestManager({ verbose: true });
            const controller = new AbortController();
            const promise = new Promise(() => {}); // Never resolves

            verboseManager.setOptions({ verbose: false });

            const requestPromise = verboseManager.request('/api/verbose-runtime-test', promise, {
                abortController: controller,
            });

            let settled = false;
            requestPromise
                .then(() => {
                    settled = true;
                })
                .catch(() => {
                    settled = true;
                });

            const requestId = generateRequestId('/api/verbose-runtime-test');
            verboseManager.cancel(requestId);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(settled).toBe(false);
        });

        test('setOptions should update options', () => {
            const manager = new RequestManager();
            expect(manager.getOptions()).toEqual({});

            manager.setOptions({ verbose: true });
            expect(manager.getOptions()).toEqual({ verbose: true });
        });
    });

    describe('cancelAll()', () => {
        test('should cancel all active requests', () => {
            const controller1 = new AbortController();
            const controller2 = new AbortController();
            const controller3 = new AbortController();

            const promise1 = new Promise(() => {});
            const promise2 = new Promise(() => {});
            const promise3 = new Promise(() => {});

            const req1 = requestManager.request('req1', promise1, { abortController: controller1 });
            const req2 = requestManager.request('req2', promise2, { abortController: controller2 });
            const req3 = requestManager.request('req3', promise3, { abortController: controller3 });

            // Handle cancellation errors
            req1.catch(() => {});
            req2.catch(() => {});
            req3.catch(() => {});

            expect(requestManager.getActiveCount()).toBe(3);

            const cancelledCount = requestManager.cancelAll();

            expect(cancelledCount).toBe(3);
            expect(requestManager.getActiveCount()).toBe(0);
            expect(controller1.signal.aborted).toBe(true);
            expect(controller2.signal.aborted).toBe(true);
            expect(controller3.signal.aborted).toBe(true);
        });

        test('should return 0 when no active requests', () => {
            expect(requestManager.cancelAll()).toBe(0);
        });
    });

    describe('getRequestId()', () => {
        test('should return the same id used for URL-based requests', () => {
            const promise = new Promise(() => {});
            requestManager.request('/api/users', promise).catch(() => {});

            const id = requestManager.getRequestId('/api/users');
            expect(id).toBe(generateRequestId('/api/users'));
            expect(requestManager.isActive(id)).toBe(true);
            expect(requestManager.cancel(id)).toBe(true);
            expect(requestManager.isActive(id)).toBe(false);
        });

        test('should respect requestKey and includeQuery', () => {
            expect(requestManager.getRequestId('/api/a?q=1', { requestKey: 'k' })).toBe('request_k');
            expect(requestManager.getRequestId('/api/a?q=1', { includeQuery: true })).toBe(
                generateRequestId('/api/a?q=1', null, true)
            );
        });

        test('raw URL is not a valid cancel id without getRequestId', () => {
            requestManager.request('/api/users', new Promise(() => {})).catch(() => {});
            expect(requestManager.cancel('/api/users')).toBe(false);
            expect(requestManager.cancel(requestManager.getRequestId('/api/users'))).toBe(true);
        });
    });

    describe('isActive()', () => {
        test('should return true for active request', () => {
            const promise = new Promise(() => {});
            requestManager.request('/api/active-test', promise);

            const requestId = generateRequestId('/api/active-test');
            expect(requestManager.isActive(requestId)).toBe(true);
        });

        test('should return false for non-existent request', () => {
            expect(requestManager.isActive('non-existent')).toBe(false);
        });

        test('should return false after request completes', async () => {
            const promise = Promise.resolve('done');
            await requestManager.request('complete-test', promise);

            expect(requestManager.isActive('complete-test')).toBe(false);
        });
    });

    describe('getActiveCount()', () => {
        test('should return 0 initially', () => {
            expect(requestManager.getActiveCount()).toBe(0);
        });

        test('should return correct count of active requests', () => {
            const promise1 = new Promise(() => {});
            const promise2 = new Promise(() => {});
            const promise3 = new Promise(() => {});

            const req1 = requestManager.request('req1', promise1);
            req1.catch(() => {}); // Handle potential errors
            expect(requestManager.getActiveCount()).toBe(1);

            const req2 = requestManager.request('req2', promise2);
            req2.catch(() => {}); // Handle potential errors
            expect(requestManager.getActiveCount()).toBe(2);

            const req3 = requestManager.request('req3', promise3);
            req3.catch(() => {}); // Handle potential errors
            expect(requestManager.getActiveCount()).toBe(3);
        });

        test('should decrease count when requests complete', async () => {
            const promise1 = new Promise(() => {});
            const promise2 = Promise.resolve('done');

            requestManager.request('req1', promise1);
            const request2Promise = requestManager.request('req2', promise2);

            expect(requestManager.getActiveCount()).toBe(2);

            // Wait for the promise to resolve
            await request2Promise;
            // Wait a bit more for cleanup
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(requestManager.getActiveCount()).toBe(1);
        });
    });

    describe('clear()', () => {
        test('should clear all active requests without cancelling', () => {
            const controller = new AbortController();
            const promise = new Promise(() => {});

            requestManager.request('clear-test', promise, {
                abortController: controller,
            });

            expect(requestManager.getActiveCount()).toBe(1);
            requestManager.clear();
            expect(requestManager.getActiveCount()).toBe(0);
            expect(controller.signal.aborted).toBe(false);
        });
    });

    describe('getAbortController()', () => {
        test('should create a new AbortController', () => {
            const abortController = requestManager.getAbortController();

            expect(abortController).toBeInstanceOf(AbortController);
            expect(abortController.signal).toBeInstanceOf(AbortSignal);
            expect(abortController.signal.aborted).toBe(false);
        });

        test('should return a new AbortController on each call', () => {
            const abortController1 = requestManager.getAbortController();
            const abortController2 = requestManager.getAbortController();

            expect(abortController1).not.toBe(abortController2);
        });

        test('should work with request() method', async () => {
            const abortController = requestManager.getAbortController();
            const promise = Promise.resolve('success');

            const result = await requestManager.request('test-url', promise, {
                abortController: abortController,
            });

            expect(result).toBe('success');
        });

        test('should hand off pending controller to the next request without options.abortController', async () => {
            const abortController = requestManager.getAbortController();
            let cancelled = false;
            abortController.signal.addEventListener('abort', () => {
                cancelled = true;
            });

            const hanging = new Promise(() => {});
            const request1 = requestManager.request('/api/pending', hanging);
            request1.catch(() => {});

            await requestManager.request('/api/pending', Promise.resolve('second'));

            expect(cancelled).toBe(true);
        });
    });

    describe('getSignal()', () => {
        test('should return an AbortSignal from getAbortController', () => {
            const signal = requestManager.getSignal();

            expect(signal).toBeInstanceOf(AbortSignal);
            expect(signal.aborted).toBe(false);
        });

        test('should return a new signal on each call', () => {
            const signal1 = requestManager.getSignal();
            const signal2 = requestManager.getSignal();

            expect(signal1).not.toBe(signal2);
        });

        test('should work with fetch() method', async () => {
            const signal = requestManager.getSignal();

            // Mock fetch for testing
            let fetchCalled = false;
            let fetchSignal = null;
            global.fetch = (url, options) => {
                fetchCalled = true;
                fetchSignal = options.signal;
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: 'test' }),
                });
            };

            const result = await requestManager.request('/api/test', fetch('/api/test', { signal }));

            expect(fetchCalled).toBe(true);
            expect(fetchSignal).toBe(signal);
            expect(result.ok).toBe(true);

            // Cleanup
            delete global.fetch;
        });

        test('should allow manual abort of the signal', () => {
            const abortController = requestManager.getAbortController();
            const signal = abortController.signal;

            expect(signal.aborted).toBe(false);
            abortController.abort();
            expect(signal.aborted).toBe(true);
        });
    });

    describe('per-request AbortController isolation', () => {
        test('concurrent requests should not share AbortControllers', async () => {
            const controllers = [];
            global.fetch = () => new Promise(() => {});

            requestManager
                .request('/api/a', ({ options }) => {
                    controllers.push(options.signal);
                    return new Promise(() => {});
                })
                .catch(() => {});

            requestManager
                .request('/api/b', ({ options }) => {
                    controllers.push(options.signal);
                    return new Promise(() => {});
                })
                .catch(() => {});

            expect(controllers.length).toBe(2);
            expect(controllers[0]).not.toBe(controllers[1]);

            requestManager.cancelAll();
        });
    });

    describe('fetch() method', () => {
        let originalFetch;

        beforeEach(() => {
            originalFetch = global.fetch;
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        test('should execute a fetch request', async () => {
            let fetchCalled = false;
            let fetchUrl = null;
            let fetchOptions = null;

            global.fetch = (url, options) => {
                fetchCalled = true;
                fetchUrl = url;
                fetchOptions = options;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: 'success' }),
                });
            };

            const result = await requestManager.fetch('/api/users');

            expect(fetchCalled).toBe(true);
            expect(fetchUrl).toBe('/api/users');
            expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
            expect(result.ok).toBe(true);
        });

        test('should pass fetch options correctly', async () => {
            let fetchOptions = null;

            global.fetch = (url, options) => {
                fetchOptions = options;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: 'success' }),
                });
            };

            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'John' }),
            };

            await requestManager.fetch('/api/users', options);

            expect(fetchOptions.method).toBe('POST');
            expect(fetchOptions.headers).toEqual({ 'Content-Type': 'application/json' });
            expect(fetchOptions.body).toBe(JSON.stringify({ name: 'John' }));
            expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
        });

        test('should cancel previous request with same URL', async () => {
            const controller1 = new AbortController();
            const promise1 = new Promise(() => {}); // Never resolves

            global.fetch = () => promise1;

            const request1 = requestManager.fetch('/api/users', {
                abortController: controller1,
            });
            request1.catch(() => {}); // Handle cancellation

            await new Promise((resolve) => setTimeout(resolve, 10));

            global.fetch = () =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: 'second' }),
                });

            const result = await requestManager.fetch('/api/users');

            expect(controller1.signal.aborted).toBe(true);
            expect(result.ok).toBe(true);
        });

        test('should use requestKey for cancellation grouping', async () => {
            const controller1 = new AbortController();
            const promise1 = new Promise(() => {}); // Never resolves

            global.fetch = () => promise1;

            const request1 = requestManager.fetch('/api/users?page=1', {
                abortController: controller1,
                requestKey: 'get-users',
            });
            request1.catch(() => {}); // Handle cancellation

            await new Promise((resolve) => setTimeout(resolve, 10));

            global.fetch = () =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: 'second' }),
                });

            const result = await requestManager.fetch('/api/users?page=2', {
                requestKey: 'get-users',
            });

            expect(controller1.signal.aborted).toBe(true);
            expect(result.ok).toBe(true);
        });
    });

    describe('request() with Function', () => {
        test('should call function with options object containing signal', async () => {
            let receivedOptions = null;
            let callCount = 0;
            const mockFunction = ({ options }) => {
                callCount++;
                receivedOptions = options;
                return Promise.resolve('success');
            };

            const result = await requestManager.request('/api/test', mockFunction);

            expect(callCount).toBe(1);
            expect(receivedOptions).toBeDefined();
            expect(receivedOptions.signal).toBeInstanceOf(AbortSignal);
            expect(result).toBe('success');
        });

        test('should pass fetch options to function', async () => {
            let receivedOptions = null;
            const mockFunction = ({ options }) => {
                receivedOptions = options;
                return Promise.resolve('success');
            };

            await requestManager.request('/api/test', mockFunction, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            expect(receivedOptions.method).toBe('POST');
            expect(receivedOptions.headers).toEqual({ 'Content-Type': 'application/json' });
            expect(receivedOptions.signal).toBeInstanceOf(AbortSignal);
        });

        test('should cancel previous request when function is used', async () => {
            const controller1 = new AbortController();
            let cancelled = false;

            const function1 = ({ options }) => {
                return new Promise((resolve, reject) => {
                    options.signal.addEventListener('abort', () => {
                        cancelled = true;
                        reject(new Error('Cancelled'));
                    });
                    setTimeout(() => resolve('first'), 100);
                });
            };

            const request1 = requestManager.request('/api/test', function1, {
                abortController: controller1,
            });
            request1.catch(() => {}); // Handle cancellation

            await new Promise((resolve) => setTimeout(resolve, 10));

            const function2 = ({ options }) => Promise.resolve('second');
            const result = await requestManager.request('/api/test', function2);

            expect(cancelled).toBe(true);
            expect(controller1.signal.aborted).toBe(true);
            expect(result).toBe('second');
        });

        test('should work with custom HTTP library using function', async () => {
            const mockXHR = {
                open: () => {},
                send: () => {},
                onload: null,
                onerror: null,
                responseText: 'success',
            };

            const customFunction = ({ options }) => {
                return new Promise((resolve, reject) => {
                    mockXHR.open('GET', '/api/data');
                    // Simulate immediate success
                    setTimeout(() => {
                        if (options.signal.aborted) {
                            reject(new Error('Request was cancelled'));
                        } else {
                            resolve(mockXHR.responseText);
                        }
                    }, 10);

                    options.signal.addEventListener('abort', () => {
                        reject(new Error('Request was cancelled'));
                    });
                });
            };

            const result = await requestManager.request('/api/data', customFunction);

            expect(result).toBe('success');
        });
    });

    describe('request() with String URL', () => {
        let originalFetch;

        beforeEach(() => {
            originalFetch = global.fetch;
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        test('should automatically use fetch when URL string is provided', async () => {
            let fetchCalled = false;
            let fetchUrl = null;
            let fetchOptions = null;

            global.fetch = (url, options) => {
                fetchCalled = true;
                fetchUrl = url;
                fetchOptions = options;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: 'success' }),
                });
            };

            const result = await requestManager.request('/api/users', '/api/users');

            expect(fetchCalled).toBe(true);
            expect(fetchUrl).toBe('/api/users');
            expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
            expect(result.ok).toBe(true);
        });

        test('should pass options to fetch when URL string is provided', async () => {
            let fetchOptions = null;

            global.fetch = (url, options) => {
                fetchOptions = options;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: 'success' }),
                });
            };

            await requestManager.request('/api/users', '/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            expect(fetchOptions.method).toBe('POST');
            expect(fetchOptions.headers).toEqual({ 'Content-Type': 'application/json' });
            expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
        });
    });

    describe('Integration tests', () => {
        test('should handle multiple concurrent requests with different IDs', async () => {
            const promise1 = Promise.resolve('result1');
            const promise2 = Promise.resolve('result2');
            const promise3 = Promise.resolve('result3');

            const results = await Promise.all([
                requestManager.request('id1', promise1),
                requestManager.request('id2', promise2),
                requestManager.request('id3', promise3),
            ]);

            expect(results).toEqual(['result1', 'result2', 'result3']);
            expect(requestManager.getActiveCount()).toBe(0);
        });

        test('should prioritize most recent request when same ID is used', async () => {
            const results = [];
            const errors = [];

            const controller1 = new AbortController();
            const promise1 = new Promise((resolve) => {
                setTimeout(() => resolve('first'), 100);
            });

            requestManager
                .request('same-id', promise1, {
                    abortController: controller1,
                })
                .then((result) => results.push(result))
                .catch((error) => errors.push(error));

            await new Promise((resolve) => setTimeout(resolve, 10));

            const controller2 = new AbortController();
            const promise2 = new Promise((resolve) => {
                setTimeout(() => resolve('second'), 50);
            });

            requestManager
                .request('same-id', promise2, {
                    abortController: controller2,
                })
                .then((result) => results.push(result))
                .catch((error) => errors.push(error));

            await new Promise((resolve) => setTimeout(resolve, 150));

            expect(results).toContain('second');
            expect(results).not.toContain('first');
            expect(controller1.signal.aborted).toBe(true);
        });

        test('should work with fetch-like AbortController', async () => {
            const controller = new AbortController();
            const promise = Promise.resolve({ status: 200, data: 'success' });

            const result = await requestManager.request('fetch-test', promise, {
                abortController: controller,
            });

            expect(result).toEqual({ status: 200, data: 'success' });
        });
    });

    describe('axios() method', () => {
        let originalAxios;
        let axiosCalled;
        let axiosArgs;
        let axiosImpl;

        beforeEach(() => {
            originalAxios = global.axios;
            axiosCalled = false;
            axiosArgs = null;
            axiosImpl = (config) => {
                axiosCalled = true;
                axiosArgs = config;
                return Promise.resolve({ data: 'success', status: 200 });
            };
            const axiosMock = (config) => axiosImpl(config);
            global.axios = Object.assign(axiosMock, {
                isCancel: (error) => error && error.__CANCEL__ === true,
            });
        });

        afterEach(() => {
            global.axios = originalAxios;
        });

        test('should execute an axios GET request', async () => {
            const result = await requestManager.axios('/api/users');

            expect(axiosCalled).toBe(true);
            expect(axiosArgs.url).toBe('/api/users');
            expect(axiosArgs.signal).toBeInstanceOf(AbortSignal);
            expect(result.data).toBe('success');
            expect(result.status).toBe(200);
        });

        test('should pass axios options correctly', async () => {
            const options = {
                headers: { 'Content-Type': 'application/json' },
                params: { page: 1 },
            };

            await requestManager.axios('/api/users', options);

            expect(axiosCalled).toBe(true);
            expect(axiosArgs.url).toBe('/api/users');
            expect(axiosArgs.signal).toBeInstanceOf(AbortSignal);
            expect(axiosArgs.headers).toEqual({ 'Content-Type': 'application/json' });
            expect(axiosArgs.params).toEqual({ page: 1 });
        });

        test('should respect method and data for non-GET requests', async () => {
            await requestManager.axios('/api/users', {
                method: 'POST',
                data: { name: 'John' },
            });

            expect(axiosCalled).toBe(true);
            expect(axiosArgs.url).toBe('/api/users');
            expect(axiosArgs.method).toBe('POST');
            expect(axiosArgs.data).toEqual({ name: 'John' });
            expect(axiosArgs.signal).toBeInstanceOf(AbortSignal);
        });

        test('should abort the previous request signal when a duplicate starts', async () => {
            const capturedSignals = [];
            axiosImpl = (config) => {
                capturedSignals.push(config.signal);
                return new Promise(() => {}); // Never resolves
            };

            const request1 = requestManager.axios('/api/users');
            request1.catch(() => {}); // Handle cancellation

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(capturedSignals[0]).toBeInstanceOf(AbortSignal);
            expect(capturedSignals[0].aborted).toBe(false);

            axiosImpl = () => Promise.resolve({ data: 'second', status: 200 });

            const result = await requestManager.axios('/api/users');

            expect(capturedSignals[0].aborted).toBe(true);
            expect(result.data).toBe('second');
        });

        test('should not leak requests map entries after completion', async () => {
            await requestManager.axios('/api/users');

            expect(requestManager.getActiveCount()).toBe(0);
        });

        test('should cancel previous request with same URL', async () => {
            axiosImpl = () => new Promise(() => {}); // Never resolves

            const request1 = requestManager.axios('/api/users');
            request1.catch(() => {}); // Handle cancellation

            await new Promise((resolve) => setTimeout(resolve, 10));

            axiosImpl = () => Promise.resolve({ data: 'second', status: 200 });

            const result = await requestManager.axios('/api/users');

            expect(result.data).toBe('second');
        });

        test('should use requestKey for cancellation grouping', async () => {
            axiosImpl = () => new Promise(() => {}); // Never resolves

            const request1 = requestManager.axios('/api/users?page=1', {
                requestKey: 'get-users',
            });
            request1.catch(() => {}); // Handle cancellation

            await new Promise((resolve) => setTimeout(resolve, 10));

            axiosImpl = () => Promise.resolve({ data: 'second', status: 200 });

            const result = await requestManager.axios('/api/users?page=2', {
                requestKey: 'get-users',
            });

            expect(result.data).toBe('second');
        });

        test('should use custom axios instance when provided as third parameter', async () => {
            let customAxiosCalled = false;
            let customAxiosArgs = null;

            const customAxiosImpl = (config) => {
                customAxiosCalled = true;
                customAxiosArgs = config;
                return Promise.resolve({ data: 'custom-success', status: 200 });
            };
            const customAxiosInstance = Object.assign(customAxiosImpl, {});

            const result = await requestManager.axios('/api/users', {}, customAxiosInstance);

            expect(customAxiosCalled).toBe(true);
            expect(axiosCalled).toBe(false); // Global axios should not be called
            expect(customAxiosArgs.url).toBe('/api/users');
            expect(customAxiosArgs.signal).toBeInstanceOf(AbortSignal);
            expect(result.data).toBe('custom-success');
        });

        test('should use global axios when axiosInstance is null', async () => {
            const result = await requestManager.axios('/api/users', {}, null);

            expect(axiosCalled).toBe(true);
            expect(result.data).toBe('success');
        });

        test('should use global axios when axiosInstance is not provided', async () => {
            const result = await requestManager.axios('/api/users');

            expect(axiosCalled).toBe(true);
            expect(result.data).toBe('success');
        });
    });

    describe('ajax() method', () => {
        test('should throw error if ajaxFunction is not a function', () => {
            expect(() => {
                requestManager.ajax('not-a-function', '/api/users');
            }).toThrow('ajaxFunction parameter must be a function');
        });

        test('should reject when ajaxFunction throws synchronously', async () => {
            const ajaxFunction = () => {
                throw new Error('sync failure');
            };

            await expect(requestManager.ajax(ajaxFunction, '/api/users')).rejects.toThrow('sync failure');
        });

        test('should execute an ajax request with function', async () => {
            let ajaxCalled = false;
            let ajaxUrl = null;

            const ajaxFunction = ({ url, ...options }) => {
                ajaxCalled = true;
                ajaxUrl = url;
                const promise = Promise.resolve({ data: 'success' });
                promise.abort = () => {}; // Mock abort method
                return promise;
            };

            const result = await requestManager.ajax(ajaxFunction, '/api/users');

            expect(ajaxCalled).toBe(true);
            expect(ajaxUrl).toBe('/api/users');
            expect(result.data).toBe('success');
        });

        test('should pass options to ajax method', async () => {
            let ajaxOptions = null;

            const ajaxFunction = ({ url, ...options }) => {
                ajaxOptions = options;
                const promise = Promise.resolve({ data: 'success' });
                promise.abort = () => {}; // Mock abort method
                return promise;
            };

            await requestManager.ajax(ajaxFunction, '/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                requestKey: 'get-users',
            });

            expect(ajaxOptions.method).toBe('POST');
            expect(ajaxOptions.headers).toEqual({ 'Content-Type': 'application/json' });
            expect(ajaxOptions.signal).toBeInstanceOf(AbortSignal);
            expect(ajaxOptions.requestKey).toBeUndefined();
        });

        test('should cancel previous request with same URL', async () => {
            const controller1 = new AbortController();
            let firstResolved = false;

            const ajaxFunction1 = ({ url, ...options }) => {
                const promise = new Promise((resolve) => {
                    setTimeout(() => {
                        firstResolved = true;
                        resolve('first');
                    }, 100);
                });
                promise.abort = () => {};
                return promise;
            };

            const request1 = requestManager.ajax(ajaxFunction1, '/api/users', {
                abortController: controller1,
            });
            request1.catch(() => {}); // Handle cancellation

            // Wait for the request to be registered
            await new Promise((resolve) => setTimeout(resolve, 10));

            const ajaxFunction2 = ({ url, ...options }) => {
                const promise = Promise.resolve('second');
                promise.abort = () => {};
                return promise;
            };
            const result = await requestManager.ajax(ajaxFunction2, '/api/users');

            // Wait a bit to see if first request was cancelled
            await new Promise((resolve) => setTimeout(resolve, 150));

            // The first request should be cancelled (signal aborted)
            expect(controller1.signal.aborted).toBe(true);
            // The second request should complete
            expect(result).toBe('second');
        });

        test('should use requestKey for cancellation grouping', async () => {
            const controller1 = new AbortController();
            let firstResolved = false;

            const ajaxFunction1 = ({ url, ...options }) => {
                const promise = new Promise((resolve) => {
                    setTimeout(() => {
                        firstResolved = true;
                        resolve('first');
                    }, 100);
                });
                promise.abort = () => {};
                return promise;
            };

            const request1 = requestManager.ajax(ajaxFunction1, '/api/users?page=1', {
                abortController: controller1,
                requestKey: 'get-users',
            });
            request1.catch(() => {}); // Handle cancellation

            // Wait for the request to be registered
            await new Promise((resolve) => setTimeout(resolve, 10));

            const ajaxFunction2 = ({ url, ...options }) => {
                const promise = Promise.resolve('second');
                promise.abort = () => {};
                return promise;
            };
            const result = await requestManager.ajax(ajaxFunction2, '/api/users?page=2', {
                requestKey: 'get-users',
            });

            // Wait a bit to see if first request was cancelled
            await new Promise((resolve) => setTimeout(resolve, 150));

            // The first request should be cancelled (signal aborted)
            expect(controller1.signal.aborted).toBe(true);
            // The second request should complete
            expect(result).toBe('second');
        });
    });

    describe('xhr() method', () => {
        test('should execute an XHR GET request', async () => {
            let openCalled = false;
            let sendCalled = false;
            let openArgs = null;
            let sendArgs = null;

            const xhrMock = {
                open: (method, url, async) => {
                    openCalled = true;
                    openArgs = { method, url, async };
                },
                send: (body) => {
                    sendCalled = true;
                    sendArgs = body;
                },
                setRequestHeader: () => {},
                getAllResponseHeaders: () => 'Content-Type: application/json',
                getResponseHeader: () => 'application/json',
                responseText: '{"data":"success"}',
                response: '{"data":"success"}',
                status: 200,
                statusText: 'OK',
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const resultPromise = requestManager.xhr('/api/users');

            // Simulate successful response
            setTimeout(() => {
                xhrMock.onload();
            }, 10);

            const result = await resultPromise;

            expect(openCalled).toBe(true);
            expect(openArgs.method).toBe('GET');
            expect(openArgs.url).toBe('/api/users');
            expect(openArgs.async).toBe(true);
            expect(sendCalled).toBe(true);
            expect(sendArgs).toBe(null);
            expect(result.data).toEqual({ data: 'success' });
            expect(result.status).toBe(200);
            expect(result.statusText).toBe('OK');
        });

        test('should execute an XHR POST request with options', async () => {
            let openCalled = false;
            let sendCalled = false;
            let setRequestHeaderCalled = false;
            let setRequestHeaderArgs = [];
            let openArgs = null;
            let sendArgs = null;

            const xhrMock = {
                open: (method, url, async) => {
                    openCalled = true;
                    openArgs = { method, url, async };
                },
                send: (body) => {
                    sendCalled = true;
                    sendArgs = body;
                },
                setRequestHeader: (header, value) => {
                    setRequestHeaderCalled = true;
                    setRequestHeaderArgs.push({ header, value });
                },
                getAllResponseHeaders: () => 'Content-Type: application/json',
                getResponseHeader: () => 'application/json',
                responseText: '{"data":"created"}',
                response: '{"data":"created"}',
                status: 201,
                statusText: 'Created',
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'John' }),
            };

            const resultPromise = requestManager.xhr('/api/users', options);

            setTimeout(() => {
                xhrMock.onload();
            }, 10);

            const result = await resultPromise;

            expect(openCalled).toBe(true);
            expect(openArgs.method).toBe('POST');
            expect(openArgs.url).toBe('/api/users');
            expect(setRequestHeaderCalled).toBe(true);
            expect(setRequestHeaderArgs).toContainEqual({ header: 'Content-Type', value: 'application/json' });
            expect(sendCalled).toBe(true);
            expect(sendArgs).toBe(JSON.stringify({ name: 'John' }));
            expect(result.data).toEqual({ data: 'created' });
            expect(result.status).toBe(201);
        });

        test('should handle XHR errors', async () => {
            const xhrMock = {
                open: () => {},
                send: () => {},
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => null,
                status: 500,
                statusText: 'Internal Server Error',
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const resultPromise = requestManager.xhr('/api/users');

            setTimeout(() => {
                xhrMock.onload();
            }, 10);

            await expect(resultPromise).rejects.toEqual({
                message: 'Request failed with status 500',
                status: 500,
                statusText: 'Internal Server Error',
                xhr: xhrMock,
            });
        });

        test('should handle XHR network errors', async () => {
            const xhrMock = {
                open: () => {},
                send: () => {},
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => null,
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const resultPromise = requestManager.xhr('/api/users');

            setTimeout(() => {
                xhrMock.onerror();
            }, 10);

            await expect(resultPromise).rejects.toEqual({
                message: 'Network error',
                xhr: xhrMock,
            });
        });

        test('should handle XHR timeout', async () => {
            const xhrMock = {
                open: () => {},
                send: () => {},
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => null,
                timeout: 0,
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const resultPromise = requestManager.xhr('/api/users', {
                timeout: 1000,
            });

            setTimeout(() => {
                xhrMock.ontimeout();
            }, 10);

            await expect(resultPromise).rejects.toEqual({
                message: 'Request timeout',
                xhr: xhrMock,
            });
        });

        test('should cancel XHR request when aborted', async () => {
            let abortCalled = false;

            const xhrMock = {
                open: () => {},
                send: () => {},
                abort: () => {
                    abortCalled = true;
                },
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => null,
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const controller = new AbortController();
            const resultPromise = requestManager.xhr('/api/users', {
                abortController: controller,
            });

            // Wait for XHR to be set up
            await new Promise((resolve) => setTimeout(resolve, 10));

            controller.abort();

            // Wait a bit for abort to be processed
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(abortCalled).toBe(true);
        });

        test('should use requestKey for cancellation grouping', async () => {
            let abortCalled = false;

            const xhrMock1 = {
                open: () => {},
                send: () => {},
                abort: () => {
                    abortCalled = true;
                },
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => 'application/json',
                responseText: '{"data":"first"}',
                response: '{"data":"first"}',
                status: 200,
                statusText: 'OK',
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            const xhrMock2 = {
                open: () => {},
                send: () => {},
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => 'application/json',
                responseText: '{"data":"second"}',
                response: '{"data":"second"}',
                status: 200,
                statusText: 'OK',
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            let xhrCallCount = 0;
            global.XMLHttpRequest = function () {
                xhrCallCount++;
                return xhrCallCount === 1 ? xhrMock1 : xhrMock2;
            };

            const controller1 = new AbortController();
            const request1 = requestManager.xhr('/api/users?page=1', {
                abortController: controller1,
                requestKey: 'get-users',
            });
            request1.catch(() => {}); // Handle cancellation

            await new Promise((resolve) => setTimeout(resolve, 10));

            const resultPromise = requestManager.xhr('/api/users?page=2', {
                requestKey: 'get-users',
            });

            setTimeout(() => {
                xhrMock2.onload();
            }, 10);

            const result = await resultPromise;

            expect(abortCalled).toBe(true);
            expect(controller1.signal.aborted).toBe(true);
            expect(result.data).toEqual({ data: 'second' });
        });

        test('should handle responseType option', async () => {
            let responseTypeSet = '';

            const xhrMock = {
                open: () => {},
                send: () => {},
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => null,
                get responseType() {
                    return responseTypeSet;
                },
                set responseType(value) {
                    responseTypeSet = value;
                },
                response: 'binary-data',
                status: 200,
                statusText: 'OK',
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const resultPromise = requestManager.xhr('/api/users', {
                responseType: 'arraybuffer',
            });

            setTimeout(() => {
                xhrMock.onload();
            }, 10);

            const result = await resultPromise;

            expect(responseTypeSet).toBe('arraybuffer');
            expect(result.data).toBe('binary-data');
        });

        test('should resolve with parsed response when responseType is json without touching responseText', async () => {
            const xhrMock = {
                open: () => {},
                send: () => {},
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => 'application/json',
                get responseText() {
                    // Browsers throw InvalidStateError when reading responseText
                    // while responseType is not '' or 'text'
                    throw new Error('InvalidStateError');
                },
                response: { data: 'parsed-by-browser' },
                status: 200,
                statusText: 'OK',
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const resultPromise = requestManager.xhr('/api/users', {
                responseType: 'json',
            });

            setTimeout(() => {
                xhrMock.onload();
            }, 10);

            const result = await resultPromise;

            expect(result.data).toEqual({ data: 'parsed-by-browser' });
        });

        test('should fall back to raw text when JSON parsing fails', async () => {
            const xhrMock = {
                open: () => {},
                send: () => {},
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => 'application/json',
                responseText: '{invalid-json}',
                response: '{invalid-json}',
                status: 200,
                statusText: 'OK',
                onload: null,
                onerror: null,
                ontimeout: null,
            };

            global.XMLHttpRequest = function () {
                return xhrMock;
            };

            const resultPromise = requestManager.xhr('/api/users');

            setTimeout(() => {
                xhrMock.onload();
            }, 10);

            const result = await resultPromise;

            expect(result.data).toBe('{invalid-json}');
        });
    });

    describe('getOptions() method', () => {
        test('should return empty object initially', () => {
            expect(requestManager.getOptions()).toEqual({});
        });

        test('should return manager options set via constructor', () => {
            const verboseManager = new RequestManager({ verbose: true });
            expect(verboseManager.getOptions()).toEqual({ verbose: true });
        });

        test('should return manager options set via setOptions', () => {
            const manager = new RequestManager();
            manager.setOptions({ verbose: true });
            expect(manager.getOptions()).toEqual({ verbose: true });
        });
    });

    describe('addAbortListener() method', () => {
        test('should call abort method when signal is aborted', () => {
            let abortCalled = false;
            const abortMethod = () => {
                abortCalled = true;
            };
            const controller = new AbortController();
            const signal = controller.signal;

            requestManager.addAbortListener(abortMethod, signal);

            expect(abortCalled).toBe(false);

            controller.abort();

            // Wait a bit for the event to fire
            return new Promise((resolve) => {
                setTimeout(() => {
                    expect(abortCalled).toBe(true);
                    resolve();
                }, 10);
            });
        });

        test('should not throw error if abort method throws', () => {
            let abortCalled = false;
            const abortMethod = () => {
                abortCalled = true;
                throw new Error('Abort failed');
            };
            const controller = new AbortController();
            const signal = controller.signal;

            expect(() => {
                requestManager.addAbortListener(abortMethod, signal);
            }).not.toThrow();

            controller.abort();

            // Wait a bit for the event to fire
            return new Promise((resolve) => {
                setTimeout(() => {
                    expect(abortCalled).toBe(true);
                    resolve();
                }, 10);
            });
        });

        test('should not do anything if signal is not provided', () => {
            let abortCalled = false;
            const abortMethod = () => {
                abortCalled = true;
            };

            expect(() => {
                requestManager.addAbortListener(abortMethod, null);
            }).not.toThrow();

            expect(abortCalled).toBe(false);
        });

        test('should not do anything if abort method is not a function', () => {
            const controller = new AbortController();
            const signal = controller.signal;

            expect(() => {
                requestManager.addAbortListener('not-a-function', signal);
            }).not.toThrow();

            controller.abort();

            // Wait a bit to ensure nothing breaks
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 10);
            });
        });
    });

    describe('includeQuery option', () => {
        let originalFetch;

        beforeEach(() => {
            originalFetch = global.fetch;
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        test('should keep different query strings as different request IDs', async () => {
            global.fetch = (url) => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            json: async () => ({ url }),
                        });
                    }, 30);
                });
            };

            const result1 = requestManager.fetch('/api/users?page=1', { includeQuery: true });
            const result2 = requestManager.fetch('/api/users?page=2', { includeQuery: true });

            expect(requestManager.getActiveCount()).toBe(2);

            const [data1, data2] = await Promise.all([result1.then((r) => r.json()), result2.then((r) => r.json())]);

            expect(data1.url).toBe('/api/users?page=1');
            expect(data2.url).toBe('/api/users?page=2');
        });

        test('should still cancel when the full URL including query is the same', async () => {
            global.fetch = () => new Promise(() => {});

            const request1 = requestManager.fetch('/api/users?page=1', { includeQuery: true });
            request1.catch(() => {});

            await new Promise((resolve) => setTimeout(resolve, 10));

            global.fetch = () =>
                Promise.resolve({
                    ok: true,
                    json: async () => ({ page: 1, second: true }),
                });

            const result = await requestManager.fetch('/api/users?page=1', { includeQuery: true });
            const data = await result.json();

            expect(data.second).toBe(true);
            expect(requestManager.isActive(generateRequestId('/api/users?page=1', null, true))).toBe(false);
        });

        test('should strip query by default so different pages cancel each other', async () => {
            global.fetch = () => new Promise(() => {});

            const request1 = requestManager.fetch('/api/users?page=1');
            request1.catch(() => {});

            await new Promise((resolve) => setTimeout(resolve, 10));

            global.fetch = () =>
                Promise.resolve({
                    ok: true,
                    json: async () => ({ page: 2 }),
                });

            const result = await requestManager.fetch('/api/users?page=2');
            const data = await result.json();

            expect(data.page).toBe(2);
            expect(requestManager.getActiveCount()).toBe(0);
        });
    });

    describe('noCancel option', () => {
        let originalFetch;

        beforeEach(() => {
            originalFetch = global.fetch;
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        test('should allow concurrent requests with noCancel: true', async () => {
            let firstResolved = false;
            let secondResolved = false;
            let fetchCallCount = 0;

            global.fetch = (url, options) => {
                fetchCallCount++;
                if (url.includes('load=1')) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            firstResolved = true;
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({ data: 'first' }),
                            });
                        }, 50);
                    });
                } else if (url.includes('load=2')) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            secondResolved = true;
                            resolve({
                                ok: true,
                                status: 200,
                                json: () => Promise.resolve({ data: 'second' }),
                            });
                        }, 50);
                    });
                }
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            };

            // Both requests with same cleaned URL but noCancel: true
            const result1 = requestManager.fetch('/api/hasty?load=1', { noCancel: true });
            const result2 = requestManager.fetch('/api/hasty?load=2', { noCancel: true });

            // Wait for both to complete
            await Promise.all([result1, result2]);

            expect(fetchCallCount).toBe(2);
            expect(firstResolved).toBe(true);
            expect(secondResolved).toBe(true);
        });

        test('should not cancel previous request when noCancel is true', async () => {
            let firstCancelled = false;
            let firstResolved = false;
            const controller1 = new AbortController();

            const promise1 = new Promise((resolve, reject) => {
                controller1.signal.addEventListener('abort', () => {
                    firstCancelled = true;
                    reject(new Error('Cancelled'));
                });
                setTimeout(() => {
                    firstResolved = true;
                    resolve('first');
                }, 100);
            });

            requestManager
                .request('/api/test', promise1, {
                    abortController: controller1,
                    noCancel: true,
                })
                .catch(() => {});

            // Wait a bit before making second request
            await new Promise((resolve) => setTimeout(resolve, 10));

            const promise2 = Promise.resolve('second');
            const result2 = await requestManager.request('/api/test', promise2, {
                noCancel: true,
            });

            expect(result2).toBe('second');
            // First request should not be cancelled
            expect(firstCancelled).toBe(false);

            // Wait for first request to complete
            await new Promise((resolve) => setTimeout(resolve, 150));
            expect(firstResolved).toBe(true);
        });

        test('should work with requestKey and noCancel together', async () => {
            let fetchCallCount = 0;
            global.fetch = () => {
                fetchCallCount++;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: 'success' }),
                });
            };

            // Even with same requestKey, noCancel should prevent cancellation
            const result1 = await requestManager.fetch('/api/test', {
                requestKey: 'test-key',
                noCancel: true,
            });
            const result2 = await requestManager.fetch('/api/test', {
                requestKey: 'test-key',
                noCancel: true,
            });

            expect(fetchCallCount).toBe(2);
            expect(result1.ok).toBe(true);
            expect(result2.ok).toBe(true);
        });

        test('should work with fetch method and noCancel for lazy loading scenario', async () => {
            let fetchCallCount = 0;
            const fetchResults = [];

            global.fetch = (url) => {
                fetchCallCount++;
                fetchResults.push(url);
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: `result-${fetchCallCount}` }),
                });
            };

            const results = await Promise.all([
                requestManager.fetch('/api/hasty?load=1', { noCancel: true }),
                requestManager.fetch('/api/hasty?load=2', { noCancel: true }),
                requestManager.fetch('/api/hasty?load=3', { noCancel: true }),
            ]);

            expect(fetchCallCount).toBe(3);
            expect(results.length).toBe(3);
            expect(fetchResults).toContain('/api/hasty?load=1');
            expect(fetchResults).toContain('/api/hasty?load=2');
            expect(fetchResults).toContain('/api/hasty?load=3');
            results.forEach((result) => {
                expect(result.ok).toBe(true);
            });
        });

        test('should generate unique request IDs when noCancel is true', async () => {
            let fetchCallCount = 0;
            global.fetch = () => {
                fetchCallCount++;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: 'success' }),
                });
            };

            // Multiple requests with same URL but noCancel should all execute
            await Promise.all([
                requestManager.fetch('/api/hasty?load=1', { noCancel: true }),
                requestManager.fetch('/api/hasty?load=2', { noCancel: true }),
                requestManager.fetch('/api/hasty?load=3', { noCancel: true }),
            ]);

            // All should have executed
            expect(fetchCallCount).toBe(3);
            expect(requestManager.getActiveCount()).toBe(0);
        });
    });
});
