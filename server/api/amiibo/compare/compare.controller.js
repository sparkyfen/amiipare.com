'use strict';

var validator = require('validator');
var kue = require('kue');
var jobs = kue.createQueue();
var ebay = require('./ebay');
var Firebase = require('firebase');
var moment = require('moment');
var async = require('async');
var config = require('../../../config/environment');
var ref = new Firebase(config.firebase.url);
var amiiboData = require('../../../components/amiibo');

// Kicks off the Ebay workflow.
function _startJob() {
  var job = jobs.create('refresh', {}).save(function (error) {
    if(error) {
      console.log(error);
    }
    ebay.refreshSales();
  });
}

// Given all the listings, calculate the average sale price for each Amiibo
// in which that Amiibo was the only one in the listing. For instance,
// if a listing had Sonic and Megaman, we ignore it. However, if it just Sonic,
// or just Megaman, we use it in the calculation.
// Mario is a special case because no one (currently) is selling him by himself
// and we are getting hits for the term "Mario" with things like "Super Mario Series"
// and "Mario Party Series" when we don't want that.
function _calculateAllAverages(sales) {
  var averages = {
    mario: 12.99
  };
  sales = sales.filter(function (sale) {
    return sale.names.length === 1;
  });
  var amiibos = Object.keys(amiiboData);
  for (var i = 0; i < amiibos.length; i++) {
    var amiibo = amiibos[i];
    if(amiibo === 'mario') {
      continue;
    }
    averages[amiibo] = 0.0;
    var saleCount = 0;
    for (var j = 0; j < sales.length; j++) {
      var sale = sales[j];
      if(sale.names[0] === amiibo) {
        saleCount++;
        averages[amiibo] += sale.total
      }
    }
    if(saleCount > 0) {
      averages[amiibo] /= saleCount;
    }
  }
  return averages;
}

// Get the sum of all the sales of instances in which the Amiibo is seen.
function _getSum(sales, query, allSingleAverages) {
  var sum = 0.0;
  for (var i = 0; i < sales.length; i++) {
    var sale = sales[i];
    // Find the Amiibo in the list of Amiibo that were sold in this listing.
    var index = sale.names.indexOf(query);
    // Return an array of average values for these Amiibo.
    var nameAverages = sale.names.map(function (name) {
      // Somehow a name was not fixed in the Ebay workflow
      // and slipped through the RegExp and "if" checks.
      if(allSingleAverages[name] === undefined) {
        console.log('Name not fixed: ');
        console.log(sale);
        return 0.0;
      }
      return allSingleAverages[name];
    });
    // Get the sum of these average values.
    var denom = nameAverages.reduce(function (a, b) {
      return a + b;
    });
    // Divide with the average value of the Amiibo we are looking at.
    var numer = nameAverages[index];
    // We don't want to divide by zero.
    if(numer === 0 || denom === 0) {
      return sum += 0;
    } else {
      var actualPrice = parseFloat(((numer / denom) * sale.total), 10);
      sum += actualPrice;
    }
  };
  return sum;
}



// Compare two Amiibo
exports.index = function(req, res) {
  var first = req.query.first;
  var second = req.query.second;
  // Validate input.
  if(validator.isNull(first)) {
    return res.status(400).jsonp({message: 'Missing first Amiibo to compare.'});
  }
  if(validator.isNull(second)) {
    return res.status(400).jsonp({message: 'Missing second Amiibo to compare.'});
  }
  if(!validator.isAmiibo(first)) {
    return res.status(400).jsonp({message: 'Invalid first Amiibo.'});
  }
  if(!validator.isAmiibo(second)) {
    return res.status(400).jsonp({message: 'Invalid second Amiibo.'});
  }
  var lastUpdated = moment.utc().valueOf();
  // Get the last time we updated the data and set the value into the database.
  ref.child('lastUpdated').once('value', function (lastUpdatedResp) {
    if(lastUpdatedResp.val()) {
      lastUpdated = lastUpdatedResp.val();
    } else {
      ref.child('lastUpdated').set(lastUpdated.valueOf());
    }
    // Get all the ebay sales we've seen in the past.
    ref.child('sales').once('value', function (response) {
      if(!response.val()) {
        // We don't have any sales, kick off the Ebay API workflow.
        _startJob();
        return res.status(400).jsonp({message: 'Nothing to compare right now, try again later.'});
      } else {
        var sales = response.val();
        // Get sales in which the first Amiibo is seen.
        var firstSales = sales.filter(function (sale) {
          return (sale.names && sale.names.indexOf(first) !== -1);
        });
        // Get sales in which the second Amiibo is seen.
        var secondSales = sales.filter(function (sale) {
          return (sale.names && sale.names.indexOf(second) !== -1);
        });
        // Calculate the average for all Amiibo in single sales.
        // This means if a sale only sold that particular Amiibo, we use that sold cost to determine
        // average cost of that one Amiibo. This will help us decide which how much weight to give each Amiibo
        // in sales that are more than 1 Amiibo.
        var allSingleAverages = _calculateAllAverages(sales);
        // Get the sum of all the sales of instances in which the first Amiibo is seen.
        var firstSum = _getSum(firstSales, first, allSingleAverages);
        // Get the sum of all the sales of instances in which the second Amiibo is seen.
        var secondSum = _getSum(secondSales, second, allSingleAverages);
        var firstAverage = 0.0;
        var secondAverage = 0.0;
        // Calculate averages for the first and second Amiibo.
        if(firstSales.length !== 0) {
          firstAverage = parseFloat((firstSum / firstSales.length), 10);
        }
        if(secondSales.length !== 0) {
          secondAverage = parseFloat((secondSum / secondSales.length), 10);
        }
        // Update the average values in the database.
        ref.child('average').child(first).set(firstAverage, function (error) {
          if(error) {
            console.log(error);
            return res.status(500).jsonp({message: 'Could not compare Amiibo.'});
          }
          ref.child('average').child(second).set(secondAverage, function (error) {
            if(error) {
              console.log(error);
              return res.status(500).jsonp({message: 'Could not compare Amiibo.'});
            }
            // Respond to the client with the averages.
            var result = {};
            result[first] = {
              ebay: {
                averageCost: firstAverage
              }
            };
            result[second] = {
              ebay: {
                averageCost: secondAverage
              }
            };
            var now = moment.utc();
            // If the last time we updated is more than half a minute,
            // kick off the Ebay workflow to get more data.
            // This is chosen because we got 5000 API calls per day / 10 calls for 10 pages.
            // So 500 hits, we divide the number of calls per minute and round down to play it safe.
            // We don't care when the Ebay workflow is kicked off so we just return the client's data instead of I/O blocking.
            if(now.diff(moment.utc(lastUpdated)) > 30000) {
              ref.child('lastUpdated').set(now.valueOf(), function (error) {
                if(error) {
                  console.log('This is updated the last update value and it failed. We responded with data anyways.');
                  console.log(error);
                }
                _startJob();
              });
            }
            return res.jsonp(result);
          });
        });
      }
    });
  });
};

// Checks to see if the input is a name of an Amiibo.
// The names should be camelcased with no spaces.
validator.extend('isAmiibo', function (str) {
  var amiibos = Object.keys(amiiboData);
  if(typeof(str) !== 'string') {
    return false;
  }
  if(amiibos.indexOf(str) !== -1) {
    return true;
  }
  return false;
});