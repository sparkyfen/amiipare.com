'use strict';

var Firebase = require('firebase');
var async = require('async');
var qs = require('querystring');
var request = require('request');
var config = require('../config/environment');
var ref = new Firebase(config.firebase.url);
var MASHAPE_API_KEY = config.mashape.apiKey;

function _callConversion(obj, callback) {
  var price = obj.price;
  var currency = obj.currency;
  var converted = obj.converted;
  if(converted) {
    return callback(null, converted);
  }
   if(currency === 'USD') {
    return callback(null, price);
  }
  var query = {
    from: currency,
    from_amount: price,
    to: 'USD'
  };
  request('https://currencyconverter.p.mashape.com/?' + qs.stringify(query), {
    headers: {
      'X-Mashape-Key': MASHAPE_API_KEY,
      'Accept': 'application/json'
    },
    json: true
  }, function (error, response, body) {
    if(error) {
      return callback(error);
    }
    if(response.statusCode !== 200) {
      return callback(body);
    }
    return callback(null, body['to_amount']);
  });
}

ref.child('sales').once('value', function (salesResp) {
  if(!salesResp.val()) {
    throw new Error('Nothing to update.');
  }
  var sales = salesResp.val();
  sales = sales.filter(function (sale) {
    return sale !== undefined;
  });
  async.eachSeries(sales, function (sale, cb) {
    if(!sale.shipping) {
      sale.shipping = {
        price: 0.0,
        currency: 'USD'
      };
    }
    if(!sale.shipping.currency) {
      sale.shipping.currency = 'USD';
    }
    if(!sale.shipping.price) {
      sale.shipping.price = 0.0;
    }
    if(!sale.price) {
      sale.price = {
        price: 0.0,
        currency: 'USD'
      };
    }
    if(!sale.price.currency) {
      sale.price.currency = 'USD';
    }
    if(!sale.price.price) {
      sale.price.price = 0.0;
    }
    _callConversion(sale.shipping, function (error, shippingConverted) {
      if(error) {
        return cb(error);
      }
      sale.shipping.converted = shippingConverted;
      _callConversion(sale.price, function (error, priceConverted) {
        if(error) {
          return cb(error);
        }
        sale.price.converted = priceConverted;
        return cb(null);
      });
    });
  }, function (error) {
    ref.child('sales').set(sales, function (error) {
      if(error) {
        return console.log(error);
      }
      console.log('Done, Ctrl + C to break.');
    });
  });
});