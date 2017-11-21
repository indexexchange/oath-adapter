/**
 * @author:    Index Exchange
 * @license:   UNLICENSED
 *
 * @copyright: Copyright (C) 2017 by Index Exchange. All rights reserved.
 *
 * The information contained within this document is confidential, copyrighted
 *  and or a trade secret. No part of this document may be reproduced or
 * distributed in any form or by any means, in whole or in part, without the
 * prior written permission of Index Exchange.
 */
// jshint ignore: start

'use strict';

/* =====================================
 * Utilities
 * ---------------------------------- */

/**
 * Returns an array of parcels based on all of the xSlot/htSlot combinations defined
 * in the partnerConfig (simulates a session in which all of them were requested).
 *
 * @param {object} profile
 * @param {object} partnerConfig
 * @returns []
 */
function generateReturnParcels(profile, partnerConfig) {
    var returnParcels = [];

    for (var htSlotName in partnerConfig.mapping) {
        if (partnerConfig.mapping.hasOwnProperty(htSlotName)) {
            var xSlotsArray = partnerConfig.mapping[htSlotName];
            var htSlot = {
                id: htSlotName,
                getId: function () {
                    return this.id;
                }
            }
            for (var i = 0; i < xSlotsArray.length; i++) {
                var xSlotName = xSlotsArray[i];
                returnParcels.push({
                    partnerId: profile.partnerId,
                    htSlot: htSlot,
                    ref: "",
                    xSlotRef: partnerConfig.xSlots[xSlotName],
                    requestId: '_' + Date.now()
                });
            }
        }
    }

    return returnParcels;
}

/* =====================================
 * Testing
 * ---------------------------------- */

describe('parseResponse', function () {

    /* Setup and Library Stub
     * ------------------------------------------------------------- */
    var inspector = require('schema-inspector');
    var proxyquire = require('proxyquire').noCallThru();
    var libraryStubData = require('./support/libraryStubData.js');
    var partnerModule = proxyquire('../oath-htb.js', libraryStubData);
    var oneDisplayConfigs = require('./support/mockPartnerConfig.json').oneDisplay;
    var responseData = require('./support/mockResponseData.json');
    var expect = require('chai').expect;
    /* -------------------------------------------------------------------- */

    /* Instatiate your partner module */
    var partnerModule = partnerModule(oneDisplayConfigs);
    var partnerProfile = partnerModule.profile;
    var result, expectedValue, mockData, returnParcels;

    describe('should correctly parse bids:', function () {

        /* Simple type checking on the returned objects */
        it('each parcel should have the required fields set', function () {
            returnParcels = generateReturnParcels(partnerModule.profile, oneDisplayConfigs.na);

            /* Get mock response data from our responseData file */
            mockData = responseData.bid;

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            for (var i = 0; i < returnParcels.length; i++) {

                /* IF MRA, parse one parcel at a time */
                if (!partnerProfile.architecture) partnerModule.parseResponse(1, mockData[i], [returnParcels[i]]);

                /* Validate the returnParcel objects after they've been parsed */
                result = inspector.validate({
                    type: 'object',
                    properties: {
                        targetingType: {
                            type: 'string',
                            eq: 'slot',
                            error: 'targetingType field must be set to "slot".'
                        },
                        targeting: {
                            type: 'object',
                            properties: {
                                [partnerModule.profile.targetingKeys.id]: {
                                    type: 'array',
                                    exactLength: 1,
                                    items: {
                                        type: 'string',
                                        minLength: 1
                                    },
                                    error: 'id targetingKey field must be correctly set.'
                                },
                                [partnerModule.profile.targetingKeys.om]: {
                                    type: 'array',
                                    exactLength: 1,
                                    exec: function (schema, post) {
                                        var expectedValue = mockData[i].seatbid[0].bid[0].w + 'x' +
                                            mockData[i].seatbid[0].bid[0].h + '_' +
                                            mockData[i].seatbid[0].bid[0].price;

                                        if (post[0] !== expectedValue) {
                                            this.report('om targetingKey value: ' + post[0] + ' is incorrect!');
                                        }
                                    }
                                },
                                pubKitAdId: {
                                    type: 'string',
                                    minLength: 1,
                                    error: 'pubKitAdId targetingKey field must be correctly set.'
                                }
                            }
                        },
                        price: {
                            type: 'number',
                            eq: Number(mockData[i].seatbid[0].bid[0].price),
                            error: 'price field must be correctly set.'
                        },
                        size: {
                            type: 'array',
                            exactLength: 2,
                            exec: function (shema, post) {
                                var expectedValue = [mockData[i].seatbid[0].bid[0].w, mockData[i].seatbid[0].bid[0].h];
                                if (post[0] !== expectedValue[0] || post[1] !== expectedValue[1]) {
                                    this.report('the size value: ' + post + ' is incorrect!');
                                }
                            }
                        },
                        adm: {
                            type: 'string',
                            minLength: 1,
                            eq: mockData[i].seatbid[0].bid[0].adm,
                            error: 'adm field must be correctly set.'
                        }
                    }
                }, returnParcels[i]);

                expect(result.valid, result.format()).to.be.true;
            }
        });
    });

    describe('should correctly parse passes: ', function () {

        it('each parcel should have the required fields set', function () {
            returnParcels = generateReturnParcels(partnerModule.profile, oneDisplayConfigs.na);

            /* Get mock response data from our responseData file */
            mockData = responseData.pass;

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            for (var i = 0; i < returnParcels.length; i++) {

                /* IF MRA, parse one parcel at a time */
                if (!partnerProfile.architecture) partnerModule.parseResponse(1, mockData[i], [returnParcels[i]]);

                /* Validate the returnParcel objects after they've been parsed */
                result = inspector.validate({
                    type: 'object',
                    properties: {
                        pass: {
                            type: 'boolean',
                            eq: true,
                            error: 'pass field must be correctly set.'
                        }
                    }
                }, returnParcels[i]);

                expect(result.valid, result.format()).to.be.true;
            }
        });
    });

    describe('should correctly parse deals: ', function () {

        /* Simple type checking on the returned objects, should always pass */
        it('each parcel should have the required fields set', function () {
            returnParcels = generateReturnParcels(partnerModule.profile, oneDisplayConfigs.na);

            /* Get mock response data from our responseData file */
            mockData = responseData.deals;

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            for (var i = 0; i < returnParcels.length; i++) {

                /* IF MRA, parse one parcel at a time */
                if (!partnerProfile.architecture) partnerModule.parseResponse(1, mockData[i], [returnParcels[i]]);

                /* Validate the returnParcel objects after they've been parsed */
                result = inspector.validate({
                    type: 'object',
                    properties: {
                        targetingType: {
                            type: 'string',
                            eq: 'slot',
                            error: 'targetingType field must be set to "slot".'
                        },
                        targeting: {
                            type: 'object',
                            properties: {
                                [partnerModule.profile.targetingKeys.id]: {
                                    type: 'array',
                                    exactLength: 1,
                                    items: {
                                        type: 'string',
                                        minLength: 1
                                    },
                                    error: 'id targetingKey field must be correctly set.'
                                },
                                [partnerModule.profile.targetingKeys.pm]: {
                                    type: 'array',
                                    exactLength: 1,
                                    exec: function (schema, post) {
                                        var expectedValue = mockData[i].seatbid[0].bid[0].w + 'x' +
                                            mockData[i].seatbid[0].bid[0].h + '_' +
                                            mockData[i].seatbid[0].bid[0].dealid;

                                        if (post[0] !== expectedValue) {
                                            this.report('om targetingKey value: ' + post[0] + ' is incorrect! Expected: ' + expectedValue);
                                        }
                                    }
                                },
                                [partnerModule.profile.targetingKeys.om]: {
                                    type: 'array',
                                    exactLength: 1,
                                    exec: function (schema, post) {
                                        var expectedValue = mockData[i].seatbid[0].bid[0].w + 'x' +
                                            mockData[i].seatbid[0].bid[0].h + '_' +
                                            mockData[i].seatbid[0].bid[0].price;

                                        if (post[0] !== expectedValue) {
                                            this.report('om targetingKey value: ' + post[0] + ' is incorrect!');
                                        }
                                    }
                                },
                                pubKitAdId: {
                                    type: 'string',
                                    minLength: 1,
                                    error: 'pubKitAdId targetingKey field must be correctly set.'
                                }
                            }
                        },
                        price: {
                            type: 'number',
                            eq: Number(mockData[i].seatbid[0].bid[0].price),
                            error: 'price field must be correctly set.'
                        },
                        size: {
                            type: 'array',
                            exactLength: 2,
                            exec: function (shema, post) {
                                var expectedValue = [mockData[i].seatbid[0].bid[0].w, mockData[i].seatbid[0].bid[0].h];
                                if (post[0] !== expectedValue[0] || post[1] !== expectedValue[1]) {
                                    this.report('the size value: ' + post + ' is incorrect!');
                                }
                            }
                        },
                        adm: {
                            type: 'string',
                            minLength: 1,
                            eq: mockData[i].seatbid[0].bid[0].adm,
                            error: 'adm field must be correctly set.'
                        }
                    }
                }, returnParcels[i]);

                expect(result.valid, result.format()).to.be.true;
            }
        });
    });
});