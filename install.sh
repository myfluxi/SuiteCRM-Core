#!/bin/bash

sudo -v

composer install
yarn install

# Legacy theme compile
vendor/bin/pscss -s compressed ./public/legacy/themes/suite8/css/Dawn/style.scss > ./public/legacy/themes/suite8/css/Dawn/style.css

yarn run build-dev:common
yarn run build-dev:core
yarn run build-dev:shell

composer dumpautoload

chmod +x bin/console
bin/console suitecrm:app:install

# Permissions
sudo chmod -R 775 cache logs extensions
sudo chown -R _www:staff cache logs extensions

cd public || exit 1
sudo chmod -R 775 extensions
sudo chown -R _www:staff extensions
cd -

cd public/legacy || exit 1
sudo chmod -R 775 cache custom modules themes data upload config_override.php
sudo chown -R _www:staff cache custom modules themes data upload config_override.php
cd -

composer dumpautoload

# OAuth2 keys
cd public/legacy/Api/V8/OAuth2 || exit 1
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
sudo chmod 600 private.key public.key
sudo chown _www:staff p*.key
