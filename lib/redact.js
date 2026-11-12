/* Request headers as they can be logged: credentials replaced (CitCom).
 *
 * The proxy logs every request's headers at debug level, and the log level is
 * trace (log_config.json): access tokens and session cookies ended up in the pod
 * logs, where anyone who can read them could reuse them while they are valid.
 */

const SECRET = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key)$|token|secret|password/i;

exports.headers = function(headers) {
    const out = {};
    for (const name of Object.keys(headers || {})) {
        out[name] = SECRET.test(name) ? '[redacted]' : headers[name];
    }
    return out;
};
