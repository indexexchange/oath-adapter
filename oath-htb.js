/**
 * @author:    Partner
 * @license:   UNLICENSED
 *
 * @copyright: Copyright (c) 2017 by Index Exchange. All rights reserved.
 *
 * The information contained within this document is confidential, copyrighted
 * and or a trade secret. No part of this document may be reproduced or
 * distributed in any form or by any means, in whole or in part, without the
 * prior written permission of Index Exchange.
 */

'use strict';

////////////////////////////////////////////////////////////////////////////////
// Dependencies ////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

var Browser = require('browser.js');
var Classify = require('classify.js');
var Constants = require('constants.js');
var Partner = require('partner.js');
var Size = require('size.js');
var SpaceCamp = require('space-camp.js');
var System = require('system.js');
var Network = require('network.js');
var Utilities = require('utilities.js');
var OpenRtb = require('openrtb.js');
var EventsService;
var RenderService;
var ComplianceService;

//? if (DEBUG) {
var ConfigValidators = require('config-validators.js');
var PartnerSpecificValidator = require('oath-htb-validator.js');
var Scribe = require('scribe.js');
var Whoopsie = require('whoopsie.js');
//? }

////////////////////////////////////////////////////////////////////////////////
// Main ////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

/**
 * Partner module template
 *
 * @class
 */
function OathHtb(configs) {
    /* =====================================
     * Data
     * ---------------------------------- */

    /* Public
     * ---------------------------------- */

    /**
     * Endpoints URLS
     * @type {{eu: string, na: string, asia: string}}
     */
    var endpointsUrls = {
        oneDisplay: {
            eu: 'adserver-eu.adtech.advertising.com',
            na: 'adserver-us.adtech.advertising.com',
            asia: 'adserver-as.adtech.advertising.com'
        },
        oneMobile: {
            get: 'c2shb.ssp.yahoo.com'
        }
    };

    /**
     * The protocol used to make the bid requests.
     *
     * @private {string}
     */
    var __proto = 'https://';

    /* Private
     * ---------------------------------- */

    /**
     * Reference to the partner base class.
     *
     * @private {object}
     */
    var __baseClass;

    /**
     * Profile for this partner.
     *
     * @private {object}
     */
    var __profile;


    /* =====================================
     * Functions
     * ---------------------------------- */

    /**
    * Construct request object for OneMobile Endpoint.
    * @param {object} xSlot
    * @return {object} request object.
    */
    function __generateOneMobileRequest(xSlot) {
        var baseUrl = __proto + endpointsUrls.oneMobile.get;
        var requestId = '_' + System.generateUniqueId();

        var requestParams = {
            dcn: xSlot.dcn,
            pos: xSlot.pos,
            secure: 1
        };

        if (ComplianceService.isPrivacyEnabled()) {
            __addGdprParams(requestParams);
        }

        var url = Network.buildUrl(baseUrl, ['bidRequest?cmd=bid']);

        for (var parameter in requestParams) {
            if (!requestParams.hasOwnProperty(parameter)) {
                continue;
            }
            url += '&' + parameter + '=' + requestParams[parameter];
        }

        return {
            url: url,
            callbackId: requestId
        };
    }

    /**
    * Construct request object for OneDisplay Endpoint.
    * @param {object} xSlot
    * @return {object} request object.
    */
    function __generateOneDisplayRequest(xSlot) {
        var region = xSlot.region || endpointsUrls.oneDisplay.na;
        var baseUrl = __proto + endpointsUrls.oneDisplay[region] + '/pubapi/3.0/' + xSlot.networkId;
        var requestId = '_' + System.generateUniqueId();

        /* sizeid & pageid */
        var sizeId = xSlot.sizeId || '-1';
        var pageId = xSlot.pageId || '0';

        /* request params */
        var requestParams = {
            cmd: 'bid',
            cors: 'yes',
            v: '2',
            misc: System.now()
        };

        if (xSlot.bidFloor) {
            requestParams.bidFloor = xSlot.bidFloor;
        }

        if (ComplianceService.isPrivacyEnabled()) {
            __addGdprParams(requestParams);
        }

        var url = Network.buildUrl(baseUrl, [xSlot.placementId, pageId, sizeId, 'ADTECH;']);

        /* build url paramters */
        for (var parameter in requestParams) {
            if (!requestParams.hasOwnProperty(parameter)) {
                continue;
            }
            url += parameter + '=' + requestParams[parameter] + ';';
        }

        return {
            url: url,
            callbackId: requestId
        };
    }

    /* Utilities
     * ---------------------------------- */

    /**
    * Determine if the xSlot should target OneMobile endpoint.
    * @param {object} xSlot
    * @return {boolean} true if xSlots targets OneMobile.
    */
    function __isOneMobileRequest(xSlot) {
        return xSlot.dcn && xSlot.pos;
    }

    function __addGdprParams(params) {
        var consentData = ComplianceService.gdpr.getConsent();

        if (consentData && consentData.applies) {
            params.gdpr = 1;

            if (consentData.consentString) {
                params.euconsent = consentData.consentString;
            }
        }
    }

    /**
     * Generates the request URL and query data to the endpoint for the xSlots
     * in the given returnParcels.
     *
     * @param  {object[]} returnParcels
     *
     * @return {object}
     */
    function __generateRequestObj(returnParcels) {

        /* =============================================================================
         * STEP 2  | Generate Request URL
         * -----------------------------------------------------------------------------
         *
         * Generate the URL to request demand from the partner endpoint using the provided
         * returnParcels. The returnParcels is an array of objects each object containing
         * an .xSlotRef which is a reference to the xSlot object from the partner configuration.
         * Use this to retrieve the placements/xSlots you need to request for.
         *
         * If your partner is MRA, returnParcels will be an array of length one. If your
         * partner is SRA, it will contain any number of entities. In any event, the full
         * contents of the array should be able to fit into a single request and the
         * return value of this function should similarly represent a single request to the
         * endpoint.
         *
         * Return an object containing:
         * queryUrl: the url for the request
         * data: the query object containing a map of the query string paramaters
         *
         * callbackId:
         *
         * arbitrary id to match the request with the response in the callback function. If
         * your endpoint supports passing in an arbitrary ID and returning it as part of the response
         * please use the callbackType: Partner.CallbackTypes.ID and fill out the adResponseCallback.
         * Also please provide this adResponseCallback to your bid request here so that the JSONP
         * response calls it once it has completed.
         *
         * If your endpoint does not support passing in an ID, simply use
         * Partner.CallbackTypes.CALLBACK_NAME and the wrapper will take care of handling request
         * matching by generating unique callbacks for each request using the callbackId.
         *
         * If your endpoint is ajax only, please set the appropriate values in your profile for this,
         * i.e. Partner.CallbackTypes.NONE and Partner.Requesttypes.AJAX. You also do not need to provide
         * a callbackId in this case because there is no callback.
         *
         * The return object should look something like this:
         * {
         *     url: 'http://bidserver.com/api/bids' // base request url for a GET/POST request
         *     data: { // query string object that will be attached to the base url
         *        slots: [
         *             {
         *                 placementId: 54321,
         *                 sizes: [[300, 250]]
         *             },{
         *                 placementId: 12345,
         *                 sizes: [[300, 600]]
         *             },{
         *                 placementId: 654321,
         *                 sizes: [[728, 90]]
         *             }
         *         ],
         *         site: 'http://google.com'
         *     },
         *     callbackId: '_23sd2ij4i1' //unique id used for pairing requests and responses
         * }
         */

        /* ---------------------- PUT CODE HERE ------------------------------------ */
        var callbackId = System.generateUniqueId();

        /* ---------------- Craft bid request using the above returnParcels --------- */

        var returnParcel = returnParcels[0];
        var xSlot = returnParcel.xSlotRef;
        if (__isOneMobileRequest(xSlot)) {
            __profile.statsId = 'OATHM';

            return __generateOneMobileRequest(xSlot);
        }

        return __generateOneDisplayRequest(xSlot);

    }

    /* =============================================================================
     * STEP 3  | Response callback
     * -----------------------------------------------------------------------------
     *
     * This generator is only necessary if the partner's endpoint has the ability
     * to return an arbitrary ID that is sent to it. It should retrieve that ID from
     * the response and save the response to adResponseStore keyed by that ID.
     *
     * If the endpoint does not have an appropriate field for this, set the profile's
     * callback type to CallbackTypes.CALLBACK_NAME and omit this function.
     */
    function adResponseCallback(adResponse) {
        /* get callbackId from adResponse here */
        var callbackId = 0;
        __baseClass._adResponseStore[callbackId] = adResponse;
    }
    /* -------------------------------------------------------------------------- */

    /* Helpers
     * ---------------------------------- */

    /* =============================================================================
     * STEP 5  | Rendering Pixel
     * -----------------------------------------------------------------------------
     *
    */

     /**
     * This function will render the pixel given.
     * @param  {string} pixelUrl Tracking pixel img url.
     */
    function __renderPixel(pixelUrl) {
        if (pixelUrl){
            var iframe = Browser.createHiddenIFrame(null);
            System.documentWrite(iframe.contentDocument, pixelUrl);
        }
    }

    /**
     * Parses and extracts demand from adResponse according to the adapter and then attaches it
     * to the corresponding bid's returnParcel in the correct format using targeting keys.
     *
     * @param {string} sessionId The sessionId, used for stats and other events.
     *
     * @param {any} adResponse This is the bid response as returned from the bid request, that was either
     * passed to a JSONP callback or simply sent back via AJAX.
     *
     * @param {object[]} returnParcels The array of original parcels, SAME array that was passed to
     * generateRequestObj to signal which slots need demand. In this funciton, the demand needs to be
     * attached to each one of the objects for which the demand was originally requested for.
     */
    function __parseResponse(sessionId, adResponse, returnParcels) {


        /* =============================================================================
         * STEP 4  | Parse & store demand response
         * -----------------------------------------------------------------------------
         *
         * Fill the below variables with information about the bid from the partner, using
         * the adResponse variable that contains your module adResponse.
         */

        /* This an array of all the bids in your response that will be iterated over below. Each of
         * these will be mapped back to a returnParcel object using some criteria explained below.
         * The following variables will also be parsed and attached to that returnParcel object as
         * returned demand.
         *
         * Use the adResponse variable to extract your bid information and insert it into the
         * bids array. Each element in the bids array should represent a single bid and should
         * match up to a single element from the returnParcel array.
         *
         */

        /* ---------- Process adResponse and extract the bids into the bids array ------------*/

        var ortbResponse = OpenRtb.BidResponse(adResponse); // ?
        /* --------------------------------------------------------------------------------- */

        /* MRA partners receive only one parcel in the array. */
        var curReturnParcel = returnParcels[0];

        var headerStatsInfo = {};
        var htSlotId = curReturnParcel.htSlot.getId();
        headerStatsInfo[htSlotId] = {};
        headerStatsInfo[htSlotId][curReturnParcel.requestId] = [curReturnParcel.xSlotName];

        // MRA
        var curBid = ortbResponse.getBids()[0];

        /* No matching bid found so its a pass */
        if (!curBid || curBid.hasOwnProperty('nbr')) {
            //? if (DEBUG) {
            Scribe.info(__profile.partnerId + ' no bid response for { id: ' + curReturnParcel.xSlotRef.placementId + ' }.');
            //? }

            if (__profile.enabledAnalytics.requestTime) {
                __baseClass._emitStatsEvent(sessionId, 'hs_slot_pass', headerStatsInfo);
            }
            curReturnParcel.pass = true;
            return;
        }

        /* ---------- Fill the bid variables with data from the bid response here. ------------*/

        /* Using the above variable, curBid, extract various information about the bid and assign it to
         * these local variables */

        /* the bid price for the given slot */
        var bidPrice = Number(curBid.price);

        /* the size of the given slot */
        var bidSize = [Number(curBid.w), Number(curBid.h)];

        /* the creative/adm for the given slot that will be rendered if is the winner.
         * Please make sure the URL is decoded and ready to be document.written.
         */
        var bidCreative = curBid.adm;

        /* the dealId if applicable for this slot. */

        var bidDealId = '';

        if (curBid.hasOwnProperty('dealid')){
            bidDealId = curBid.dealid;
        }

        /* explicitly pass */
        var bidIsPass = bidPrice <= 0 ? true : false;

        /* OPTIONAL: tracking pixel url to be fired AFTER rendering a winning creative.
        * If firing a tracking pixel is not required or the pixel url is part of the adm,
        * leave empty;
        */

        var pixels = '';

        if (adResponse.hasOwnProperty('ext')){
            pixels = adResponse.ext.pixels || '';
        }

        /* ---------------------------------------------------------------------------------------*/

        if (bidIsPass) {
            //? if (DEBUG) {
            Scribe.info(__profile.partnerId + ' returned pass for { id: ' + adResponse.id + ' }.');
            //? }
            if (__profile.enabledAnalytics.requestTime) {
                __baseClass._emitStatsEvent(sessionId, 'hs_slot_pass', headerStatsInfo);
            }
            curReturnParcel.pass = true;
            return;
        }

        if (__profile.enabledAnalytics.requestTime) {
            __baseClass._emitStatsEvent(sessionId, 'hs_slot_bid', headerStatsInfo);
        }

        curReturnParcel.size = bidSize;
        curReturnParcel.targetingType = 'slot';
        curReturnParcel.targeting = {};

        var targetingCpm = '';

        //? if (FEATURES.GPT_LINE_ITEMS) {
        targetingCpm = __baseClass._bidTransformers.targeting.apply(bidPrice);
        var sizeKey = Size.arrayToString(curReturnParcel.size);

        if (bidDealId) {
            curReturnParcel.targeting[__baseClass._configs.targetingKeys.pmid] = [sizeKey + '_' + bidDealId];
            curReturnParcel.targeting[__baseClass._configs.targetingKeys.pm] = [sizeKey + '_' + targetingCpm];
        } else {
            curReturnParcel.targeting[__baseClass._configs.targetingKeys.om] = [sizeKey + '_' + targetingCpm];
        }
        curReturnParcel.targeting[__baseClass._configs.targetingKeys.id] = [curReturnParcel.requestId];
        //? }

        //? if (FEATURES.RETURN_CREATIVE) {
        curReturnParcel.adm = bidCreative;
        if (pixels) {
            curReturnParcel.winNotice = __renderPixel.bind(null, pixels);
        }
        //? }

        //? if (FEATURES.RETURN_PRICE) {
        curReturnParcel.price = Number(__baseClass._bidTransformers.price.apply(bidPrice));
        //? }

        var pubKitAdId = RenderService.registerAd({
            sessionId: sessionId,
            partnerId: __profile.partnerId,
            adm: bidCreative,
            requestId: curReturnParcel.requestId,
            size: curReturnParcel.size,
            price: targetingCpm ? targetingCpm : undefined,
            dealId: bidDealId ? bidDealId : undefined,
            timeOfExpiry: __profile.features.demandExpiry.enabled ? (__profile.features.demandExpiry.value + System.now()) : 0,
            auxFn: __renderPixel,
            auxArgs: [pixels]
        });

        //? if (FEATURES.INTERNAL_RENDER) {
        curReturnParcel.targeting.pubKitAdId = pubKitAdId;
        //? }

    }

    /* =====================================
     * Constructors
     * ---------------------------------- */

    (function __constructor() {
        EventsService = SpaceCamp.services.EventsService;
        RenderService = SpaceCamp.services.RenderService;
        ComplianceService = SpaceCamp.services.ComplianceService;

        /* =============================================================================
         * STEP 1  | Partner Configuration
         * -----------------------------------------------------------------------------
         *
         * Please fill out the below partner profile according to the steps in the README doc.
         */

        /* ---------- Please fill out this partner profile according to your module ------------*/
        __profile = {
            partnerId: 'OathHtb', // PartnerName
            namespace: 'OathHtb', // Should be same as partnerName
            statsId: 'OATH', // Unique partner identifier
            version: '2.1.1',
            targetingType: 'slot',
            enabledAnalytics: {
                requestTime: true
            },
            features: {
                demandExpiry: {
                    enabled: false,
                    value: 0
                },
                rateLimiting: {
                    enabled: false,
                    value: 0
                }
            },
            targetingKeys: { // Targeting keys for demand, should follow format ix_{statsId}_id
                id: 'ix_oath_id',
                om: 'ix_oath_cpm',
                pm: 'ix_oath_cpm',
                pmid: 'ix_oath_dealid'
            },
            bidUnitInCents: 100, // The bid price unit (in cents) the endpoint returns, please refer to the readme for details
            lineItemType: Constants.LineItemTypes.ID_AND_SIZE,
            callbackType: Partner.CallbackTypes.NONE, // Callback type, please refer to the readme for details
            architecture: Partner.Architectures.MRA, // Request architecture, please refer to the readme for details
            requestType: Partner.RequestTypes.AJAX // Request type, jsonp, ajax, or any.
        };
        /* ---------------------------------------------------------------------------------------*/

        //? if (DEBUG) {
        var results = ConfigValidators.partnerBaseConfig(configs) || PartnerSpecificValidator(configs);

        if (results) {
            throw Whoopsie('INVALID_CONFIG', results);
        }
        //? }

        __baseClass = Partner(__profile, configs, null, {
            parseResponse: __parseResponse,
            generateRequestObj: __generateRequestObj,
            adResponseCallback: adResponseCallback
        });
    })();

    /* =====================================
     * Public Interface
     * ---------------------------------- */

    var derivedClass = {
        /* Class Information
         * ---------------------------------- */

        //? if (DEBUG) {
        __type__: 'OathHtb',
        //? }

        //? if (TEST) {
        __baseClass: __baseClass,
        //? }

        /* Data
         * ---------------------------------- */

        //? if (TEST) {
        profile: __profile,
        //? }

        /* Functions
         * ---------------------------------- */

        //? if (TEST) {
        parseResponse: __parseResponse,
        generateRequestObj: __generateRequestObj,
        adResponseCallback: adResponseCallback,
        //? }
    };

    return Classify.derive(__baseClass, derivedClass);
}

////////////////////////////////////////////////////////////////////////////////
// Exports /////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

module.exports = OathHtb;
