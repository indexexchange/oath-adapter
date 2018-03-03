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

describe('generateRequestObj', function () {

    /* Setup and Library Stub
     * ------------------------------------------------------------- */
    var inspector = require('schema-inspector');
    var proxyquire = require('proxyquire').noCallThru();
    var libraryStubData = require('./support/libraryStubData.js');
    var partnerModule = proxyquire('../oath-htb.js', libraryStubData);
    var partnerConfig = require('./support/mockPartnerConfig.json');
    var oneDisplayConfigs = require('./support/mockPartnerConfig.json').oneDisplay;
    var oneMobileConfigs = require('./support/mockPartnerConfig.json').oneMobile;
    var combinedConfigs = require('./support/mockPartnerConfig.json').combined;
    var expect = require('chai').expect;
    /* -------------------------------------------------------------------- */

    var partnerInstance = partnerModule(partnerConfig);
    var partnerProfile = partnerInstance.profile;

    var requestObject;
    var returnParcels;
       /**
    * Helper function used to apply assertion functions to each parcel object. 
    * 
    * @param {object} Partner configuration.
    * @param {function} assertion function.
    */
    function assertRequestsForPartnerConfig(partnerConfig, assert) {
        /* Instantiate your partner module */
        partnerInstance = partnerModule(partnerConfig);
        partnerProfile = partnerInstance.profile;

        /* Generate a request object using generated mock return parcels. */
        returnParcels = generateReturnParcels(partnerProfile, partnerConfig);

        returnParcels.forEach((item) => {
            requestObject = partnerInstance.generateRequestObj([item]);
            if (assert) {
                assert(requestObject, item);
            }
        });
    }

    /**
    * Validates request object format. 
    * 
    * @param {object} Partner rquest object.
    * @return {object} Validation result object.
    */
    function validateRequestObject(requestObject) {
        return inspector.validate({
            type: 'object',
            strict: true,
            properties: {
                url: {
                    type: 'string',
                    minLength: 1
                },
                callbackId: {
                    type: 'string',
                    minLength: 1
                }
            }
        }, requestObject);
    }

    /* Test that the generateRequestObj function creates the correct object by building a URL
     * from the results. This is the bid request url that wrapper will send out to get demand
     * for your module.
     *
     * The url should contain all the necessary parameters for all of the request parcels
     * passed into the function.
     */
    describe('oneDisplay endpoint',  () => {
        it('should return a correctly formated objects', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, (requestObject) => {
                var result = validateRequestObject(requestObject);

                expect(result.valid).to.be.true;
            })
        });

        it('should correctly set NA url', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, ({url}) => {
                expect(url.match('adserver-us.adtech.advertising.com', 'url is incorrect').length).to.equal(1);
            });
        });

        it('should correctly set EU url', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.eu, ({url}) => {
                expect(url.match('adserver-eu.adtech.advertising.com', 'url is incorrect').length).to.equal(1);
            });
        });

        it('should correctly set ASIA url', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.asia, ({url}) => {
                expect(url.match('adserver-as.adtech.advertising.com').length, 'url is incorrect').to.equal(1);
            });
        });

        it('should correctly set CMD request paramater', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, ({url}) => {
                var match = url.match(/;cmd=(.*?);/);
                expect(match[1], 'cmd is incorrect or not present').to.equal('bid');
            });
        });

        it('should correctly set CORS request paramater', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, ({url}) => {
                var match = url.match(/;cors=(.*?);/);
                expect(match[1], 'CORS is incorrect or not present').to.equal('yes');
            });
        });

        it('should correctly set V request paramater', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, ({url}) => {
                var match = url.match(/;v=(.*?);/);
                expect(match[1], "V is incorrect or not present").to.equal('2');
            });
        });

        it('should correctly set MISC request paramater', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, ({url}) => {
                var match = url.match(/;misc=(.*?);/);
                expect(match[1], 'V is incorrect or not present').to.be.not.null;
            });
        });

        it('should correctly set networkId', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, ({url}) => {
                expect(url.match('9959.1').length, "networkId is incorrect").to.equal(1);
            });
            assertRequestsForPartnerConfig(oneDisplayConfigs.eu, ({url}) => {
                expect(url.match('9159.1').length, "networkId is incorrect").to.equal(1);
            });
            assertRequestsForPartnerConfig(oneDisplayConfigs.asia, ({url}) => {
                expect(url.match('9259.1').length, "networkId is incorrect").to.equal(1);
            });
        });

        it('should correctly set placementId request parameter for each request/slot', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, ({url}, requestStub) => {
                expect(url.match(requestStub.xSlotRef.placementId).length, "placementId is incorrect").to.equal(1);
            });
        });

        it('should set partner statsId correctly', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na);

            expect(partnerProfile.statsId).to.equal('OATH');
        });
    });

    describe('oneMobile endpoint', () => {
        it('should return a correctly formated objects', function () {
            assertRequestsForPartnerConfig(oneDisplayConfigs.na, (requestObject) => {
                var result = validateRequestObject(requestObject);

                expect(result.valid).to.be.true;
            })
        });

        it('should correctly set endpoint url', function () {
            assertRequestsForPartnerConfig(oneMobileConfigs.get, ({url}) => {
                expect(url.match('hb.nexage.com', 'url is incorrect').length).to.equal(1);
            });
        });

        it('should correctly set CMD request paramater', function () {
            assertRequestsForPartnerConfig(oneMobileConfigs.get, ({url}) => {
                var match = url.match(/cmd=(.*?)(&|$)/);
                expect(match[1], 'cmd is incorrect or not present').to.equal('bid');
            });
        });

        it('should correctly set dcn request paramater', function () {
            assertRequestsForPartnerConfig(oneMobileConfigs.get, ({url}, requestStub) => {
                var match = url.match(/&dcn=(.*?)(&|$)/);
                expect(match[1], 'dcn is incorrect or not present').to.equal(requestStub.xSlotRef.dcn);
            });
        });

        it('should correctly set pos request paramater', function () {
            assertRequestsForPartnerConfig(oneMobileConfigs.get, ({url}, requestStub) => {
                var match = url.match(/&pos=(.*?)(&|$)/);
                expect(match[1], 'pos is incorrect or not present').to.equal(requestStub.xSlotRef.pos);
            });
        });

        it('should set partner statsId correctly for', function () {
            assertRequestsForPartnerConfig(oneMobileConfigs.get);

            expect(partnerProfile.statsId).to.equal('OATHM');
        });
    });

    describe('combined slots configuration ', () => {
        it('should resolve endpoints correctly for different slots', function () {
            assertRequestsForPartnerConfig(combinedConfigs, ({url}, {htSlot}) => {
                if (htSlot.getId() === 'mobile') {
                    expect(url.match('hb.nexage.com', 'url is incorrect').length).to.equal(1);
                } else {
                    expect(url.match('adserver-us.adtech.advertising.com', 'url is incorrect').length).to.equal(1);
                }

            })
        });
    });
});