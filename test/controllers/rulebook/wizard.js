/* Offer wizard API (controllers/rulebook/wizard.js). */

const proxyquire = require('proxyquire');

describe('Rulebook wizard', function() {
    const SELLER = { id: 'did:web:acme.example.org', partyId: 'urn:org:acme', roles: [{ name: 'seller' }] };
    let sent;

    function load(generate) {
        const real = require('../../../lib/rulebook');
        const fake = Object.assign({}, real, {
            enabled: () => true,
            providerSpecifications: () => Promise.resolve([{ id: 'urn:spec:other' }]),
            generate: generate || ((body) => { sent = body; return Promise.resolve({ characteristics: [] }); })
        });
        return proxyquire('../../../controllers/rulebook/wizard', { '../../lib/rulebook': fake });
    }

    function response() {
        const res = { statusCode: null, body: null };
        res.status = (s) => { res.statusCode = s; return res; };
        res.json = (b) => { res.body = b; res.done(); return res; };
        res.wait = new Promise((resolve) => { res.done = resolve; });
        return res;
    }

    it('generates for the logged-in organisation, whatever host the browser sends', async function() {
        const wizard = load();
        const res = response();
        wizard.generate({ user: SELLER, body: JSON.stringify({
            class: 'dataset-access', offer: { name: 'bikes' }, provider_terms: { provider_name: 'ACME' },
            provider: { host: 'victim.example.org' }
        }) }, res);
        await res.wait;
        expect(res.statusCode).toBe(200);
        expect(sent.provider.host).toBe('acme.example.org');
        expect(sent.provider.terms).toEqual({ provider_name: 'ACME' });
        expect(sent.provider_specifications).toEqual([{ id: 'urn:spec:other' }]);
    });

    it('is only for sellers', async function() {
        const wizard = load();
        const res = response();
        wizard.generate({ user: { id: 'did:web:acme.example.org', roles: [] }, body: '{}' }, res);
        await res.wait;
        expect(res.statusCode).toBe(403);
    });

    it('passes the rulebook service validation errors to the browser', async function() {
        const wizard = load(() => { const e = new Error('offer.path: Path prefix...'); e.status = 400; return Promise.reject(e); });
        const res = response();
        wizard.generate({ user: SELLER, body: '{"class": "service-access"}' }, res);
        await res.wait;
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('offer.path');
    });
});
