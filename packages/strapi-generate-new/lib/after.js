'use strict';

/**
 * Module dependencies
 */

// Node.js core.
const path = require('path');
const { exec, execSync } = require('child_process');

// Public node modules.
const _ = require('lodash');
const {green, cyan} = require('chalk');
const fs = require('fs-extra');
const npm = require('enpeem');
const ora = require('ora');

/**
 * Runs after this generator has finished
 *
 * @param {Object} scope
 * @param {Function} cb
 */

/* eslint-disable no-console */
/* eslint-disable prefer-template */
module.exports = (scope, cb) => {
  console.log(`The app has been connected to the database ${green('successfully')}!`);
  console.log();

  console.log('🏗  Application generation:');

  let loader = ora('Copy dashboard').start();

  const packageJSON = require(path.resolve(scope.rootPath, 'package.json'));
  // const strapiRootPath = path.resolve(scope.strapiRoot, '..');

  process.chdir(scope.rootPath);

  // Copy the default files.
  fs.copySync(path.resolve(__dirname, '..', 'files'), path.resolve(scope.rootPath));

  loader.succeed();

  let availableDependencies = [];
  const dependencies = _.get(packageJSON, 'dependencies');
  const strapiDependencies = Object.keys(dependencies).filter(key => key.indexOf('strapi') !== -1);
  const othersDependencies = Object.keys(dependencies).filter(key => key.indexOf('strapi') === -1);
  const globalRootPath = execSync('npm root -g');

  // Verify if the dependencies are available into the global
  _.forEach(strapiDependencies, (key) => {
    try {
      fs.accessSync(path.resolve(_.trim(globalRootPath.toString()), key), fs.constants.R_OK | fs.constants.F_OK);

      availableDependencies.push({
        key,
        global: true,
        path: path.resolve(_.trim(globalRootPath.toString()), key)
      });
    } catch (e) {
      othersDependencies.push(key);
    }
  });

  if (!_.isEmpty(othersDependencies)) {
    npm.install({
      dir: scope.rootPath,
      dependencies: othersDependencies,
      loglevel: 'silent',
      production: true,
      'cache-min': 999999999
    }, err => {
      if (err) {
        console.log();
        console.log('⚠️ You should run `npm install` into your application before starting it.');
        console.log();
        console.log('⚠️ Some dependencies could not be installed:');
        _.forEach(othersDependencies, value => console.log('• ' + value));
        console.log();

        return cb();
      }

      pluginsInstallation();
    });
  } else {
    pluginsInstallation();
  }

  const strapiBin = path.join(scope.strapiRoot, scope.strapiPackageJSON.bin.strapi);

  // Install default plugins and link dependencies.
  function pluginsInstallation() {
    // Define the list of default plugins.
    const defaultPlugins = [{
      name: 'settings-manager',
      core: true
    }, {
      name: 'content-type-builder',
      core: true
    }, {
      name: 'content-manager',
      core: true
    }, {
      name: 'users-permissions',
      core: true
    }, {
      name: 'email',
      core: true
    },{
      name: 'upload',
      core: true
    }];

    let installPlugin = new Promise(resolve => {
      return resolve();
    });

    // Install each plugin.
    defaultPlugins.forEach(defaultPlugin => {
      installPlugin = installPlugin.then(() => {
        return new Promise(resolve => {
          loader = ora(`Install plugin ${cyan(defaultPlugin.name)}.`).start();
          exec(`node ${strapiBin} install ${defaultPlugin.name} ${scope.developerMode && defaultPlugin.core ? '--dev' : ''}`, (err) => {
            if (err) {
              loader.warn(`An error occurred during ${defaultPlugin.name} plugin installation.`);
              console.log(err);
              return resolve();
            }

            loader.succeed();
            return resolve();
          });
        });
      });
    });

    installPlugin
      .then(() => {
        // Link dependencies.
        availableDependencies.forEach(dependency => {
          loader = ora(`Link ${cyan(dependency.key)} dependency to the project.`).start();

          if (dependency.global) {
            try {
              fs.accessSync(dependency.path, fs.constants.R_OK | fs.constants.F_OK);
              fs.symlinkSync(dependency.path, path.resolve(scope.rootPath, 'node_modules', dependency.key), 'dir');
            } catch (e) {
              // Silent.
            }
          } else {
            try {
              fs.accessSync(path.resolve(scope.strapiRoot, 'node_modules', dependency.key), fs.constants.R_OK | fs.constants.F_OK);
              fs.symlinkSync(path.resolve(scope.strapiRoot, 'node_modules', dependency.key), path.resolve(scope.rootPath, 'node_modules', dependency.key), 'dir');
            } catch (e) {
              // Silent.
            }
          }

          loader.succeed();
        });

        console.log();
        console.log(`👌 Your new application ${green(scope.name)} is ready at ${cyan(scope.rootPath)}.`);
        console.log();
        console.log('⚡️ change directory:');
        console.log(`$ ${green(`cd ${scope.name}`)}`);
        console.log();
        console.log('⚡️ start application:');
        console.log(`$ ${green('strapi start')}`);

        cb();
      });
  }
};
