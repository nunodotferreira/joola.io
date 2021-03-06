/**
 *  joola.io
 *
 *  Copyright Joola Smart Solutions, Ltd. <info@joo.la>
 *
 *  Licensed under GNU General Public License 3.0 or later.
 *  Some rights reserved. See LICENSE, AUTHORS.
 *
 *  @license GPL-3.0+ <http://spdx.org/licenses/GPL-3.0+>
 */

var
  Browser = require('zombie'),
  browser = new Browser({silent: true});

describe("auth", function () {
  before(function (done) {
    this.context = {user: _token.user};
    this.uid = joola.common.uuid();
    this.workspace = 'test-org-' + joola.common.uuid();
    done();
  });

  it("should return static content with no login issues", function (done) {
    browser.visit('http://' + joola.config.interfaces.webserver.host + ':' + joola.config.interfaces.webserver.port + '/ico/favicon.ico', function () {
      expect(browser.success).to.equal(true);
      done();
    });
  });

  xit("should return login page with no issues", function (done) {
    browser.visit('http://' + joola.config.interfaces.webserver.host + ':' + joola.config.interfaces.webserver.port + '/login', function () {
      expect(browser.text("title")).to.equal('joola.io');
      done();
    });
  });

  xit("should validate a token presented in querystring", function (done) {
    browser.visit('http://' + joola.config.interfaces.webserver.host + ':' + joola.config.interfaces.webserver.port + '/api/test/action?token=1234', function () {
      var result = browser.text();
      result = JSON.parse(result);

      expect(result.debug.query_token).to.equal('1234');
      done();
    });
  });

  xit("should validate a token presented in headers", function (done) {
    var options = {};
    options.headers = {'joolaio-token': 'apitoken-root'};
    browser.visit('http://' + joola.config.interfaces.webserver.host + ':' + joola.config.interfaces.webserver.port + '/api/test/action', options, function () {
      var result = browser.text();
      result = JSON.parse(result);

      expect(result.debug.header_token).to.equal('apitoken-root');
      done();
    });
  });

  it("should return 401 error if no token and content-type application/json", function (done) {
    var options = {};
    options.headers = {'content-type': 'application/json'};
    browser.visit('http://' + joola.config.interfaces.webserver.host + ':' + joola.config.interfaces.webserver.port + '/api/test/action', options, function () {
      expect(browser.statusCode).to.equal(401);
      browser = new Browser({silent: true});
      done();
    });
  });

  xit("should return 200 and login page if no token", function (done) {
    browser.visit('http://' + joola.config.interfaces.webserver.host + ':' + joola.config.interfaces.webserver.port + '/api/test/action', function () {
      expect(browser.text("title")).to.equal('joola.io - Login');
      expect(browser.statusCode).to.equal(200);
      done();
    });
  });

  xit("should allow anonymous access", function (done) {
    var token = '123';
    var _store = joola.config.authentication.store;
    joola.config.authentication.store = 'anonymous';
    joola.auth.validateToken(token, function (err, token) {
      joola.config.authentication.store = _store;
      expect(token.user.username).to.equal('anonymous');
      done(err);
    });
  });

  xit("should allow bypass access", function (done) {
    var token = '123';
    var _bypassToken = joola.config.authentication.bypassToken;
    var _store = joola.config.authentication.store;
    joola.config.authentication.store = 'internal';
    joola.config.authentication.bypassToken = '123';
    joola.auth.validateToken(token, function (err, token) {
      joola.config.authentication.store = _store;
      joola.config.authentication.bypassToken = _bypassToken;
      expect(token.user.username).to.equal('bypass');
      done(err);
    });
  });

  it("should generate a valid security token", function (done) {
    var user = {
      username: 'test'
    };
    joola.auth.generateToken(user, function (err, token) {
      expect(token._).to.be.ok;
      expect(token.user).to.be.ok;
      expect(token.timestamp).to.be.ok;
      expect(token.expires).to.be.ok;
      done(err);
    });
  });

  xit("token should expire after 2 seconds", function (done) {
    var user = {
      username: 'test'
    };
    var _expireAfter = joola.config.authentication.tokens.expireAfter;
    joola.config.authentication.tokens.expireAfter = 2000;

    joola.auth.generateToken(user, function (err, token) {
      joola.config.authentication.tokens.expireAfter = _expireAfter;

      joola.auth.validateToken(token._, null, function (err, valid) {
        if (err)
          return done(err);
        expect(valid).to.be.ok;
        setTimeout(function () {
          joola.auth.validateToken(token._, null, function (err, valid) {
            console.log('validate', valid);
            if (err)
              done();
            else
              done(new Error('Failed to expire token'));
          });
        }, 2000);
      });
    });
  });

  it("should expire a token", function (done) {
    var user = {
      username: 'test'
    };
    joola.auth.generateToken(user, function (err, token) {
      joola.auth.expireToken(token, function (err) {
        joola.auth.validateToken(token, null, function (err, valid) {
          expect(err).to.be.ok;
          done();
        });
      });
    });
  });

  xit("should prevent a expiration tempering", function (done) {
    var user = {
      username: 'test'
    };
    joola.auth.generateToken(user, function (err, token) {
      token.expires = new Date().getTime();
      joola.redis.hmset('auth:tokens:' + token._, token, function (err) {
        joola.auth.validateToken(token, function (err, valid) {
          expect(err).to.be.ok;
          done();
        });
      });
    });
  });

  it("should validate a route", function (done) {
    var modulename = 'collections';
    var action = 'list';

    joola.auth.validateRoute(modulename, action, function (err, action) {
      expect(action).to.be.ok;
      done(err);
    });
  });

  it("should error on invalid a route", function (done) {
    var modulename = 'datasources2';
    var action = 'list';

    joola.auth.validateRoute(modulename, action, function (err, action) {
      if (!err) {
        return done(new Error('Failed'));
      }
      return done();
    });
  });

  it("should validate an action", function (done) {
    var modulename = 'collections';
    var action = 'list';

    var user = {
      username: 'tester',
      _roles: ['root'],
      workspace: 'root'
    };
    var req = {
      params: {
        workspace: 'root'
      },
      user: user
    };
    var res = {};

    joola.auth.validateRoute(modulename, action, function (err, action) {
      if (err)
        return done(err);
      try {
        joola.auth.validateAction(action, req, res, function (err, valid) {
          return done(err);
        });
      }
      catch (ex) {
        return done(ex);
        //this is to ensure we don't have exceptions perculating back up and down.
      }
    });
  });

  it("should fail validating an action when no user", function (done) {
    var modulename = 'collections';
    var action = 'list';

    var req = {
      params: {
        workspace: 'root'
      }
    };
    var res = {};

    joola.auth.validateRoute(modulename, action, function (err, action) {
      if (err)
        return done(err);
      try {
        joola.auth.validateAction(action, req, res, function (err, valid) {
          if (err)
            return done();
          return done(new Error('This should have failed'));
        });
      }
      catch (ex) {
        //this is to ensure we don't have exceptions perculating back up and down.
        return done(ex);
      }
    });
  });

  it("should fail validating an action when no permission", function (done) {
    var modulename = 'test';
    var action = 'nopermission';

    var user = {
      username: 'tester',
      _roles: ['user']
    };
    var req = {
      params: {
      },
      user: user
    };
    var res = {};

    joola.auth.validateRoute(modulename, action, function (err, action) {
      if (err)
        return done(err);
      try {
        joola.auth.validateAction(action, req, res, function (err, valid) {
          if (err)
            return done();
          return done(new Error('This should have failed'));
        });
      }
      catch (ex) {
        //this is to ensure we don't have exceptions perculating back up and down.
        return done(ex);
      }
    });
  });

  it("should validate an action when permission ok", function (done) {
    var modulename = 'test';
    var action = 'withpermission';

    var user = {
      username: 'tester',
      _roles: ['user'],
      workspace: 'root'
    };
    var req = {
      params: {
      },
      user: user
    };
    var res = {};

    joola.auth.validateRoute(modulename, action, function (err, action) {
      if (err)
        return done(err);
      try {
        joola.auth.validateAction(action, req, res, function (err, valid) {
          if (err)
            return done(err);
          return done();
        });
      }
      catch (ex) {
        //this is to ensure we don't have exceptions perculating back up and down.
        return done(ex);
      }
    });
  });

  it("should encrypt a user password", function (done) {
    var password = '1234';
    var hash = joola.auth.hashPassword(password);
    expect(hash).to.not.equal('1234');
    done();
  });

  it("should store salt with the hash", function (done) {
    var password = '1234';
    var hash = joola.auth.hashPassword(password);

    assert(hash.indexOf('$') > -1);
    done();
  });

  it("should validate a password", function (done) {
    var password = '1234';
    var hash = 'nVHqYEJbh$81dc9bdb52d04dc20036dbd8313ed055';
    var valid = joola.auth.validatePassword(password, hash);

    assert(valid);
    done();
  });

  it("should get a user by token", function (done) {
    var user = {
      username: 'test-' + joola.common.uuid(),
      _password: '1234',
      _roles: ['user'],
      workspace: 'test-org'
    };
    joola.dispatch.users.add(this.context, this.workspace, user, function (err, _user) {
      joola.auth.generateToken(user, function (err, token) {
        if (err)
          return done(err);
        joola.auth.getUserByToken(token._, function (err, _user) {
          if (err)
            return done(err);

          expect(_user.username).to.equal(user.username);
          done(null);
        });
      });
    });
  });
});
