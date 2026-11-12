/* Rulebook guard of the catalog API (controllers/rulebook/guard.js). */

const proxyquire = require('proxyquire');

describe('Rulebook guard', function() {
    const SELLER = { id: 'did:web:acme.example.org', partyId: 'urn:org:acme' };
    let calls;

    function load(overrides) {
        calls = { check: [], get: [] };
        const real = require('../../../lib/rulebook');
        const fake = Object.assign(
            {
                RulebookUnavailable: real.RulebookUnavailable,
                enabled: () => true,
                hostOf: real.hostOf,
                providerSpecifications: () => Promise.resolve([{ id: 'urn:spec:other' }]),
                catalogGet: (path) => {
                    calls.get.push(path);
                    return Promise.resolve({ id: path.split('/').pop(), name: 'stored', lifecycleStatus: 'Launched' });
                },
                check: (body) => {
                    calls.check.push(body);
                    return Promise.resolve({ ok: true, problems: [] });
                }
            },
            overrides || {}
        );
        return proxyquire('../../../controllers/rulebook/guard', { '../../lib/rulebook': fake }).guard;
    }

    function run(guard, req) {
        return new Promise((resolve) => guard(req, resolve));
    }

    it('does nothing when the rulebook service is not configured', async function() {
        const guard = load({ enabled: () => false });
        const err = await run(guard, { method: 'POST', apiUrl: '/productSpecification', body: '{}', user: SELLER });
        expect(err).toBe(null);
    });

    it('ignores other catalog resources', async function() {
        const guard = load();
        const err = await run(guard, { method: 'POST', apiUrl: '/category', body: '{}', user: SELLER });
        expect(err).toBe(null);
        expect(calls.check.length).toBe(0);
    });

    it('checks a new specification for the seller host, with its other specs', async function() {
        const guard = load();
        const spec = { name: 'bikes', productSpecCharacteristic: [] };
        const err = await run(guard, { method: 'POST', apiUrl: '/productSpecification', body: JSON.stringify(spec), user: SELLER });
        expect(err).toBe(null);
        expect(calls.check[0].host).toBe('acme.example.org');
        expect(calls.check[0].specification).toEqual(spec);
        expect(calls.check[0].provider_specifications).toEqual([{ id: 'urn:spec:other' }]);
        expect(calls.check[0].offering).toBeUndefined();
    });

    it('checks a patched specification as it will be stored', async function() {
        const guard = load();
        const err = await run(guard, {
            method: 'PATCH', apiUrl: '/productSpecification/urn:spec:1', body: JSON.stringify({ name: 'new name' }), user: SELLER
        });
        expect(err).toBe(null);
        expect(calls.get).toContain('/productSpecification/urn:spec:1');
        expect(calls.check[0].specification).toEqual({ id: 'urn:spec:1', name: 'new name', lifecycleStatus: 'Launched' });
    });

    it('checks an offering together with its specification', async function() {
        const guard = load();
        const offering = { name: 'Bikes', productSpecification: { id: 'urn:spec:1' } };
        const err = await run(guard, { method: 'POST', apiUrl: '/catalog/productOffering', body: JSON.stringify(offering), user: SELLER });
        expect(err).toBe(null);
        expect(calls.get).toContain('/productSpecification/urn:spec:1');
        expect(calls.check[0].offering).toEqual(offering);
        expect(calls.check[0].specification.id).toBe('urn:spec:1');
    });

    it('rejects what the rulebook service rejects, with its reasons', async function() {
        const guard = load({ check: () => Promise.resolve({ ok: false, problems: ['ODRL policy is not what dataset-access generates'] }) });
        const err = await run(guard, { method: 'POST', apiUrl: '/productSpecification', body: '{}', user: SELLER });
        expect(err.status).toBe(422);
        expect(err.message).toContain('ODRL policy is not what dataset-access generates');
    });

    it('rejects an offering without specification', async function() {
        const guard = load();
        const err = await run(guard, { method: 'POST', apiUrl: '/catalog/productOffering', body: '{"name": "x"}', user: SELLER });
        expect(err.status).toBe(422);
    });

    it('rejects sellers without their own connector', async function() {
        const guard = load();
        const user = { id: 'did:web:onboarding.example.org:realm1', partyId: 'urn:org:x' };
        const err = await run(guard, { method: 'POST', apiUrl: '/productSpecification', body: '{}', user: user });
        expect(err.status).toBe(403);
    });

    it('fails closed when the rulebook service is down', async function() {
        const real = require('../../../lib/rulebook');
        const guard = load({ check: () => Promise.reject(new real.RulebookUnavailable('down')) });
        const err = await run(guard, { method: 'POST', apiUrl: '/productSpecification', body: '{}', user: SELLER });
        expect(err.status).toBe(503);
    });

    it('rejects a body that is not JSON', async function() {
        const guard = load();
        const err = await run(guard, { method: 'POST', apiUrl: '/productSpecification', body: '{', user: SELLER });
        expect(err.status).toBe(400);
    });
});

describe('Rulebook client', function() {
    const rulebook = require('../../../lib/rulebook');

    it('takes the provider host from a plain did:web only', function() {
        expect(rulebook.hostOf('did:web:vrain.citcom-vrain-dataspace.eu')).toBe('vrain.citcom-vrain-dataspace.eu');
        expect(rulebook.hostOf('did:web:onboarding.citcom-vrain-dataspace.eu:realm')).toBe(null);
        expect(rulebook.hostOf('did:key:z6Mk')).toBe(null);
        expect(rulebook.hostOf(undefined)).toBe(null);
    });
});
