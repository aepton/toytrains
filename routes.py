#!/usr/bin/env python

import urllib2
import json
import xmltodict
import StringIO

from flask import Flask, render_template

import boto
import boto.s3
from boto.s3.key import Key

app = Flask(__name__)


@app.route('/')
def home():
    return render_template('trains.html')


@app.route('/bus_data.json')
def bus_data():
    cta_key = 'w8xeHXDhPGHtGCY7mngPuNcpD'
    routes_api_url = (
        'http://www.ctabustracker.com/bustime/api/v1/getroutes?key=%s')
    vehicle_api_url = (
        'http://www.ctabustracker.com/bustime/api/v1/getvehicles?key=%s&rt=%s')
    local_file = (
        '/Users/abrahamepton/Tribune/toytrains/static/json/bus_data.json')
    s3_key = 'toytrains/static/json/bus_data.json'
    response = urllib2.urlopen(routes_api_url % cta_key)
    routes = xmltodict.parse(response.read())
    curr_idx = 0
    route_requests = [[]]
    for r in routes['bustime-response']['route']:
        if len(route_requests[curr_idx]) == 10:
            curr_idx += 1
            route_requests.append([])
        route_requests[curr_idx].append(r['rt'])
    vehicles = []
    for rts in route_requests:
        response = urllib2.urlopen(vehicle_api_url % (cta_key, ','.join(rts)))
        data = xmltodict.parse(response.read())
        for vehicle in data['bustime-response']['vehicle']:
            vehicles.append(vehicle)
    FH = open(local_file, 'w')
    FH.write(json.dumps(vehicles))
    FH.close()
    _write_string_to_s3(s3_key, json.dumps(vehicles))

    return 'Done'


@app.route('/train_data.json')
def train_data():
    cta_key = 'e01b6e395d7b480aae1f55166186ac32&'
    routes = 'red,blue,brn,g,org,p,pink,y'
    api_url = 'lapi.transitchicago.com/api/1.0/ttpositions.aspx'
    local_file = (
        '/Users/abrahamepton/Tribune/toytrains/static/json/train_data.json')
    s3_key = 'toytrains/static/json/train_data.json'
    response = urllib2.urlopen('http://%s?key=%srt=%s' % (
        api_url, cta_key, routes))
    data = xmltodict.parse(response.read())
    FH = open(local_file, 'w')
    FH.write(json.dumps(data))
    FH.close()
    _write_string_to_s3(s3_key, json.dumps(data))

    return 'Done'

def _write_string_to_s3(key_path, str):
    conn = boto.connect_s3()
    bucket = conn.get_bucket('apps.beta.tribapps.com')
    k = Key(bucket)
    k.key = key_path
    k.set_contents_from_file(StringIO.StringIO(str))
    k.make_public()

if __name__ == '__main__':
    app.run(debug=True)
