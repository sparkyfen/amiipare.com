'use strict';

var _ = require('lodash');
var request = require('request');
var async = require('async');
var Firebase = require('firebase');
var config = require('../../../config/environment');
var ref = new Firebase(config.firebase.url);
var qs = require('querystring');
var kue = require('kue');
var jobs = kue.createQueue();
var BASE_URL = config.ebay.url;
var MASHAPE_API_KEY = config.mashape.apiKey;

var CATEGORY_IDS = {
  videoGamesAndConsoles: 1249,
  videoGameAccessories: 54968,
  videoGameMerchandise: 38583,
  videoGames: 139973
};
var pages = [1,2,3,4,5,6,7,8,9,10];

/**
 * Takes a Ebay listing title and converts it into a "const" Amiibo name
 * we can use across the site.
 *
 * @param  {String}   title The Ebay listing title
 * @param  {Function} callback The function callback
 * @return {Function} The function callback
 */
function _parseAmiiboNames(title, callback) {
  title = title.toLowerCase();
  var amiiboRegexp = new RegExp(/([M|m]ario(s)?|[P|p]each(s)?|[Y|y]oshi(s)?|[D|d]onkey(?:\s)?[K|k]ong(s)?|[L|l]ink(s)?|[F|f]ox(?:es|s)?|[S|s]amus(?:es|s)?|(?:[W|w]ii(?:\s)?[F|f]it(?:\s)?)?[T|t]rainer(s)?|[V|v]illager(s)?|[P|p]ikachu(s)?|[K|k]irb(?:y|ies|s)|[M|m]arth(es|s)?|[D|d]iddy(?:\s)?[K|k]ong(es|s)?|[Z|z]elda(es|s)?|[L|l]uigi(es|s)?|[L|l]ittle(?:\s)?[M|m]ac(s)?|[C|c]aptain(?:\s)?[F|f]alcon(s)?|[P|p]it(es|s)?|[R|r]osalina(es|s)?|[R|r]osetta(es|s)?|[B|b]owser(es|s)?|[K|k]oopa(es|s)?|[L|l]ucario(s)?|[T|t]oon(?:\s)?[L|l]ink(s)?|[S|s]h(?:ei|ie)k(s)?|(?:[K|k]ing\s)?(?:[D|d]edede(s)?|[D|d]ee(?:\s)?[D|d]ee)|[D|d]3(s)?|[K|k]3[D|d](s)?|[I|i]ke(s)?|[S|s]hulk(s)?|[S|s]onic(s)?|[M|m]ega(?:\s)?[M|m][a|e]n|[M|m]eta(?:\s)?(?:[K|k])?night(s)?|[R|r]obin(s)?|[L|l]ucina(s)?|[C|c]harizard(s)?|[P|p]ac((?:\s)?|(-)?)[M|m]an(s)?|[W|w]ario(s)?|[N|n]ess(es)?)/g);
  if(title.match(amiiboRegexp)) {
    var total = [];
    var results;
    while(results = amiiboRegexp.exec(title)) {
      results = results.filter(function (result) {
        return result !== undefined;
      });
      var name = camelize(results[1]);
      name = _fixName(name);
      if(total.indexOf(name) === -1) {
        total.push(name);
      }
    }
    return callback(null, total);
  } else {
    return callback(null);
  }
}

/**
 * Camelcase an input string.
 *
 * @param  {String} str The input string.
 * @return {String} The new camelCase string.
 */
function camelize(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
    if (+match === 0) return ""; // or if (/\s+/.test(match)) for white spaces
    return index == 0 ? match.toLowerCase() : match.toUpperCase();
  });
}

/**
 * Attempts to fix any names that the Regexp catches but
 * does not conform to the camelCase "const" we are using.
 * @param  {String} name The name of the Amiibo "unfixed".
 * @return {String} The "fixed" Amiibo name.
 */
function _fixName(name) {
  if(name === 'shiek') {
    return 'sheik';
  }
  if(name === 'metaknight') {
    return 'metaKnight';
  }
  if(name === 'trainer') {
    return 'wiiFitTrainer';
  }
  if(name === 'megaman' || name === 'rockman') {
    return 'megaMan';
  }
  if(name === 'littlemac') {
    return 'littleMac';
  }
  if(name === 'diddykong') {
    return 'diddyKong';
  }
  if(name === 'donkeykong') {
    return 'donkeyKong';
  }
  if(name === 'captainfalcon') {
    return 'captainFalcon';
  }
  if(name === 'd3' || name === 'kingdedede' || name === 'dedede' || name === 'deedee') {
    return 'kingDedede';
  }
  if(name === 'koopa') {
    return 'bowser';
  }
  if(name === 'rosetta') {
    return 'rosalina';
  }
  if(name === 'pacman' || name === 'pac-Man' || name === 'pac-man') {
    return 'pacMan';
  }
  return name;
}

/**
 * Convert currency using Mashape API if the currency is not in USD already.
 *
 * @param  {String}   price The current price
 * @param  {String}   currency The 3 character currency code.
 * @param  {Function} callback The callback function
 * @return {Function} The callback function.
 */
function _callConversion(price, currency, callback) {
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

/**
 * Converts the currency give a sale object.
 *
 * @param  {Object}   sale The Ebay listing.
 * @param  {Function} callback The callback function
 * @return {Function} The callback function
 */
function _convertCurrency(sale, callback) {
  // Some values from Ebay are either missing altogether so we gotta deal with this.
  if(!sale.price) {
    sale.price = {
      price: 0.0,
      currency: 'USD'
    };
  }
  if(!sale.shipping) {
    sale.shipping = {
      price: 0.0,
      currency: 'USD'
    };
  }
  // We have already converted this entry to just return it.
  if(sale.price.converted) {
    return callback(null, {price: sale.price.converted, shipping: sale.shipping.converted});
  }
  // Call Mashape to convert the price.
  _callConversion(sale.price.price, sale.price.currency, function (error, convertedPrice) {
    if(error) {
      return callback(error);
    }
    // Call Mashape to convert the shipping.
    _callConversion(sale.shipping.price, sale.shipping.currency, function (error, convertedShipping) {
      if(error) {
        return callback(error);
      }
      return callback(null, {price: convertedPrice, shipping: convertedShipping});
    });
  });
}

/**
 * Calculate the total price of the listing by adding the shipping and price together.
 * @param  {Object}   sale The Ebay listing.
 * @param  {Function} callback The callback function.
 * @return {Function} The callback function.
 */
function _calculateTotalPrice(sale, callback) {
  // Parse float all the things and never look back! :3
  var shipping = (sale.shipping && sale.shipping.currency === 'USD') ? (parseFloat(sale.shipping.converted, 10) || 0.0) : 0.0;
  var price = (sale.price && sale.price.currency === 'USD') ? (parseFloat(sale.price.converted, 10) || 0.0) : 0.0;
  return callback(null, parseFloat(shipping + price, 10));
}

// The Ebay workflow.
exports.refreshSales = function() {
  // Pull the job from the queue.
  jobs.process('refresh', function (job, done) {
    // Set a progress of 1% but we won't be updating it because
    // we did not make an endpoint to check its progress.
    job.progress(1, 100);
    var newResults = [];
    var newResultIds = [];
    // Ebay GET params.
    var query = {
      'categoryId(0)': CATEGORY_IDS['videoGamesAndConsoles'],
      'categoryId(1)': CATEGORY_IDS['videoGameAccessories'],
      'categoryId(2)': CATEGORY_IDS['videoGameMerchandise'],
      'outputSelector(0)': 'SellerInfo',
      'keywords(0)': 'amiibo',
      'paginationInput.entriesPerPage': 100,
      'location': 'North America',
      'OPERATION-NAME': 'findCompletedItems',
      'GLOBAL-ID': 'EBAY-US',
      'REST-PAYLOAD': null,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'SECURITY-APPNAME': config.ebay.appName,
      'SERVICE-VERSION': '1.11.0'
    };
    // Since we are doing paginated requests, we stagger them.
    async.eachLimit(pages, 4, function (page, cb) {
      query['paginationInput.pageNumber'] = page;

      var getParams = qs.stringify(query);

      // Query with json = true for JSON response parsing.
      request(BASE_URL + '?' + getParams, {
        json: true
      }, function (error, response, body) {
        if(error) {
          console.log(error);
          return cb('Could not compare Amiibo.');
        }
        if(response.statusCode !== 200) {
          console.log(body);
          return cb('Could not compare Amiibo.');
        }
        // Ebay returns some errors with 200's :(
        if(body['findCompletedItemsResponse'][0]['errorMessage']) {
          console.log(body['findCompletedItemsResponse'][0]['errorMessage'][0]['error'][0]);
          return cb('Could not compare Amiibo.');
        }
        var results = body['findCompletedItemsResponse'][0]['searchResult'][0]['item'];

        async.each(results, function (result, callback) {
          // Check if the listing actually had a sale because
          // those are the ones we care about.
          if(result.sellingStatus[0].sellingState[0] === 'EndedWithoutSales') {
            return callback(null);
          }
          // Check for titles to ignore.
          // These are things like "Nintendo 3DS XL plus Link Amiibo!" where the cost
          // on the listing actually cooralates to the console and not the Amiibo.
          var ignoreRegExp = new RegExp(/custom|(three|3)(\s)?ds|(re)?(-)?paint(ed)?|[S|s]uper(\s)?[M|m]ario|[M|m]ario(\s)?[P|p]arty|[L|l]egend(\s)?[O|o]f(\s)?[Z|z]elda/g);
          if(result.title[0].toLowerCase().match(ignoreRegExp)) {
            return callback(null);
          }
          // Parse Ebay response into new object. (Sale object)
          var newResult = {
            id: result.itemId[0],
            title: result.title[0],
            postalCode: result.postalCode ? result.postalCode[0] : null,
            location: result.location[0],
            country: result.country[0],
            shipping: {
              price: result.shippingInfo[0].shippingServiceCost ? result.shippingInfo[0].shippingServiceCost[0].__value__ : 0.0,
              currency: result.shippingInfo[0].shippingServiceCost ? result.shippingInfo[0].shippingServiceCost[0]['@currencyId'] : 'USD'
            },
            price: {
              price: result.sellingStatus[0].currentPrice[0].__value__,
              currency: result.sellingStatus[0].currentPrice[0]['@currencyId']
            }
          };
          // Get the Amiibo name(s) from the title of the listing.
          _parseAmiiboNames(newResult.title, function (error, amiiboNames) {
            if(error) {
              return callback(error);
            }
            if(amiiboNames) {
              newResult.names = amiiboNames;
            }
            // Convert any currency for shipping or price.
            _convertCurrency(newResult, function (error, converted) {
              if(error) {
                return callback(error);
              }
              newResult.price.converted = converted.price;
              newResult.shipping.converted = converted.shipping;
              // Get the total price of the listing.
              _calculateTotalPrice(newResult, function (error, total) {
                if(error) {
                  return callback(error);
                }
                newResult.total = total;
                // If Ebay responds with the name ids different pages,
                // we don't want redundant data.
                if(newResultIds.indexOf(newResult.id) === -1 && amiiboNames) {
                  newResults.push(newResult);
                  newResultIds.push(newResult.id);
                }
                return callback(null);
              });
            });
          });
        }, function (error) {
          if(error) {
            return cb(error);
          }
          return cb(null);
        });
      });
    }, function (error) {
      if(error) {
        console.log(error);
      }
      // Check to see if we have any sales from a previous request.
      ref.child('sales').once('value', function (resp) {
        if(!resp.val()) {
          // We don't have any sales, just store the data.
          ref.child('sales').set(newResults, function (error) {
            if(error) {
              return done(error);
            }
            return done(null);
          });
        } else {
          // We have sales, we need to get a new list which
          // contains the old sales plus only the new ones.
          var diffResults = [];
          var oldResults = resp.val();
          var oldResultIds = oldResults.map(function (sale) {
            return sale.id;
          });
          var diffResultIds = _.difference(newResultIds, oldResultIds);
          for (var i = 0; i < newResults.length; i++) {
            var newResult = newResults[i];
            if(diffResultIds.indexOf(newResult.id) !== -1) {
              diffResults.push(newResult);
            }
          }
          var newerResults = oldResults.concat(diffResults);
          // Set new values.
          ref.child('sales').set(newerResults, function (error) {
            if(error) {
              return done(error);
            }
            return done(null);
          });
        }
      });
    });
  });
};