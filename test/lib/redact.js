/* Credentials are not logged (lib/redact.js). */

const redact = require('../../lib/redact');

describe('Logged headers', function() {
    it('replace credentials and keep the rest', function() {
        const out = redact.headers({
            authorization: 'Bearer eyJ...',
            cookie: 'connect.sid=s%3A...',
            'x-auth-token': 'abc',
            'x-organization': 'did:web:acme.example.org',
            'user-agent': 'Mozilla'
        });
        expect(out.authorization).toBe('[redacted]');
        expect(out.cookie).toBe('[redacted]');
        expect(out['x-auth-token']).toBe('[redacted]');
        expect(out['x-organization']).toBe('did:web:acme.example.org');
        expect(out['user-agent']).toBe('Mozilla');
    });

    it('does not change the request', function() {
        const headers = { authorization: 'Bearer x' };
        redact.headers(headers);
        expect(headers.authorization).toBe('Bearer x');
    });
});
