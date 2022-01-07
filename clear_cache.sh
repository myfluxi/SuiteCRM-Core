#!/bin/bash

sudo -v

sudo bin/console cache:clear
sudo rm -rf public/legacy/cache/*
