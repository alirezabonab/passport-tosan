/**
 * `TosanAuthorizationError` error.
 *
 * TosanAuthorizationError represents an error in response to an
 * authorization request on Tosan.  Note that these responses don't conform
 * to the OAuth 2.0 specification.
 *
 * References:
 *   - None
 *
 * @constructor
 * @param {String} [message]
 * @param {Number} [code]
 * @api public
 */
function TosanAuthorizationError(message, code) {
	Error.call(this);
	Error.captureStackTrace(this, arguments.callee);
	this.name = 'TosanAuthorizationError';
	this.message = message;
	this.code = code;
	this.status = 500;
}

/**
 * Inherit from `Error`.
 */
TosanAuthorizationError.prototype.__proto__ = Error.prototype;


/**
 * Expose `TosanAuthorizationError`.
 */
module.exports = TosanAuthorizationError;
