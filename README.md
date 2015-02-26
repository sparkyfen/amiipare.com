Amiipare.com
==========

Compare Two Amiibo on various things.


Currently Supported
----------------------------

* Ebay Average Selling Price


API Documentation
--------------------------

Coming soon...

Front-End
-------------

Coming soon....


Development
------------------

Requirements
-------------------
* [NodeJS](http://nodejs.org/)
* [Grunt](http://gruntjs.com/)
* [Yeoman](http://yeoman.io/)
* [Redis](http://redis.io/)
* [Ebay Developer Account](https://developer.ebay.com/)

Development
------------------

```bash
# Start Redis
$ redis-server /path/to/redis.conf

# Set environment variable temporarily in Linux or Mac or Git Bash on Windows
$ export NODE_ENV=development
# Or permanent in your ~/.bashrc or ~/.profile (for Mac OSX)

# Fork repo

# Clone repo
$ git clone https://github.com/<username>/amiipare.com.git /path/to/repo && cd /path/to/repo

# Copy development config file
$ cp server/config/environment/development.js.template server/config/environment/development.js

# Edit config file with your own credentials

# Install dependencies
$ npm install && bower install
$ npm install -g generator-angular-fullstack

# Start server
$ grunt serve

# Install new endpoint
$ yo angular-fullstack:endpoint <new endpoint>
# Install new Angular Route
$ yo angular-fullstack:route <new route>

```

Production
--------------

```bash
# On development machine:
$ cd /path/to/repo && grunt build && cd dist

# Copy dist files to production directory
$ cp -r ./* /path/to/production/directory && cd path/to/production/directory

# Or SCP them to remote host
$ cd .. && zip -r dist.zip dist/* && scp -P 22 dist.zip username@example.com:/path/to/production/directory/
$ ssh -p 22 username@example.com

# On remote machine:

# Make sure redis is running

$ cd /path/to/production/directory/
$ unzip dist.zip

# Set environment variable temporarily in Linux or Mac or Git Bash on Windows
$ export NODE_ENV=production
# Or permanent in your ~/.bashrc or ~/.profile (for Mac OSX)

# Install dependencies
$ npm install
# Start server
$ PORT=3000 IP=127.0.0.1 npm start
# Use forever to start server (https://github.com/foreverjs/forever)
$ PORT=3000 IP=127.0.0.1 forever start server/app.js

# Install with Heroku (https://heroku.com)
# On development machine:
$ cd /path/to/repo && grunt build && cd dist

# Create app on Heroku site (https://dashboard.heroku.com/new)
# Login to Heroku
$ heroku login
# Add remote repo url
$ heroku git:remote -a <app name>
# Set environment vars
$ heroku config:add NODE_ENV=production
$ heroku config:add AMIIPARE_FIREBASE_URL=https://<app name>.firebaseio.com/
$ heroku config:add AMIIPARE_EBAY_URL=https://svcs.ebay.com/services/search/FindingService/v1
$ heroku config:add AMIIPARE_EBAY_APPNAME=<your Ebay app name>
$ heroku config:add AMIIPARE_MASHAPE_APIKEY=<Your Mashape API Key>
# Add files
$ git add .
# Commit files
$ git commit -am "make it better"
# Push files
$ git push heroku master
```

License
----------

* [MIT](http://brutalhonesty.mit-license.org/)
* [TL;DR](https://tldrlegal.com/license/mit-license)