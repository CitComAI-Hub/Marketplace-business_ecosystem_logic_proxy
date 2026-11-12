/* Guard of the catalog API (rulebook R2.4): a product specification or offering is
 * written only if it is exactly what a rulebook class generates for the seller's
 * own connector. Runs after the catalog validators, on POST and PATCH.
 *
 * - a specification with access policies: they must be generated for this seller;
 *   a specification without them is a draft and passes;
 * - an offering, always: its specification must be generated, its terms must be
 *   its class's (License, Policy class).
 */

const rulebook = require('../../lib/rulebook');
const logger = require('../../lib/logger').logger.getLogger('TMF');

const SPEC = /\/productSpecification(\/([^/?]+))?\/?(\?.*)?$/;
const OFFERING = /\/productOffering(\/([^/?]+))?\/?(\?.*)?$/;

function reject(callback, status, message) {
    callback({ status: status, message: message });
}

async function finalBody(req, kind, id) {
    const body = JSON.parse(req.body);
    if (req.method !== 'PATCH') {
        return body;
    }
    // TMForum PATCH replaces the top-level fields it gets
    const current = await rulebook.catalogGet(`/${kind}/${id}`);
    return Object.assign({}, current, body);
}

async function run(req) {
    const path = req.apiUrl || '';
    const spec = SPEC.exec(path);
    const offering = OFFERING.exec(path);
    if ((!spec && !offering) || ['POST', 'PATCH'].indexOf(req.method) < 0) {
        return null;
    }
    const host = rulebook.hostOf(req.user && req.user.id);
    if (!host) {
        return {
            status: 403,
            message: 'Only organisations with their own connector (did:web) can publish in the CitCom data space'
        };
    }
    const others = await rulebook.providerSpecifications(req.user.partyId);
    let body;
    if (spec) {
        const specification = await finalBody(req, 'productSpecification', spec[2]);
        body = { host: host, specification: specification, provider_specifications: others };
    } else {
        const offer = await finalBody(req, 'productOffering', offering[2]);
        const ref = offer.productSpecification;
        const specId = Array.isArray(ref) ? ref[0] && ref[0].id : ref && ref.id;
        if (!specId) {
            return { status: 422, message: 'The offering has no product specification' };
        }
        const specification = await rulebook.catalogGet(`/productSpecification/${specId}`);
        body = { host: host, specification: specification, offering: offer, provider_specifications: others };
    }
    const result = await rulebook.check(body);
    if (!result.ok) {
        logger.info(`Rulebook guard rejected ${req.method} ${path}: ${result.problems.join('; ')}`);
        return {
            status: 422,
            message: 'Not generated from the CitCom rulebook: ' + result.problems.join('; ') +
                '. Create offers with the offer wizard.'
        };
    }
    return null;
}

exports.guard = function(req, callback) {
    if (!rulebook.enabled()) {
        return callback(null);
    }
    run(req).then(
        (error) => callback(error),
        (err) => {
            if (err instanceof SyntaxError) {
                return reject(callback, 400, 'The provided body is not a valid JSON');
            }
            if (err instanceof rulebook.RulebookUnavailable) {
                return reject(callback, 503, 'The rulebook service is not available; try again later');
            }
            logger.error(`Rulebook guard: ${err.message}`);
            return reject(callback, 503, 'The offer could not be checked against the rulebook; try again later');
        }
    );
};
