var BidTransformer = require('bid-transformer.js');

function Partner(profile, configs, requiredResources, fns) {

    /* =====================================
     * Constructors
     * ---------------------------------- */

    (function __constructor() {
        _configs = {
            timeout: 0,
            lineItemType: profile.lineItemType,
            targetingKeys: profile.targetingKeys,
            rateLimiting: profile.features.rateLimiting
        };

        _bidTransformers = {
            targeting = BidTransformer({
                inputCentsMultiplier: profile.bidUnitInCents,
                outputCentsDivisor: 1,
                outputPrecision: 0,
                roundingType: 'FLOOR',
                floor: 0,
                buckets: [{
                    max: 2000,
                    step: 5
                }, {
                    max: 5000,
                    step: 100
                }]
            }),
            price = BidTransformer({
                inputCentsMultiplier: profile.bidUnitInCents,
                outputCentsDivisor: 1,
                outputPrecision: 0,
                roundingType: 'NONE'
            })
        }
    })();

    /* =====================================
     * Public Interface
     * ---------------------------------- */

    return {
        _configs: _configs,
        _bidTransformers: _bidTransformers
    };
}

////////////////////////////////////////////////////////////////////////////////
// Enumerations ////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

Partner.Architectures = {
    MRA: 0,
    SRA: 1,
    FSRA: 2
};

Partner.CallbackTypes = {
    ID: 0,
    CALLBACK_NAME: 1,
    NONE: 2
};

Partner.RequestTypes = {
    ANY: 0,
    AJAX: 1,
    JSONP: 2
};

////////////////////////////////////////////////////////////////////////////////
// Exports /////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

module.exports = Partner;
