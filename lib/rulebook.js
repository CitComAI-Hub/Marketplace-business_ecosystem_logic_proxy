/* CitCom rulebook service client (citcom-ds-rulebook, rulebook_gen/service.py).
 *
 * The marketplace never writes access policies or terms of its own: the offer
 * wizard asks the rulebook service to generate them, and every write of a product
 * specification or offering is checked by the same service before it reaches
 * TMForum (controllers/rulebook/guard.js). Disabled when BAE_LP_RULEBOOK_URL is
 * not set.
 */

const axios = require('axios');
const config = require('../config');
const utils = require('./utils');

const TIMEOUT = 15000;

class RulebookUnavailable extends Error {}

function serviceUrl() {
    const url = config.rulebook && config.rulebook.url;
    return url ? url.replace(/\/+$/, '') : null;
}

function enabled() {
    return !!serviceUrl();
}

// The provider's own connector is the host of its did:web. Organisations without
// one (e.g. realms created by the onboarding portal) cannot publish offers.
function hostOf(did) {
    const match = /^did:web:([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+)$/.exec(did || '');
    return match ? match[1] : null;
}

function catalogUrl(path) {
    return utils.getAPIURL(
        config.endpoints.catalog.appSsl,
        config.endpoints.catalog.host,
        config.endpoints.catalog.port,
        `${config.endpoints.catalog.apiPath}${path}`
    );
}

async function catalogGet(path) {
    const response = await axios.get(catalogUrl(path), { timeout: TIMEOUT });
    return response.data;
}

// Every specification of the provider: the verifier policy of an offer lists all
// the roles its provider grants with the same credential type.
async function providerSpecifications(partyId) {
    const specs = await catalogGet(`/productSpecification?relatedParty.id=${encodeURIComponent(partyId)}&limit=1000`);
    return Array.isArray(specs) ? specs : [];
}

async function call(method, path, body) {
    try {
        const response = await axios({ method, url: serviceUrl() + path, data: body, timeout: TIMEOUT });
        return response.data;
    } catch (err) {
        if (err.response && err.response.status === 400) {
            const error = new Error(err.response.data && err.response.data.error ? err.response.data.error : 'invalid request');
            error.status = 400;
            throw error;
        }
        throw new RulebookUnavailable('The rulebook service is not available');
    }
}

module.exports = {
    RulebookUnavailable,
    enabled,
    hostOf,
    catalogGet,
    providerSpecifications,
    classes: () => call('get', '/classes'),
    generate: (body) => call('post', '/generate', body),
    check: (body) => call('post', '/check', body)
};
