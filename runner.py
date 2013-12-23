#!/usr/bin/env python

import time
import urllib2

while True:
    urllib2.urlopen('http://127.0.0.1:5000/train_data.json')
    #urllib2.urlopen('http://127.0.0.1:5000/bus_data.json')
    time.sleep(10)
