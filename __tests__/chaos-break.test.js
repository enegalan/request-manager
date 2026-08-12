/**
 * Adversarial / chaos suite: misuse + correct use.
 * Goal: surface crashes, hangs, undocumented surprises, doc mismatches.
 */
import RequestManager from '../main.js';

function generateRequestId(url, requestKey = null, includeQuery = false) {
    if (requestKey !== null && requestKey !== undefined) {
        if (typeof requestKey === 'function') {
            try {
                requestKey = requestKey();
            } catch {
                requestKey = null;
            }
        }
        if (requestKey !== null && requestKey !== undefined) return `request_${String(requestKey)}`;
    }
    let cleanedUrl = url || '';
    if (cleanedUrl.includes('://')) cleanedUrl = cleanedUrl.split('://')[1];
    if (cleanedUrl.includes('#')) cleanedUrl = cleanedUrl.split('#')[0];
    if (!includeQuery && cleanedUrl.includes('?')) cleanedUrl = cleanedUrl.split('?')[0];
    return `request_${cleanedUrl}`;
}

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), ms)),
    ]);
}

describe('CHAOS: constructor & options misuse', () => {
    test('constructor with null / undefined / non-object', () => {
        expect(() => new RequestManager()).not.toThrow();
        expect(() => new RequestManager(undefined)).not.toThrow();
        expect(() => new RequestManager(null)).toThrow(); // null.verbose
        expect(() => new RequestManager(true)).not.toThrow();
        expect(() => new RequestManager(0)).not.toThrow();
        expect(() => new RequestManager('verbose')).not.toThrow();
        expect(() => new RequestManager([])).not.toThrow();
    });

    test('setOptions with null / non-object / partial', () => {
        const rm = new RequestManager({ verbose: true });
        expect(() => rm.setOptions({ verbose: false })).not.toThrow();
        expect(rm.verbose).toBe(false);
        expect(() => rm.setOptions({})).not.toThrow();
        expect(() => rm.setOptions(null)).toThrow();
        expect(() => rm.setOptions(undefined)).toThrow();
    });

    test('getOptions returns same reference as managerOptions (mutable leak?)', () => {
        const rm = new RequestManager({ verbose: true });
        const opts = rm.getOptions();
        opts.verbose = false;
        opts.hacked = true;
        expect(rm.managerOptions.hacked).toBe(true);
        expect(rm.verbose).toBe(true); // verbose flag not re-synced from mutated object
    });
});

describe('CHAOS: nullish / weird args to request()', () => {
    let rm;
    beforeEach(() => {
        rm = new RequestManager();
    });

    test('url null / undefined OK; number / object crash in ID generation', async () => {
        await expect(rm.request(null, Promise.resolve('ok'))).resolves.toBe('ok');
        await expect(rm.request(undefined, Promise.resolve('ok'))).resolves.toBe('ok');
        expect(() => rm.request(123, Promise.resolve('ok'))).toThrow();
        expect(() => rm.request({ path: '/x' }, Promise.resolve('ok'))).toThrow();
    });

    test('options null / undefined does not crash', async () => {
        await expect(rm.request('/a', Promise.resolve(1), null)).resolves.toBe(1);
        await expect(rm.request('/b', Promise.resolve(2), undefined)).resolves.toBe(2);
    });

    test('requestPromise null / undefined / number / plain object', async () => {
        // non-thenable → setTimeout resolve path
        await expect(withTimeout(rm.request('/n', null), 200, 'null')).resolves.toBeNull();
        await expect(withTimeout(rm.request('/u', undefined), 200, 'undefined')).resolves.toBeUndefined();
        await expect(withTimeout(rm.request('/num', 42), 200, 'number')).resolves.toBe(42);
        await expect(withTimeout(rm.request('/obj', { x: 1 }), 200, 'object')).resolves.toEqual({ x: 1 });
    });

    test('thenable that throws synchronously on .then', async () => {
        const bad = {
            then() {
                throw new Error('sync then boom');
            },
        };
        await expect(rm.request('/boom', bad)).rejects.toThrow('sync then boom');
    });

    test('function callback that throws synchronously propagates sync (not rejected promise)', () => {
        expect(() =>
            rm.request('/fn', () => {
                throw new Error('fn boom');
            })
        ).toThrow('fn boom');
    });

    test('function returning non-promise', async () => {
        await expect(withTimeout(rm.request('/fn2', () => 'not-a-promise'), 200, 'fn non-promise')).resolves.toBe(
            'not-a-promise'
        );
    });
});

describe('CHAOS: requestKey edge values', () => {
    let rm;
    beforeEach(() => {
        rm = new RequestManager();
    });

    test.each([
        ['empty string', ''],
        ['zero', 0],
        ['false via fn', () => false],
        ['true via fn', () => true],
        ['object via fn', () => ({ a: 1 })],
        ['array via fn', () => [1, 2]],
        ['null via fn falls back to url', () => null],
        ['undefined via fn falls back to url', () => undefined],
    ])('requestKey=%s does not crash', async (_label, key) => {
        const result = await rm.request('/api/rk', Promise.resolve('ok'), { requestKey: key });
        expect(result).toBe('ok');
    });

    test('requestKey "" and "0" are different IDs; both cancel within themselves', async () => {
        const c1 = new AbortController();
        const c2 = new AbortController();
        rm.request('/a', new Promise(() => {}), { abortController: c1, requestKey: '' }).catch(() => {});
        await rm.request('/a', Promise.resolve('a'), { requestKey: '' });
        expect(c1.signal.aborted).toBe(true);

        rm.request('/b', new Promise(() => {}), { abortController: c2, requestKey: 0 }).catch(() => {});
        await rm.request('/b', Promise.resolve('b'), { requestKey: 0 });
        expect(c2.signal.aborted).toBe(true);
    });

    test('object requestKey (not function) becomes String(object)', async () => {
        const key = { id: 1 };
        const c = new AbortController();
        rm.request('/o', new Promise(() => {}), { abortController: c, requestKey: key }).catch(() => {});
        await rm.request('/o', Promise.resolve('second'), { requestKey: { id: 1 } });
        // Different object refs → same String([object Object]) → SHOULD cancel
        expect(c.signal.aborted).toBe(true);
    });
});

describe('CHAOS: URL cleaning surprises', () => {
    let rm;
    let originalFetch;
    beforeEach(() => {
        rm = new RequestManager();
        originalFetch = global.fetch;
        global.fetch = () => new Promise(() => {});
    });
    afterEach(() => {
        global.fetch = originalFetch;
        rm.cancelAll();
    });

    test('http vs https same host+path → SAME id (protocol stripped) → cancel', async () => {
        const c = new AbortController();
        rm.fetch('http://api.example.com/users', { abortController: c }).catch(() => {});
        global.fetch = () => Promise.resolve({ ok: true });
        await rm.fetch('https://api.example.com/users');
        expect(c.signal.aborted).toBe(true);
    });

    test('hash-only difference → SAME id → cancel', async () => {
        const c = new AbortController();
        rm.fetch('/page#section1', { abortController: c }).catch(() => {});
        global.fetch = () => Promise.resolve({ ok: true });
        await rm.fetch('/page#section2');
        expect(c.signal.aborted).toBe(true);
    });

    test('GET vs POST same URL → cancel each other (method NOT in id)', async () => {
        const c = new AbortController();
        rm.fetch('/api/item', { method: 'GET', abortController: c }).catch(() => {});
        global.fetch = () => Promise.resolve({ ok: true });
        await rm.fetch('/api/item', { method: 'POST', body: '{}' });
        expect(c.signal.aborted).toBe(true);
    });

    test('trailing slash difference → DIFFERENT ids (no normalize)', async () => {
        global.fetch = () => new Promise(() => {});
        rm.fetch('/api/users').catch(() => {});
        rm.fetch('/api/users/').catch(() => {});
        expect(rm.getActiveCount()).toBe(2);
    });

    test('query param order with includeQuery: different strings = different ids', () => {
        rm.fetch('/api?a=1&b=2', { includeQuery: true }).catch(() => {});
        rm.fetch('/api?b=2&a=1', { includeQuery: true }).catch(() => {});
        expect(rm.getActiveCount()).toBe(2);
    });

    test('URL with only query: /?q=1 cleaned to / or empty?', () => {
        const id = generateRequestId('/?q=1');
        expect(id).toBe('request_/');
    });

    test('multiple :// in weird url', async () => {
        const c = new AbortController();
        rm.fetch('http://evil.com://path', { abortController: c }).catch(() => {});
        global.fetch = () => Promise.resolve({ ok: true });
        // cleaned: evil.com://path vs ... split once only
        await rm.fetch('https://evil.com://path');
        expect(c.signal.aborted).toBe(true);
    });
});

describe('CHAOS: cancel / verbose behavior', () => {
    test('verbose=false → cancelled promise stays silent (does not settle)', async () => {
        const rm = new RequestManager({ verbose: false });
        const p = rm.request('/hang', new Promise(() => {}));
        let settled = false;
        p.then(() => {
            settled = true;
        }).catch(() => {
            settled = true;
        });
        const id = generateRequestId('/hang');
        rm.cancel(id);
        await new Promise((r) => setTimeout(r, 50));
        expect(settled).toBe(false);
    });

    test('verbose=true cancel() message includes requestId', async () => {
        const rm = new RequestManager({ verbose: true });
        const p = rm.request('/api/x', new Promise(() => {}));
        let msg = null;
        p.catch((e) => {
            msg = e.message;
        });
        const id = generateRequestId('/api/x');
        rm.cancel(id);
        await new Promise((r) => setTimeout(r, 20));
        expect(msg).toBe(`Request ${id} was cancelled`);
    });

    test('auto-cancel via duplicate: with verbose, message includes requestId', async () => {
        const rm = new RequestManager({ verbose: true });
        const c = new AbortController();
        let msg = null;
        rm.request('/dup', new Promise(() => {}), { abortController: c }).catch((e) => {
            msg = e.message;
        });
        await rm.request('/dup', Promise.resolve('ok'));
        await new Promise((r) => setTimeout(r, 20));
        expect(msg).toMatch(/^Request .+ was cancelled$/);
    });

    test('cancel unknown id returns false', () => {
        expect(new RequestManager().cancel('nope')).toBe(false);
    });

    test('double cancel same id', () => {
        const rm = new RequestManager();
        rm.request('/d', new Promise(() => {})).catch(() => {});
        const id = generateRequestId('/d');
        expect(rm.cancel(id)).toBe(true);
        expect(rm.cancel(id)).toBe(false);
    });

    test('cancelAll while empty', () => {
        expect(new RequestManager().cancelAll()).toBe(0);
    });
});

describe('CHAOS: clear() footgun', () => {
    test('clear leaves underlying request running; later resolve does NOT resolve wrapper', async () => {
        const rm = new RequestManager();
        let resolveInner;
        const inner = new Promise((r) => {
            resolveInner = r;
        });
        const wrapper = rm.request('/clear', inner);
        let wrapperSettled = false;
        wrapper.then(() => {
            wrapperSettled = true;
        });
        expect(rm.getActiveCount()).toBe(1);
        rm.clear();
        expect(rm.getActiveCount()).toBe(0);
        resolveInner('done');
        await new Promise((r) => setTimeout(r, 30));
        // After clear, requestInfo check fails → wrapper hangs forever
        expect(wrapperSettled).toBe(false);
    });
});

describe('CHAOS: getSignal / getAbortController handoff races', () => {
    test('two getSignal then two requests: only last handoff used; first gets NEW controller', async () => {
        const rm = new RequestManager();
        const s1 = rm.getSignal();
        const s2 = rm.getSignal(); // overwrites pending handoff
        expect(s1).not.toBe(s2);

        let signalUsed1 = null;
        let signalUsed2 = null;
        await rm.request('/a', ({ options }) => {
            signalUsed1 = options.signal;
            return Promise.resolve(1);
        });
        await rm.request('/b', ({ options }) => {
            signalUsed2 = options.signal;
            return Promise.resolve(2);
        });
        // First request consumed s2 (last handoff); second got fresh
        expect(signalUsed1).toBe(s2);
        expect(signalUsed2).not.toBe(s1);
        expect(signalUsed2).not.toBe(s2);
    });

    test('MISUSE: getSignal for parallel requests — second request does NOT share first signal', async () => {
        const rm = new RequestManager();
        const signal = rm.getSignal();
        const signals = [];
        rm.request('/p1', ({ options }) => {
            signals.push(options.signal);
            return new Promise(() => {});
        }).catch(() => {});
        rm.request('/p2', ({ options }) => {
            signals.push(options.signal);
            return new Promise(() => {});
        }).catch(() => {});
        expect(signals[0]).toBe(signal);
        expect(signals[1]).not.toBe(signal);
        rm.cancelAll();
    });

    test('explicit abortController wins over pending handoff', async () => {
        const rm = new RequestManager();
        const pending = rm.getAbortController();
        const explicit = new AbortController();
        let used = null;
        await rm.request('/e', ({ options }) => {
            used = options.signal;
            return Promise.resolve('ok');
        }, { abortController: explicit });
        expect(used).toBe(explicit.signal);
        // pending leftover is cleared by #_resolveAbortController only when used —
        // when explicit provided, pending is still cleared (this.abortController = null)
        expect(rm.abortController).toBeNull();
        void pending;
    });
});

describe('CHAOS: fetch() misuse', () => {
    let originalFetch;
    let rm;
    beforeEach(() => {
        rm = new RequestManager();
        originalFetch = global.fetch;
    });
    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('fetch without global.fetch throws sync ReferenceError', () => {
        delete global.fetch;
        expect(() => rm.fetch('/x')).toThrow(ReferenceError);
    });

    test('custom options must not leak into fetch call', async () => {
        let passed = null;
        global.fetch = (_url, opts) => {
            passed = opts;
            return Promise.resolve({ ok: true });
        };
        await rm.fetch('/leak', {
            requestKey: 'k',
            noCancel: false,
            includeQuery: true,
            abortController: new AbortController(),
            cancelToken: () => {},
            method: 'GET',
        });
        expect(passed.requestKey).toBeUndefined();
        expect(passed.noCancel).toBeUndefined();
        expect(passed.includeQuery).toBeUndefined();
        expect(passed.abortController).toBeUndefined();
        expect(passed.cancelToken).toBeUndefined();
        expect(passed.method).toBe('GET');
        expect(passed.signal).toBeInstanceOf(AbortSignal);
    });

    test('options.signal from user is overwritten by manager signal', async () => {
        let passed = null;
        const userSignal = new AbortController().signal;
        global.fetch = (_url, opts) => {
            passed = opts;
            return Promise.resolve({ ok: true });
        };
        await rm.fetch('/sig', { signal: userSignal });
        expect(passed.signal).not.toBe(userSignal);
    });

    test('rapid fire same URL: only last resolves; others stay silent if verbose false', async () => {
        let n = 0;
        global.fetch = () => {
            const i = ++n;
            return new Promise((resolve) => setTimeout(() => resolve({ ok: true, i }), 20));
        };
        const p1 = rm.fetch('/rf');
        let p1Settled = false;
        p1.then(() => {
            p1Settled = true;
        }).catch(() => {
            p1Settled = true;
        });
        const p2 = rm.fetch('/rf');
        p2.catch(() => {});
        const p3 = rm.fetch('/rf');
        const last = await withTimeout(p3, 200, 'p3');
        expect(last.i).toBe(3);
        await new Promise((r) => setTimeout(r, 50));
        expect(p1Settled).toBe(false);
    });
});

describe('CHAOS: axios() misuse', () => {
    let rm;
    beforeEach(() => {
        rm = new RequestManager();
    });

    test('axios() without global axios throws sync ReferenceError', () => {
        const prev = global.axios;
        delete global.axios;
        expect(() => rm.axios('/api')).toThrow(ReferenceError);
        global.axios = prev;
    });

    test('custom options leak into axios config (requestKey etc)', async () => {
        let config = null;
        const mock = Object.assign(
            (cfg) => {
                config = cfg;
                return Promise.resolve({ data: 1 });
            },
            {
                CancelToken: {
                    source: () => ({ token: 't', cancel: () => {} }),
                },
            }
        );
        await rm.axios('/api', { requestKey: 'rk', noCancel: true, includeQuery: true, method: 'GET' }, mock);
        // axios spreads requestOptions into axios call — custom keys LEAK
        expect(config.requestKey).toBe('rk');
        expect(config.noCancel).toBe(true);
        expect(config.includeQuery).toBe(true);
    });
});

describe('CHAOS: ajax() misuse', () => {
    let rm;
    beforeEach(() => {
        rm = new RequestManager();
    });

    test('error message exact text', () => {
        expect(() => rm.ajax(null, '/x')).toThrow('ajaxFunction parameter must be a function');
    });

    test('ajaxFunction throws → rejected promise', async () => {
        await expect(
            rm.ajax(() => {
                throw new Error('ajax boom');
            }, '/x')
        ).rejects.toThrow('ajax boom');
    });

    test('ajax returns object with xhr.abort', async () => {
        let aborted = false;
        const c = new AbortController();
        const ajaxFn = () => {
            const p = new Promise(() => {});
            p.xhr = {
                abort: () => {
                    aborted = true;
                },
            };
            return p;
        };
        rm.ajax(ajaxFn, '/xhr-abort', { abortController: c }).catch(() => {});
        await new Promise((r) => setTimeout(r, 10));
        c.abort();
        await new Promise((r) => setTimeout(r, 10));
        expect(aborted).toBe(true);
    });

    test('custom keys passed through to ajaxFunction', async () => {
        let received = null;
        const ajaxFn = (args) => {
            received = args;
            const p = Promise.resolve('ok');
            p.abort = () => {};
            return p;
        };
        await rm.ajax(ajaxFn, '/a', { requestKey: 'k', foo: 'bar' });
        expect(received.requestKey).toBe('k');
        expect(received.foo).toBe('bar');
        expect(received.url).toBe('/a');
    });
});

describe('CHAOS: xhr() edge cases', () => {
    let rm;
    beforeEach(() => {
        rm = new RequestManager();
    });

    test('status 299 success, 300 reject', async () => {
        const make = (status) => {
            const mock = {
                open: () => {},
                send: () => {},
                setRequestHeader: () => {},
                getAllResponseHeaders: () => '',
                getResponseHeader: () => null,
                response: 'x',
                responseText: 'x',
                status,
                statusText: 'S',
                onload: null,
                onerror: null,
                ontimeout: null,
            };
            global.XMLHttpRequest = function () {
                return mock;
            };
            const p = rm.xhr('/s');
            setTimeout(() => mock.onload(), 5);
            return p;
        };
        await expect(make(299)).resolves.toMatchObject({ status: 299 });
        await expect(make(300)).rejects.toMatchObject({ status: 300 });
    });

    test('invalid JSON with application/json content-type falls back to text', async () => {
        const mock = {
            open: () => {},
            send: () => {},
            setRequestHeader: () => {},
            getAllResponseHeaders: () => '',
            getResponseHeader: () => 'application/json',
            response: 'not-json',
            responseText: 'not-json',
            status: 200,
            statusText: 'OK',
            onload: null,
            onerror: null,
            ontimeout: null,
        };
        global.XMLHttpRequest = function () {
            return mock;
        };
        const p = rm.xhr('/j');
        setTimeout(() => mock.onload(), 5);
        const result = await p;
        expect(result.data).toBe('not-json');
    });

    test('withCredentials and method case', async () => {
        let creds;
        let method;
        const mock = {
            open: (m) => {
                method = m;
            },
            send: () => {},
            setRequestHeader: () => {},
            getAllResponseHeaders: () => '',
            getResponseHeader: () => null,
            response: '',
            responseText: '',
            status: 200,
            statusText: 'OK',
            onload: null,
            onerror: null,
            ontimeout: null,
            set withCredentials(v) {
                creds = v;
            },
            get withCredentials() {
                return creds;
            },
        };
        global.XMLHttpRequest = function () {
            return mock;
        };
        const p = rm.xhr('/c', { method: 'post', withCredentials: true });
        setTimeout(() => mock.onload(), 5);
        await p;
        expect(method).toBe('POST');
        expect(creds).toBe(true);
    });
});

describe('CHAOS: isActive / cancel ID format surprise', () => {
    test('user cannot cancel by URL alone — must use request_ prefix', async () => {
        const rm = new RequestManager();
        rm.request('/api/users', new Promise(() => {})).catch(() => {});
        expect(rm.cancel('/api/users')).toBe(false);
        expect(rm.isActive('/api/users')).toBe(false);
        expect(rm.isActive(generateRequestId('/api/users'))).toBe(true);
        expect(rm.cancel(generateRequestId('/api/users'))).toBe(true);
    });
});

describe('CHAOS: noCancel + same requestKey still unique ids', () => {
    test('noCancel generates unique ids even with same requestKey', async () => {
        const rm = new RequestManager();
        const c1 = new AbortController();
        const c2 = new AbortController();
        rm.request('/x', new Promise(() => {}), {
            requestKey: 'same',
            noCancel: true,
            abortController: c1,
        }).catch(() => {});
        rm.request('/x', new Promise(() => {}), {
            requestKey: 'same',
            noCancel: true,
            abortController: c2,
        }).catch(() => {});
        expect(rm.getActiveCount()).toBe(2);
        expect(c1.signal.aborted).toBe(false);
        expect(c2.signal.aborted).toBe(false);
        rm.cancelAll();
    });
});

describe('CHAOS: race resolve after cancel', () => {
    test('cancelled request resolving late must not resolve new request wrapper', async () => {
        const rm = new RequestManager();
        let resolve1;
        const p1Inner = new Promise((r) => {
            resolve1 = r;
        });
        const c1 = new AbortController();
        const w1 = rm.request('/race', p1Inner, { abortController: c1 });
        let w1Result = 'pending';
        w1.then((v) => {
            w1Result = v;
        }).catch((e) => {
            w1Result = e.message;
        });

        const w2 = await rm.request('/race', Promise.resolve('second'));
        expect(w2).toBe('second');

        resolve1('late-first');
        await new Promise((r) => setTimeout(r, 30));
        // verbose false → cancelled wrapper stays pending (not 'late-first')
        expect(w1Result).toBe('pending');
    });
});

describe('CHAOS: addAbortListener edge', () => {
    test('abortMethod undefined with valid signal', () => {
        const rm = new RequestManager();
        const c = new AbortController();
        expect(() => rm.addAbortListener(undefined, c.signal)).not.toThrow();
        expect(() => c.abort()).not.toThrow();
    });
});

describe('CHAOS: stress concurrent distinct URLs', () => {
    test('100 concurrent different URLs all resolve', async () => {
        const rm = new RequestManager();
        const promises = [];
        for (let i = 0; i < 100; i++) {
            promises.push(rm.request(`/stress/${i}`, Promise.resolve(i)));
        }
        const results = await Promise.all(promises);
        expect(results).toEqual([...Array(100).keys()]);
        expect(rm.getActiveCount()).toBe(0);
    });

    test('100 rapid same-URL replacements: last wins', async () => {
        const rm = new RequestManager();
        let last;
        for (let i = 0; i < 100; i++) {
            last = rm.request('/same', Promise.resolve(i));
            last.catch(() => {});
        }
        await expect(last).resolves.toBe(99);
        expect(rm.getActiveCount()).toBe(0);
    });
});

describe('CHAOS: correct happy paths still work', () => {
    test('documented fetch cancel message path with verbose', async () => {
        const rm = new RequestManager({ verbose: true });
        const c = new AbortController();
        let err;
        rm.request('/doc', new Promise(() => {}), { abortController: c }).catch((e) => {
            err = e;
        });
        await rm.request('/doc', Promise.resolve('ok'));
        await new Promise((r) => setTimeout(r, 20));
        expect(err).toBeInstanceOf(Error);
        expect(String(err.message)).toContain('cancelled');
    });

    test('includeQuery + requestKey: requestKey wins', async () => {
        const rm = new RequestManager();
        const c = new AbortController();
        rm.fetch = undefined;
        global.fetch = () => new Promise(() => {});
        rm.request('/a?q=1', new Promise(() => {}), {
            abortController: c,
            requestKey: 'k',
            includeQuery: true,
        }).catch(() => {});
        await rm.request('/b?q=2', Promise.resolve('x'), { requestKey: 'k', includeQuery: true });
        expect(c.signal.aborted).toBe(true);
    });
});
