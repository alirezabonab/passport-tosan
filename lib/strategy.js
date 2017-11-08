/**
 * Module dependencies.
 */
var uri = require('url'),
    util = require('util'),
    OAuth2Strategy = require('passport-oauth2'),
    InternalOAuthError = require('passport-oauth2').InternalOAuthError,
    TosanAuthorizationError = require('./errors/tosanauthorizationerror'),
    TosanTokenError = require('./errors/tosantokenerror');


/**
 * `Strategy` constructor.
 *
 * The Tosan authentication strategy authenticates requests by delegating to
 * Tosan using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      your Tosan application's App ID
 *   - `clientSecret`  your Tosan application's App Secret
 *   - `callbackURL`   URL to which Tosan will redirect the user after granting authorization
 *
 * Examples:
 *
 *     passport.use( new BoomrangStrategy({
            clientID: 'boom_app_key',
            scope: '',
            bankId: default is 'ANSBIR',
            boomToken: token_you_got_from_boom_login,
            deviceId: 'device_id',
            clientSecret: 'boom_app_secret_key',
            callbackURL: 'http://localhost:3000/auth/tosan/callback'
        },
 function (accessToken, profile, done) {
                   // profile contains :
                   //    access-token,
                   //    refresh-token(if you have access),
                   //    scopes,
                   //    expiresIn( Token Expire Timte)
                }
 ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */


function Strategy(options, verify) {
    options = options || {};
    options.sandbox = !!options.sandbox;
    options.bankId = options.bankId || 'ANSBIR';
    options.boomToken = options.boomToken || '';
    options.deviceId = options.deviceId || '';
    options.state = options.state || '1';
    options.clientID = options.clientID || '';
    options.clientSecret = options.clientSecret || '';
    options.authorizationURL = options.authorizationURL || 'https://app.tosanboom.com:4433/oauth/authorize';
    options.tokenURL = options.tokenURL || 'https://app.tosanboom.com:4433/oauth/token';
    options.scope = options.scope || '';
    options.scopeSeparator = options.scopeSeparator || ',';
    options.callbackURL = options.callbackURL || '';
    options.profileURL = options.profileURL || 'https://app.tosanboom.com:4432/v1/accounts';

    if (!options.sandbox && options.bankId == 'ANSBIR')
        options.bankId = 'BOOMIR';

    var authString = new Buffer(options.clientID + ':' + options.clientSecret);
    options.customHeaders = {
        "Authorization": "Basic " + authString.toString('base64')
    };

    function customVerify(accessToken, refreshToken, params, profile, done) {

        profile = profile || {};
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        profile.tokenExpiresIn = params.expires_in;
        profile.scopes = params.scope;

        verify(accessToken, profile, done);
    };


    OAuth2Strategy.call(this, options, customVerify);
    this.name = 'tosan';
    this._clientSecret = options.clientSecret;

    this._options = options;
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(Strategy, OAuth2Strategy);


/**
 * override query params in authorize step.
 *
 * @param {String} body
 * @param {Number} status
 * @return {Error}
 * @api protected
 */
Strategy.prototype.authorizationParams = function () {
    return {
        device_id: this._options.deviceId,
        state: this._options.state,
        sandbox: this._options.sandbox,
        bank_id: this._options.bankId,
        boom_token: this._options.boomToken,
        response_type: 'code',
        client_id: this._options.clientID
    };
};


/**
 * Authenticate request by delegating to Tosan using OAuth 2.0.
 *
 * @param {Object} req
 * @param {Object} options
 * @api protected
 */
Strategy.prototype.authenticate = function (req, options) {
    // Tosan doesn't conform to the OAuth 2.0 specification, with respect to
    // redirecting with error codes.
    //
    //   FIX: https://github.com/jaredhanson/passport-oauth/issues/16
    if (req.query && req.query.error_code && !req.query.error) {
        return this.error(new TosanAuthorizationError(req.query.error_message, parseInt(req.query.error_code, 10)));
    }

    // get bankId from query parameters
    if (req.query && req.query.bank_id) {
        this._options.bankId = req.query.bank_id;
    }

    OAuth2Strategy.prototype.authenticate.call(this, req, options);
};


/**
 * Parse error response from Tosan OAuth 2.0 token endpoint.
 *
 * @param {String} body
 * @param {Number} status
 * @return {Error}
 * @api protected
 */
Strategy.prototype.parseErrorResponse = function (body, status) {
    var json = JSON.parse(body);
    if (json.error && typeof json.error == 'object') {
        return new TosanTokenError(json.error.message, json.error.type, json.error.code, json.error.error_subcode);
    }

    return OAuth2Strategy.prototype.parseErrorResponse.call(this, body, status);
};

/**
 * Retrieve user profile from Boomrang.
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
Strategy.prototype.userProfile = function (accessToken, done) {
    var url = uri.parse(this._options.profileURL + "?has_address=true&length=2&offset=0");

    url = uri.format(url);
    var bankId = this._options.bankId;

    this._oauth2.setAuthMethod('Bearer');
    this._oauth2.useAuthorizationHeaderforGET(true);
    this._oauth2.get(url, accessToken, function (err, body, res) {
        var json;

        if (err) {
            if (err.data) {
                try {
                    json = JSON.parse(err.data);
                } catch (_) {
                }
            }

            if (json && json.error && typeof json.error == 'object') {
                return done(new BoomrangAPIError(json.error.message, json.error.type, json.error.code, json.error.error_subcode));
            }
            return done(new InternalOAuthError('Failed to fetch user profile', err));
        }

        try {
            json = JSON.parse(body);
        } catch (ex) {
            return done(new Error('Failed to parse user profile'));
        }

        var profile = json;
        profile.provider = 'tosan';

        if (bankId == 'BOOMIR')
            profile.bankId = 'ANSBIR';
        else
            profile.bankId = bankId;

        done(null, profile);
    });
};

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;
