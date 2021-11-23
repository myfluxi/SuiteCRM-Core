#!/bin/bash

composer install
yarn install

# Legacy theme compile
vendor/bin/pscss -s compressed ./public/legacy/themes/suite8/css/Dawn/style.scss > ./public/legacy/themes/suite8/css/Dawn/style.css

yarn run build-dev:common
yarn run build-dev:core
yarn run build-dev:shell

composer dumpautoload

chmod +x ./bin/console
bin/console suitecrm:app:install

# Permissions
sudo chmod -R 775 cache logs
sudo chown -R _www:staff cache logs

cd public/legacy || exit 1
sudo chmod -R 775 cache custom modules themes data upload config_override.php
sudo chown -R _www:staff cache custom modules themes data upload config_override.php
cd -

composer dumpautoload
