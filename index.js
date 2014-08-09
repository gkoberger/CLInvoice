#!/usr/bin/env node

/* TODO:
 * Check for wkhtmltopdf, throw warning if they don't have it
 * Validate input
 * Colorize everything
 * proper multiplication of hours (3:30 vs 3.30)
 * "UPDATE" option
 * Make sure it doesn't use any globally installed packages
 * If folder has been deleted, recreate it.
 */

var path = require('path')
  , fs = require('fs')

  , open = require('open')
  , prompt = require('readline-sync')
  , async = require('async')
  , mkdirp = require('mkdirp')
  , jade = require('jade')
  , wkhtml = require('node-wkhtml')
  , phantom = require('phantom')
  , colors = require('colors')
  , _ = require('lodash')

var config = false;
var template_info = {};
var details = {};

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

var pad = function(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

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
    console.log("Welcome to CLInvoice! Since this is your first time, we're going to set up a config file at ~/.invoicer");
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
      console.log(" [0] Create New".grey);
      _.each(templates, function(v, k) {
        console.log((" [" + (k+1) + "] " + v).grey);
      });

      template = formatInt(prompt.question('Choose a template: '));
    }

    // Create a new template?
    if(!template) {
      console.log('');
      console.log('Create a new template:');

      template_info.name = prompt.question('Template name: '.grey);
      template_info.color = prompt.question('Template highlight color: (#777) '.grey);

      template_info.dir = template_info.name.replace(/\s+/g, '-').replace(/[^-_a-zA-Z0-9]/).toLowerCase()

      console.log('');
      console.log('Information about you or your company:');
      template_info.company = {};
      template_info.company.name = prompt.question('Name: '.grey);
      template_info.company.address = prompt.question('Address (use "/" for newline): '.grey);
      template_info.company.phone = prompt.question('Phone Number: '.grey);
      template_info.company.web = prompt.question('Web Address: '.grey);
      template_info.company.email = prompt.question('Email Address: '.grey);

      if(template_info.company.address) {
        template_info.company.address = template_info.company.address.split(/\s*\/\s*/g);
      }

      console.log('');
      console.log('Payment types:');
      template_info.payment = {};
      template_info.payment.check = formatBool(prompt.question('Mailed checks accepted? (y/n): '.grey));
      if(template_info.company_email) {
        template_info.payment.paypal = formatBool(prompt.question('PayPay to '+template_info.company_email+' accepted? (y/n): '.grey));
      }

      template_info.payment.direct = formatBool(prompt.question('Direct deposit accepted? (y/n): '.grey));
      if(template_info.payment.direct) {
        template_info.payment.direct_routing = prompt.question('[Direct Deposit] Routing Number: '.grey);
        template_info.payment.direct_account = prompt.question('[Direct Deposit] Account Number: '.grey);
      }
      template_info.payment.credit = formatBool(prompt.question('Credit Card (via ribbon.co) accepted? (y/n): '.grey));
      if(template_info.payment.credit) {
        template_info.payment.credit_ribbon = prompt.question('[Credit Card] Ribbon.co username: '.grey);
      }

      template_info.payment.due = parseInt(prompt.question('Must be paid within N days: (blank = no due date) '.grey));
      template_info.taxes = parseInt(prompt.question('Taxes? (0%) '.grey));

      // Save settings to settings.json
      var save_to = path.join(config.dir, template_info.dir);
      mkdirp(save_to, function(err) { 
        if(err) next(err);

        // Copy over template
        fs.writeFileSync(path.join(save_to, 'template.jade'), fs.readFileSync(path.join(__dirname, 'templates', 'basic.jade')));
        fs.writeFileSync(path.join(save_to, 'logo.png'), fs.readFileSync(path.join(__dirname, 'templates', 'logo.png')));

        // Save settings
        fs.writeFileSync(path.join(save_to, "settings.json"), JSON.stringify(template_info, undefined, 2));

        console.log("");
        console.log("New template created in " + save_to);
        next();

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
  function(next) {
    console.log("");
    console.log("Invoice Details");

    details = { invoice_company : {} };

    details.invoice_company.name = prompt.question('Who are you invoicing (company or name): '.grey);
    details.invoice_company.contact = prompt.question('Who is your contact (optional person name): '.grey);
    details.full_description = prompt.question('Full Description (shown on invoice): '.grey);

    var date = new Date();
    details.date = date.getFullYear() + '-' + pad(date.getMonth() + 1, 2) + '-' + pad(date.getDate(), 2);
    details.company_slug = details.invoice_company.name.toLowerCase().replace(/\s+/g, '-').replace(/[^-_a-z0-9]/g, '');
    details.invoice_id = details.date + '-' + details.company_slug;
    details.invoice_name = details.date + '-' + template_info.company.name.replace(/\s+/g, '-');
    details.invoice_num = details.date + '-' + 0;


    var base_i = 0;
    while(fs.existsSync(path.join(config.dir, template_info.dir, details.invoice_id))) {
      base_i++;
      details.invoice_id = details.date + '-' + base_i + '-' + details.company_slug;
      details.invoice_num = details.date + '-' + base_i;
    }

    details.invoice_num = details.invoice_num.replace(/-/g, '');

    console.log("");
    console.log("Invoice items:");
    details.items = [];

    var more_items = true;
    details.total = 0;
    while(more_items) {
      var item = {};
      item.name = prompt.question('Item Name (blank to skip): '.grey);
      if(item.name) {
        item.quantity = prompt.question('Hours / Quantity: '.grey, 'x');
        item.rate = prompt.question('Rate / Price: '.grey, '$');
        console.log("");
        details.items.push(item);
        details.total += (item.quantity * item.rate);
      } else {
        more_items = false;
      }
    }

    details.tax_amount = details.total * (template_info.taxes / 100);
    details.total += details.tax_amount;

    
    var save_to = path.join(config.dir, template_info.dir, details.invoice_id);
    mkdirp(save_to, function(err) { 
      if(err) next(err);

      // Save invoice details
      fs.writeFileSync(path.join(save_to, details.invoice_name + ".json"), JSON.stringify(details, undefined, 2));

      // Compile a function
      var fn = jade.compileFile(path.join(config.dir, template_info.dir, 'template.jade'), {});
      var vars = {
        template_url: path.join(config.dir, template_info.dir),
      }
      var locals = _.assign(template_info, details, vars);
      var html = fn(locals);

      // Save HTML
      fs.writeFileSync(path.join(save_to, details.invoice_name + ".html"), html);

      next();
    });
  },

  /* Generate PDF */
  function(next) {

    var load_from = path.join(config.dir, template_info.dir, details.invoice_id);

    var invoice_path = path.join(load_from, details.invoice_name + '.pdf');
    var builder = wkhtml.spawn('pdf', path.join(load_from, details.invoice_name + '.html'));
    builder.stdout.pipe(fs.createWriteStream(invoice_path));
    console.log("Generating invoice...");

    builder.on('exit', function (code) {
      console.log("");
      console.log("==============================");
      console.log("Invoice generated!".green);
      console.log("");
      console.log("   Generated at: ", invoice_path.grey);
      console.log("   View options at: ", path.join(load_from, details.invoice_name + '.json').grey);

      /*
      console.log("   Want to update? Edit the JSON file, and run this command:");
      console.log("       clinvoice update " + details.invoice_id);
      */

      console.log("==============================");
      open(invoice_path);
    });

    /*
    phantom.create(function(ph){
      ph.createPage(function(page) {
        page.set('paperSize', {
          format: 'A4'
        }, function() {
          page.open(path.join(load_from, details.invoice_name + ".html"), function(status) {
            page.render(path.join(load_from, details.invoice_name + ".pdf"), function(){
              console.log('Page Rendered');
              ph.exit();
              next();
            });
          });
        });
      });
    });
    */
  },

]);
