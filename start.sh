#!/bin/bash
cd /var/www/node/TeamsTabSSO
/usr/bin/node www/index > /var/log/node.TeamsTabSSO.log 2>&1
