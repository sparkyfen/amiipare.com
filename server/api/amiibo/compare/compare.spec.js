'use strict';

var should = require('should');
var request = require('supertest');
var app = require('../../../app');

describe('GET /api/amiibo/compare', function() {

  // TODO Write an 200 OK test when we can mock Firebase and mock calls to Ebay.

  it('should fail to compare an invalid Amiibo', function(done) {
    request(app)
      .get('/api/amiibo/compare?first=foo&second=marth')
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        res.body.should.be.instanceof(Object);
        res.body.should.have.property('message');
        done();
      });
  });

  it('should fail to compare another invalid Amiibo', function(done) {
    request(app)
      .get('/api/amiibo/compare?first=marth&second=foo')
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        res.body.should.be.instanceof(Object);
        res.body.should.have.property('message');
        done();
      });
  });

  it('should fail to compare both invalid Amiibo', function(done) {
    request(app)
      .get('/api/amiibo/compare?first=foo&second=bar')
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        res.body.should.be.instanceof(Object);
        res.body.should.have.property('message');
        done();
      });
  });
});