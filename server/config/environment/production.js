'use strict';

// Production specific configuration
// =================================
module.exports = {
  // Server IP
  ip: process.env.OPENSHIFT_NODEJS_IP || process.env.IP || undefined,
  // Server port
  port: process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080,
  firebase: {
    url: process.env.AMIIPARE_FIREBASE_URL || ''
  },
  ebay: {
    url: process.env.AMIIPARE_EBAY_URL || 'https://svcs.ebay.com/services/search/FindingService/v1',
    appName: process.env.AMIIPARE_EBAY_APPNAME || ''
  },
  mashape: {
    apiKey: process.env.AMIIPARE_MASHAPE_APIKEY || ''
  }
};