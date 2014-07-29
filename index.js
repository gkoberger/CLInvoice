#!/usr/bin/env node

var path = require('path')
  , fs = require('fs')

  , prompt = require('readline-sync')
  , async = require('async')
  , mkdirp = require('mkdirp')
  , _ = require('lodash')

var config = false;
var template_info = {};

var absPath = function(p) {
  if(p.substr(0, 1) != '/' && p.substr(0, 1) != '~') {
    p = path.resolve(process.cwd(), p);
  }
  if(p.substr(0, 1) == '~') {
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    p = path.resolve(home, p.replace('~/', ''));
  }
  return p
};

var formatBool = function(bool) {
  return (bool.substr(0).toLowerCase() == "y")
};

var formatInt = function(i) {
  var i = parseInt(i);
  if(!i) return false;
  return i;
};

var getDirectories = function(dir) {
  return fs.readdirSync(dir).filter(function (file) {
    return fs.statSync(path.resolve(dir, file)).isDirectory();
  });
};

async.series([

  /* Load the config */
  function(next) {
    fs.readFile(absPath('~/.invoicer'), 'utf8', function (err, data) {
      if (!err) {
        config = JSON.parse(data);
      }
      next();
    });
  },

  /* If no config, set one up */
  function(next) {
    if(config) { // We already have a config file set up
      return next();
    }

    config = {};

    // Welcome message
    console.log("Welcome to Invoicer! Since this is your first time, we're going to set up a config file at ~/.invoicer");
    console.log("");

    // Prompt for the invoice directory
    config.dir = prompt.question('Invoice directory (' + process.cwd() + '): ');

    // If nothing entered, use current working directory
    if(!config.dir) {
      config.dir = process.cwd();
    }

    // Extrapolate the directory into a full path
    config.dir = absPath(config.dir)
    
    // Save JSON file
    fs.writeFile(absPath("~/.invoicer"), JSON.stringify(config, undefined, 2), function(err) {
      if(err) next(err);

      console.log('Created config file at ~/.invoicer');

      // Create directory
      mkdirp(config.dir, function(err) { 
        if(err) next(err);
        console.log('Created invoice directory ' + config.dir);
        next();
      });

    }); 
  },

  /* Pick A Template */
  function(next) {
    var templates = getDirectories(config.dir);
    var template = 0;

    // Pick a template
    if(templates.length > 0) {

      console.log("Current templates:");
      console.log(" [0] Create New");
      _.each(templates, function(v, k) {
        console.log(" [" + (k+1) + "] " + v);
      });

      template = formatInt(prompt.question('Choose a template: '));
    }

    // Create a new template?
    if(!template) {
      console.log('');
      console.log('Create a new template:');

      template_info.name = prompt.question('Template name: ');
      template_info.color = prompt.question('Template highlight color: (#777) ');

      template_info.dir = template_info.name.replace(/\s+/g, '-').replace(/[^-_a-zA-Z0-9]/).toLowerCase()

      console.log('');
      console.log('Information about you or your company:');
      template_info.company_name = prompt.question('Name: ');
      template_info.company_address = prompt.question('Address (use "/" for newline): ');
      template_info.company_phone = prompt.question('Phone Number: ');
      template_info.company_email = prompt.question('Email Address: ');

      console.log('');
      console.log('Payment types:');
      template_info.payment = {};
      template_info.payment.check = formatBool(prompt.question('Mailed checks accepted? (y/n): '));
      if(template_info.company_email) {
        template_info.payment.paypal = formatBool(prompt.question('PayPay to '+template_info.company_email+' accepted? (y/n): '));
      }

      template_info.payment.direct = formatBool(prompt.question('Direct deposit accepted? (y/n): '));
      if(template_info.payment.direct) {
        template_info.payment.direct_routing = prompt.question('[Direct Deposit] Routing Number: ');
        template_info.payment.direct_account = prompt.question('[Direct Deposit] Account Number: ');
      }
      template_info.payment.credit = formatBool(prompt.question('Credit Card (via ribbon.co) accepted? (y/n): '));
      if(template_info.payment.credit) {
        template_info.payment.credit_ribbon = prompt.question('Ribbon.co username for credit cards: ');
      }

      template_info.payment.due = parseInt(prompt.question('Must be paid within N days: (blank = no due date) '));

      // Save settings to settings.json
      var save_to = path.join(config.dir, template_info.dir);
      mkdirp(save_to, function(err) { 
        if(err) next(err);

        fs.writeFile(path.join(save_to, "settings.json"), JSON.stringify(template_info, undefined, 2), function(err) {
          if(err) next(err);

          console.log("");
          console.log("New template created in " + save_to);
          next();
        });
      });
    } else {
      var load_from = path.join(config.dir, templates[template-1], 'settings.json');
      fs.readFile(load_from, 'utf8', function (err, data) {
        if (!err) {
          template_info = JSON.parse(data);
        }
        next();
      });
    }
  },

  /* Create the invoice! */

]);


//var prompt = require('prompt')
  //, async = require('async')

  /*
var prompt = require('sync-prompt').prompt;

prompt.message = "[invoicer]"
prompt.delimiter = " "

// Start the prompt
prompt.start();

//
// Get two properties from the user: username and password
//
prompt.get([{
    name: 'username',
    required: true
  }, {
    name: 'password',
    hidden: true,
    conform: function (value) {
      return true;
    }
  }], function (err, result) {

    invoiceLoop(function() {
      // Log the results.
      console.log('Command-line input received:');
      console.log('  username: ' + result.username);
      console.log('  password: ' + result.password);
    });
});

function invoiceLoop(cb) {
  prompt.get([{
    name: 'Item Description',
  }, {
    name: 'Quantity (hours)',
  },
  {
    name: 'Unit price (per hour)',
  }], function (err, r) {

    if(!r.name) {

    invoiceLoop(function() {
      // Log the results.
      console.log('Command-line input received:');
      console.log('  username: ' + result.username);
      console.log('  password: ' + result.password);
    });
  });
  cb();
}
*/
