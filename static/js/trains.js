var map;
var train_markers = new Object;
var bus_markers = new Object;
var ca_data = {};
var neighborhoods = {};
var trains;
var prev_train_data;
var used_trains;

String.prototype.recase = function () {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};

$(document).ready(function() {
    resizeMap();
    $(window).resize(resizeMap);
    $("#hood_title > h1").text("Loading...");
    var template = _.template($("#loading_template").html());
    $("#hood_data").html(template);
    $("#hood_title > h1").hide();
    var stamen_toner = new L.StamenTileLayer("toner");
    var stamen_watercolor = new L.StamenTileLayer("watercolor");
    var stamen_terrain = new L.StamenTileLayer("terrain");

    map = new L.Map("map", {
        center: new L.LatLng(41.897051,-87.627808),
        zoom: 12,
        maxZoom: 16,
        minZoom: 9,
        maxBounds: L.latLngBounds([40.5348,-89.6842],[42.9485,-86.3168])
    });
    stamen_toner.addTo(map);

    // base tile layer
    var trib_base = L.tileLayer(
        'http://{s}.tribapps.com/chicago-print/{z}/{x}/{y}.png', {
            subdomains: ['maps1'],
            attribution: 'Map data &copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 16,
            minZoom: 9
        });
    //trib_base.addTo(map);

    // City limits mask
    var limits = L.tileLayer(
        "http://media.apps.chicagotribune.com/maptiles/chicago-mask/{z}/{x}/{y}.png",
        { maxZoom: 16, minZoom: 8, opacity: 0.5 });
    limits.addTo(map);

    // Train stations
    var stations = new L.KML("static/kml/stations.kml", {async: true});
    //map.addLayer(stations);

    $.getJSON('static/json/rail_lines.geojson', function(data) {
        var colors = {
            'RD': 'red',
            'PR': 'purple',
            'GR': 'green',
            'ML': 'green',
            'YL': 'yellow',
            'BL': 'blue',
            'PK': 'pink',
            'OR': 'orange',
            'BR': 'brown'
        }
        var layer = L.geoJson(data, {
            style: function (feature) {
                return {
                    color: colors[feature.properties.LEGEND],
                    opacity: 0.8,
                };
            },
            onEachFeature: function (feature, layer) {
                layer.bindPopup('Track segment: ' + feature.properties.DESCRIPTIO);
            }
        });
        layer.addTo(map);
        control.addOverlay(layer, 'CTA Trains');
    });

    /*$.getJSON('static/json/cta_buses.geojson', function(data) {
        var layer = L.geoJson(data, {
            style: function (feature) {
                return {
                    color: 'lime',
                    opacity: 0.8,
                    weight: 2
                };
            },
            onEachFeature: function (feature, layer) {
                layer.bindPopup('Bus line: ' + feature.properties.ROUTE + ' (' + feature.properties.NAME + ')');
            }
        });
        control.addOverlay(layer, 'CTA Buses');
    });*/

    $.getJSON('static/json/neighborhoods.geojson', function(data) {
        //console.log(data);
        var layer = L.geoJson(data, {
            style: function (feature) {
                return {
                    color: 'purple',
                    opacity: 0.2,
                    stroke: true,
                };
            },
            onEachFeature: function (feature, layer) {
                neighborhoods[feature.properties.PRI_NEIGH] = {
                    'layer': layer,
                    'feature': feature
                };
                //layer.bindPopup('Community Area: ' + feature.properties.COMMUNITY + ' (' + feature.properties.AREA_NUMBE + ')');
            }
        });
        //beginNeighborhoodAnimation();
    });

    /*$.getJSON('static/json/ca_data.json', function(data) {
        for (var row in data) {
            ca_data[data[row]['Community Area']] = data[row];
        }
    });*/

    beginCTAAnimation();
    $('#start-tour').click(function() {
      $('#start-tour').hide();
      beginNeighborhoodAnimation();
    });

    var baseLayers = {
        'Tribune': trib_base,
        'Stamen Watercolor': stamen_watercolor,
        'Stamen Toner': stamen_toner,
        'Stamen Terrain': stamen_terrain
    };

    var overlays = {
        'Chicago City Limits': limits
    };

    var control = L.control.layers(baseLayers, overlays);
    //control.addTo(map);
});

function resizeMap() {
    $("#map").css({
        "height": $(window).height() + "px",
        "width": ($(window).width()) + "px"
    });
}

function beginNeighborhoodAnimation() {
    var o_keys = Object.keys(neighborhoods);
    var my_hoods = ["South Shore", "Hyde Park", "Printers Row", "Loop", "O'Hare", "Museum Campus", "Albany Park", "Little Italy, UIC", "Morgan Park", "Logan Square"];
    //var my_hoods = ["Morgan Park", "Little Italy, UIC", "O'Hare", "Printers Row", "Logan Square", "Little Italy, UIC"];
    counter = 0;
    var i_counter = 0;
    var hoodQueue = $({});
    var prev_hood = "";
    while (counter < 500) {
        hoodQueue.queue('hoods', function(next) {
            if (i_counter > 9) {
                i_counter = 0;
            }
            var hood = my_hoods[i_counter];
            if (!hood) {
                next();
            }
            if (prev_hood) {
                map.zoomOut(2, {'animate': true});
                setTimeout(function() {
                    panAndZoom(hood, next, neighborhoods[prev_hood]['layer']);
                    prev_hood = hood;
                    i_counter += 1;
                }, 1000);
            } else {
                panAndZoom(hood, next, null);
                prev_hood = hood;
                i_counter += 1;
            }
        });
        counter += 1;
    }
    hoodQueue.dequeue('hoods');
}

function panAndZoom(hood, next, old_layer) {
    console.log('panning to ' + hood);
    console.log(neighborhoods);
    var new_layer = neighborhoods[hood]['layer'];
    new_layer.addTo(map);
    //console.log('checking used trains');
    //console.log(used_trains);
    //console.log(train_markers);
    for (var t in train_markers) {
        //console.log(train_markers[t]);
        //console.log(t);
        if (isNaN(parseInt(t))) {
            continue;
        }
        var i_url = train_markers[t].options.icon.options.iconUrl;
        var h = i_url.split('train_base_');
        var heading = h[1].split('.');
        var icon = getIconFromHeadingStr(heading[0]);
        /*var icon = L.icon({
            iconUrl: i_url,
            iconSize: [50, 30],
            shadowUrl: 'static/img/train_shadow_' + heading + '.png',
            shadowSize: [50, 30],
            shadowAnchor: [26, 18],
            iconAnchor: [25, 20]
        });*/
        var marker = L.marker(
            train_markers[t].getLatLng(), {icon: icon});
        //console.log(marker);
        map.removeLayer(train_markers[t]);
        map.addLayer(marker);
        train_markers[t] = marker;
    }
    //console.log('done stopping');
    setTimeout(function() {
        //console.log('panning');
        $("#hood_title > h1").text(
            neighborhoods[hood]['feature'].properties['PRI_NEIGH']);//.recase());
        console.log(hood.replace(/\s+/g, '').replace(',', ''));
        try {
            var template = _.template($("#template_" + hood.replace(/\s+/g, '').replace(',', '').replace("'", '')).html());
            $("#hood_data").html(template);
        } catch(err) {
            ;
        }
        map.panTo(new_layer.getBounds().getCenter(), {
            'animate': true,
            'duration': 3.0,
            'easeLinearity': 0.5
        });
        setTimeout(function() {
            //console.log('fitting');
            new_layer.addTo(map);
            map.fitBounds(
                new_layer.getBounds(),
                {
                    'animate': true,
                    'paddingBottomRight': [300, 0]
                }
            );
            if (old_layer) {
                map.removeLayer(old_layer);
            }
            setTimeout(function() {
                //console.log('starting');
                for (var t in used_trains) {
                    //console.log(train_markers[used_trains[t]]);
                    //train_markers[used_trains[t]].setOpacity(1.0);
                    //train_markers[used_trains[t]].setLatLng(
                    //    train_markers[used_trains[t]].getLatLng());
                }
                for (var t in train_markers) {
                    //console.log(train_markers[t]);
                    //console.log(t);
                    if (isNaN(parseInt(t))) {
                        continue;
                    }
                    var i_url = train_markers[t].options.icon.options.iconUrl;
                    var h = i_url.split('train_base_');
                    var heading = h[1].split('.');
                    var icon = getIconFromHeadingStr(heading[0]);
                    /*var icon = L.icon({
                        iconUrl: i_url,
                        iconSize: [100, 60],
                        shadowUrl: 'static/img/train_shadow_' + heading + '.png',
                        shadowSize: [100, 60],
                        shadowAnchor: [53, 36],
                        iconAnchor: [50, 40]
                    });*/
                    var marker = L.marker(
                        train_markers[t].getLatLng(), {icon: icon});
                    //console.log(marker);
                    map.removeLayer(train_markers[t]);
                    map.addLayer(marker);
                    train_markers[t] = marker;
                }
                setTimeout(next, 30000);
            }, 200);
        }, 3000);
    }, 500);
}

function getIconImageSuffixFromHeading(heading) {
    if ((heading > 337) || ((heading >= 0) && (heading < 45))) {
        return '0';
    } else if ((heading >= 45) && (heading < 113)) {
        return '90';
    } else if ((heading >= 113) && (heading < 158)) {
        return '135';
    } else if ((heading >= 158) && (heading < 225)) {
        return '180';
    } else if ((heading >= 225) && (heading < 293)) {
        return '270';
    } else {
        return '315';
    }
}

function getIconFromHeadingStr(heading) {
    var i_url = 'static/img/train_base_' + heading + '.png';
    var s_url = 'static/img/train_shadow_' + heading + '.png';
    var iconSize = [];
    var shadowAnchor = [];
    var iconAnchor = [];
    var scale = 0.8 - (0.1 * (14 - map.getZoom()));

    if ((heading == '0') || (heading == '180')) {
        iconSize = [60 * scale, 100 * scale];
        iconAnchor = [14 * scale, 50 * scale];
        shadowAnchor = [10 * scale, 53 * scale];
    } else if ((heading == '90') || (heading == '270')) {
        iconSize = [100 * scale, 60 * scale];
        iconAnchor = [50 * scale, 40 * scale];
        shadowAnchor = [53 * scale, 36 * scale];
    } else {
        iconSize = [76 * scale, 84 * scale];
        iconAnchor = [38 * scale, 47 * scale];
        shadowAnchor = [40 * scale, 45 * scale];
    }
    var icon = L.icon({
        iconUrl: i_url,
        iconSize: iconSize,
        shadowUrl: s_url,
        shadowSize: iconSize,
        shadowAnchor: shadowAnchor,
        iconAnchor: iconAnchor
    });
    return icon;
}


function beginCTAAnimation() {
    counter = 0;
    var trainQueue = $({});
    train_markers = new L.LayerGroup().addTo(map);
    first_time = true;
    while (counter < 10000) {
        trainQueue.queue('trains', function(next) {
            if (first_time) {
                $('#hood_title>h1').html(
                    '<button type="button" class="btn btn-primary" id="start-tour">Start tour</button>');
                first_time = false;
            }
            animateTrains();
            //animateBuses();
            setTimeout(next, 5000);
        });
        counter += 1;
    }
    trainQueue.dequeue('trains');
}

function animateBuses() {
    $.getJSON('static/json/bus_data.json', function(data) {
        var used_buses = [];
        var icon = L.icon({iconUrl: 'static/img/bus.png', iconSize: [20, 20]});
        for (var bus in data) {
            try {
                if (data[bus].vid in bus_markers) {
                    var new_pos = new L.LatLng(data[bus].lat, data[bus].lon);
                    if ((bus_markers[data[bus].vid].getLatLng().lat != new_pos.lat) &&
                        (bus_markers[data[bus].vid].getLatLng().lng != new_pos.lng)) {
                        bus_markers[data[bus].vid].setLatLng([data[bus].lat, data[bus].lon]);
                        bus_markers[data[bus].vid].update();
                    }
                } else {
                    var marker = L.marker([data[bus].lat, data[bus].lon], {icon: icon});
                    bus_markers[data[bus].vid] = marker;
                    marker.addTo(map);
                }
                used_buses.push(data[bus].vid);
            } catch(err) {
                ; //console.log(err);
            }
        }
        for (var bus in bus_markers) {
            if ($.inArray(bus, used_buses) == -1) {
               map.removeLayer(marker);
               delete bus_markers[bus];
            }
        }
    });
}

function animateTrains() {
    $.getJSON('static/json/train_data.json', function(data) {
        var date = data.ctatt.tmst.split(' ')[0];
        var date_fmt = date.substr(4, 2) + '/' + date.substr(6, 2) + '/' + date.substr(0, 4);
        var time = data.ctatt.tmst.split(' ')[1];
        $('#train_positions').text('Train positions as of ' + date_fmt + ' ' + time);
        used_trains = [];
        var first_time = true;
        var train_names = {
            'red': 'red',
            'blue': 'blue',
            'brn': 'brown',
            'g': 'green',
            'org': 'orange',
            'p': 'purple',
            'pink': 'pink',
            'y': 'yellow'
        };

        if (data.ctatt.errCd != '0') {
            alert('Error ' + data.ctatt.errCd + ': ' + data.ctatt.errNm);
        } else {
            for (var route in data.ctatt.route) {
                var route_name = (train_names[data.ctatt.route[route]['@name']]);
                var trains = data.ctatt.route[route].train;
                for (var t in trains) {
                    try {
                        var heading = getIconImageSuffixFromHeading(parseInt(trains[t].heading));
                        var icon = getIconFromHeadingStr(heading);
                        /*var icon = L.icon({
                            iconUrl: 'static/img/train_base_' + heading + '.png', //'static/img/train_' + route_name + '.png',
                            iconSize: [100, 60],
                            shadowUrl: 'static/img/train_shadow_' + heading + '.png',
                            shadowSize: [100, 60],
                            shadowAnchor: [53, 36],
                            iconAnchor: [50, 40]
                        });*/
                        if (trains[t].rn in train_markers) {
                            var run = trains[t].rn;
                            if (run in used_trains) {
                                continue;
                            }
                            var cur_pos = train_markers[run].getLatLng();
                            var new_pos = new L.LatLng(trains[t].lat, trains[t].lon);
                            if ((cur_pos.lat != new_pos.lat) &&
                                (cur_pos.lng != new_pos.lng)) {
                                distance = getDistanceFromLatLonInM(
                                    cur_pos.lat,
                                    cur_pos.lng,
                                    new_pos.lat,
                                    new_pos.lng
                                );
                                if (distance > 1) {
                                    used_trains.push(run);
                                    //console.log('animating ' + run);
                                    var line = new L.polyline([
                                        [cur_pos.lat, cur_pos.lng],
                                        [cur_pos.lat, cur_pos.lng],
                                        [new_pos.lat, new_pos.lng],
                                    ]);
                                    var anim_marker = L.animatedMarker(
                                        line.getLatLngs(),
                                        {
                                            icon: icon,
                                            //distance: distance,
                                            //autoStart: false,
                                            interval: 5000,
                                            onEnd: function() {
                                                /*this.setLatLng(new_pos);
                                                this.bindPopup(
                                                    'Run ' + run + ' just traveled ' + distance + 'm',
                                                    {
                                                        'autoPan': false
                                                    }
                                                );*/
                                                //this.openPopup();
                                            }
                                        }
                                    );
                                    //anim_marker.setIconAngle(trains[t].heading);
                                    map.addLayer(anim_marker);
                                    map.removeLayer(train_markers[run]);
                                    train_markers[run] = anim_marker;
                                }
                            }
                        } else {
                            var marker = L.marker(//L.Marker.RotatedMarker(
                                [trains[t].lat, trains[t].lon],
                                {
                                    icon: icon,
                                }
                            );
                            //console.log(trains[t]);
                            //marker.setIconAngle(trains[t].heading);
                            var approach = 'Approaching ';
                            if (trains[t].isApp == '0') {
                                approach = 'Next stop ';
                            }
                            var delayed = '';
                            if (trains[t].isDly == '1') {
                                delayed = '<h3>Running delayed</h3>';
                            }
                            marker.bindPopup('<h2>' + route_name.charAt(0).toUpperCase() + route_name.slice(1) + ' line</h2><h3>To ' + trains[t].destNm + '</h3>' + delayed + '<p>Run ' + trains[t].rn + '</p><p>' + approach + trains[t].nextStaNm + '</p>');
                            marker.on('mouseover', function(e) {
                                console.log(e);
                                $("#hood_data").html(e.target._popup._content);
                            });
                            marker.addTo(map);
                            train_markers[trains[t].rn] = marker;
                        }
                    } catch(err) {
                        ;
                        //console.log(err);
                    }
                }
            }
        }
        prev_train_data = data;
    });
}

function getDistanceFromLatLonInM(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d * 1000;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}
