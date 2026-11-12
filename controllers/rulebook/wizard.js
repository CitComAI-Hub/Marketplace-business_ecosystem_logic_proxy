/* Offer wizard API: the browser asks for the rulebook classes and for the policies
 * and terms of a new offer. The provider's host comes from the logged-in
 * organisation's did:web, never from the browser, so a seller can only generate
 * offers for its own connector. The browser then creates the specification and the
 * offering through the catalog API, where the guard checks them again.
 */

const config = require('../../config');
const rulebook = require('../../lib/rulebook');
const utils = require('../../lib/utils');
const logger = require('../../lib/logger').logger.getLogger('TMF');

function fail(res, status, message) {
    res.status(status).json({ error: message });
}

function handle(res, promise) {
    promise.then(
        (body) => res.status(200).json(body),
        (err) => {
            if (err.status === 400) {
                return fail(res, 400, err.message);
            }
            logger.error(`Rulebook wizard: ${err.message}`);
            return fail(res, 503, 'The rulebook service is not available; try again later');
        }
    );
}

exports.classes = function(req, res) {
    if (!rulebook.enabled()) {
        return fail(res, 404, 'The rulebook service is not configured');
    }
    handle(res, rulebook.classes());
};

// body: {class, offer: {name, path, entity_type | role, terms?}, provider_terms: {...}}
exports.generate = function(req, res) {
    if (!rulebook.enabled()) {
        return fail(res, 404, 'The rulebook service is not configured');
    }
    if (!utils.hasRole(req.user, config.roles.seller)) {
        return fail(res, 403, 'Only providers can create offers');
    }
    const host = rulebook.hostOf(req.user.id);
    if (!host) {
        return fail(res, 403, 'Only organisations with their own connector (did:web) can publish in the CitCom data space');
    }
    let body = req.body;
    try {
        body = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (e) {
        return fail(res, 400, 'The provided body is not a valid JSON');
    }
    if (!body || typeof body !== 'object') {
        return fail(res, 400, 'The provided body is not a valid JSON');
    }
    handle(
        res,
        rulebook.providerSpecifications(req.user.partyId).then((specs) =>
            rulebook.generate({
                class: body.class,
                provider: { host: host, terms: body.provider_terms || {} },
                offer: body.offer || {},
                provider_specifications: specs
            })
        )
    );
};
