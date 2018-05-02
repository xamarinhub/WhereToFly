/**
 * Creates a new instance of MapView
 * @constructor
 * @param {object} options Options to use for initializing map view
 */
function MapView(options) {

    console.log("creating new 3D map view");

    this.options = options || {
        id: 'mapElement',
        initialCenterPoint: { latitude: 47.67, longitude: 11.88 },
        initialZoomLevel: 14,
        callback: {}
    };

    if (this.options.callback === undefined)
        this.options.callback = callAction;

    console.log("#1 imagery provider");

    Cesium.BingMapsApi.defaultKey = 'AuuY8qZGx-LAeruvajcGMLnudadWlphUWdWb0k6N6lS2QUtURFk3ngCjIXqqFOoe';

    this.openStreetMapImageryLayer = null;
    this.openStreetMapImageryProvider = Cesium.createOpenStreetMapImageryProvider({
        url: 'https://{s}.tile.openstreetmap.org/',
        subdomains: 'abc',
        maximumLevel: 18
    });

    this.bingMapsAerialWithLabelsImageryLayer = null;
    this.bingMapsAerialWithLabelsImageryProvider = new Cesium.BingMapsImageryProvider({
        url: 'https://dev.virtualearth.net',
        mapStyle: Cesium.BingMapsStyle.AERIAL_WITH_LABELS
    });

    this.setupSlopeAndContourLines();

    this.thermalSkywaysLayer = null;
    this.thermalSkywaysOverlay = this.createThermalImageryProvider();

    console.log('thermal maps url: ' + this.thermalSkywaysOverlay.url);

    this.blackMarbleLayer = null;
    this.blackMarbleOverlay = new Cesium.createTileMapServiceImageryProvider({
        url: 'https://cesiumjs.org/tilesets/imagery/blackmarble',
        maximumLevel: 8,
        credit: 'Black Marble imagery courtesy NASA Earth Observatory'
    });

    console.log("#2 terrain provider");
    var terrainProvider = new Cesium.createWorldTerrain({
        requestWaterMask: false,
        requestVertexNormals: true
    });

    console.log("#3 clock");
    var now = Cesium.JulianDate.now();
    var end = new Cesium.JulianDate();
    Cesium.JulianDate.addDays(now, 1, end);

    var clock = new Cesium.Clock({
        startTime: now,
        endTime: end,
        currentTime: now.clone(),
        clockStep: Cesium.ClockStep.SYSTEM_CLOCK,
        clockRange: Cesium.ClockRange.CLAMPED
    });

    console.log("#4 viewer");
    this.viewer = new Cesium.Viewer(this.options.id, {
        imageryProvider: this.openStreetMapImageryProvider,
        terrainProvider: terrainProvider,
        clockViewModel: new Cesium.ClockViewModel(clock),
        baseLayerPicker: false,
        sceneModePicker: false,
        animation: false,
        geocoder: false,
        homeButton: false,
        timeline: false,
        skyBox: false,
        scene3DOnly: true
    });

    this.viewer.scene.globe.enableLighting = true;

    // allow scripts to run in info box
    this.viewer.infoBox.frame.sandbox = this.viewer.infoBox.frame.sandbox + " allow-scripts";

    // switch to Touch instructions, as the control is mainly used on touch devices
    this.viewer.navigationHelpButton.viewModel.showTouch();

    console.log("#5 setView");
    var longitude = this.options.initialCenterPoint['longitude'];
    var latitude = this.options.initialCenterPoint['latitude'];

    if (longitude !== 0 && latitude !== 0) {

        var initialHeading = 0.0; // north
        var initialPitch = Cesium.Math.toRadians(-35);

        this.viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 5000.0),
            orientation: {
                initialHeading,
                initialPitch,
                roll: 0.0
            }
        });

        var altitude = this.options.initialCenterPoint['altitude'] || 0.0;

        this.zoomToLocation({
            longitude: longitude,
            latitude: latitude,
            altitude: altitude
        });
    }

    console.log("#6 location markers");
    this.pinBuilder = new Cesium.PinBuilder();

    var myLocationEntity = this.createEntity('My Position', '', Cesium.Color.GREEN, '../images/map-marker.svg', 0.0, 0.0);
    myLocationEntity.show = false;

    this.myLocationMarker = this.viewer.entities.add(myLocationEntity);

    // the zoom entity is invisible and transparent and is used for zoomToLocation() calls
    this.zoomEntity = this.viewer.entities.add({
        id: 'zoomEntity',
        position: Cesium.Cartesian3.fromDegrees(0.0, 0.0),
        point: {
            color: Cesium.Color.TRANSPARENT,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        show: false
    });

    // the find result entity is initially invisible
    var findResultEntity = this.createEntity('Find result', '', Cesium.Color.ORANGE, '../images/magnify.svg', 0.0, 0.0);
    findResultEntity.show = false;
    this.findResultMarker = this.viewer.entities.add(findResultEntity);

    console.log("#7 long tap handler");

    this.pickingHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.pickingHandler.setInputAction(this.onScreenTouchDown.bind(this), Cesium.ScreenSpaceEventType.LEFT_DOWN);
    this.pickingHandler.setInputAction(this.onScreenTouchUp.bind(this), Cesium.ScreenSpaceEventType.LEFT_UP);
}

/**
 * Called when the screen space event handler detected a touch-down event.
 * @param {object} movement movement info object
 */
MapView.prototype.onScreenTouchDown = function (movement) {

    this.currentLeftDownPosition = movement.position;
    this.currentLeftDownTime = new Date().getTime();
};

/**
 * Called when the screen space event handler detected a touch-up event.
 * @param {object} movement movement info object
 */
MapView.prototype.onScreenTouchUp = function (movement) {

    var deltaX = (this.currentLeftDownPosition.x - movement.position.x);
    var deltaY = (this.currentLeftDownPosition.y - movement.position.y);
    var deltaSquared = deltaX * deltaX + deltaY * deltaY;

    var deltaTime = new Date().getTime() - this.currentLeftDownTime;

    // when tap was longer than 1s and moved less than 10 pixels
    if (deltaTime > 1000 && deltaSquared < 10 * 10) {

        var ray = this.viewer.camera.getPickRay(movement.position);
        var cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        if (cartesian) {
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);

            this.onLongTap({
                latitude: Cesium.Math.toDegrees(cartographic.latitude),
                longitude: Cesium.Math.toDegrees(cartographic.longitude)
            });
        }
    }
};

/**
 * Creates a new imagery provider that uses the Thermal Skyways from https://thermal.kk7.ch/.
 * @returns {object} generated imagery provider object
 */
MapView.prototype.createThermalImageryProvider = function () {

    var url = 'https://thermal.kk7.ch/tiles/skyways_all/{z}/{x}/{reverseY}.png?src=https://github.com/vividos/WhereToFly';

    var creditText = 'Skyways &copy; <a href="https://thermal.kk7.ch/">thermal.kk7.ch</a>';

    var tilingScheme = new Cesium.WebMercatorTilingScheme();

    return new Cesium.UrlTemplateImageryProvider({
        url: Cesium.Resource.createIfNeeded(url),
        credit: new Cesium.Credit(creditText, true),
        tilingScheme: tilingScheme,
        tileWidth: 256,
        tileHeight: 256,
        minimumLevel: 0,
        maximumLevel: 12,
        rectangle: tilingScheme.rectangle
    });
};

/**
 * Sets new map imagery type
 * @param {string} imageryType imagery type constant; the following constants currently can be
 * used: 'OpenStreetMap'.
 */
MapView.prototype.setMapImageryType = function (imageryType) {

    console.log("setting new imagery type: " + imageryType);

    var layers = this.viewer.scene.imageryLayers;

    if (this.openStreetMapImageryLayer !== null)
        layers.remove(this.openStreetMapImageryLayer, false);

    if (this.bingMapsAerialWithLabelsImageryLayer !== null)
        layers.remove(this.bingMapsAerialWithLabelsImageryLayer, false);

    switch (imageryType) {
        case 'OpenStreetMap':
            if (this.openStreetMapImageryLayer === null)
                this.openStreetMapImageryLayer = layers.addImageryProvider(this.openStreetMapImageryProvider, 1);
            else
                layers.add(this.openStreetMapImageryLayer, 1);
            break;

        case 'BingMapsAerialWithLabels':
            if (this.bingMapsAerialWithLabelsImageryLayer === null)
                this.bingMapsAerialWithLabelsImageryLayer = layers.addImageryProvider(this.bingMapsAerialWithLabelsImageryProvider, 1);
            else
                layers.add(this.bingMapsAerialWithLabelsImageryLayer, 1);
            break;

        default:
            console.log('invalid imagery type: ' + imageryType);
            break;
    }
};

var slopeRamp = [0.0, 0.29, 0.5, Math.sqrt(2) / 2, 0.87, 0.91, 1.0];

/**
 * Generates a color ramp canvas element and returns it. From
 * https://cesiumjs.org/Cesium/Build/Apps/Sandcastle/index.html?src=Globe%20Materials.html
 * @returns {object} generated canvas object
 */
function getColorRamp() {
    var ramp = document.createElement('canvas');
    ramp.width = 100;
    ramp.height = 1;
    var ctx = ramp.getContext('2d');

    var values = slopeRamp;

    var grd = ctx.createLinearGradient(0, 0, 100, 0);
    grd.addColorStop(values[0], '#000000'); // black
    grd.addColorStop(values[1], '#2747E0'); // blue
    grd.addColorStop(values[2], '#D33B7D'); // pink
    grd.addColorStop(values[3], '#D33038'); // red
    grd.addColorStop(values[4], '#FF9742'); // orange
    grd.addColorStop(values[5], '#ffd700'); // yellow
    grd.addColorStop(values[6], '#ffffff'); // white

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 100, 1);

    return ramp;
}

/**
 * Sets up slope and contour lines materials for overlay types 'ContourLines' and
 * 'SlopeAndContourLines'. From
 * https://cesiumjs.org/Cesium/Build/Apps/Sandcastle/index.html?src=Globe%20Materials.html
 */
MapView.prototype.setupSlopeAndContourLines = function () {

    // Creates a material with contour lines only
    this.contourLinesMaterial = Cesium.Material.fromType('ElevationContour');

    this.contourLinesMaterial.uniforms.width = 1; // in pixels
    this.contourLinesMaterial.uniforms.spacing = 100; // in meters
    this.contourLinesMaterial.uniforms.color = Cesium.Color.BLUE.clone();

    // Creates a composite material with both slope shading and contour lines
    var material = new Cesium.Material({
        fabric: {
            type: 'SlopeColorContour',
            materials: {
                contourMaterial: {
                    type: 'ElevationContour'
                },
                slopeRampMaterial: {
                    type: 'SlopeRamp'
                }
            },
            components: {
                diffuse: 'contourMaterial.alpha == 0.0 ? slopeRampMaterial.diffuse : contourMaterial.diffuse',
                alpha: 'max(contourMaterial.alpha, slopeRampMaterial.alpha)'
            }
        },
        translucent: false
    });

    var contourUniforms = material.materials.contourMaterial.uniforms;
    contourUniforms.width = 1; // in pixels
    contourUniforms.spacing = 100; // in meters
    contourUniforms.color = Cesium.Color.BLUE.clone();

    var shadingUniforms = material.materials.slopeRampMaterial.uniforms;
    shadingUniforms.image = getColorRamp();

    this.slopeAndContourLinesMaterial = material;
};

/**
 * Sets new map overlay type
 * @param {string} overlayType overlay type constant; the following constants currently can be
 * used: 'None', 'ContourLines', 'SlopeAndContourLines', 'ThermalSkywaysKk7', 'BlackMarble'.
 */
MapView.prototype.setMapOverlayType = function (overlayType) {

    console.log("setting new map overlay type: " + overlayType);

    var layers = this.viewer.scene.imageryLayers;

    if (this.thermalSkywaysLayer !== null)
        layers.remove(this.thermalSkywaysLayer, false);

    if (this.blackMarbleLayer !== null)
        layers.remove(this.blackMarbleLayer, false);

    this.viewer.scene.globe.material = null;

    switch (overlayType) {
        case 'None':
            break;

        case 'ContourLines':
            this.viewer.scene.globe.material = this.contourLinesMaterial;
            break;

        case 'SlopeAndContourLines':
            this.viewer.scene.globe.material = this.slopeAndContourLinesMaterial;
            break;

        case 'ThermalSkywaysKk7':
            if (this.thermalSkywaysLayer === null) {
                this.thermalSkywaysLayer = layers.addImageryProvider(this.thermalSkywaysOverlay);
                this.thermalSkywaysLayer.alpha = 0.2; // 0.0 is transparent.  1.0 is opaque.
                this.thermalSkywaysLayer.brightness = 2.0; // > 1.0 increases brightness.  < 1.0 decreases.
            }
            else
                layers.add(this.thermalSkywaysLayer);
            break;

        case 'BlackMarble':
            if (this.blackMarbleLayer === null) {
                this.blackMarbleLayer = layers.addImageryProvider(this.blackMarbleOverlay);
                this.blackMarbleLayer.alpha = 0.5; // 0.0 is transparent.  1.0 is opaque.
                this.blackMarbleLayer.brightness = 2.0; // > 1.0 increases brightness.  < 1.0 decreases.
            }
            else
                layers.add(this.blackMarbleLayer);
            break;

        default:
            console.log('invalid map overlay type: ' + overlayType);
            break;
    }
};

/**
 * Sets new map shading mode
 * @param {string} shadingMode shading mode constant; the following constants currently can be
 * used: 'Fixed10Am', 'Fixed3Pm', 'CurrentTime', 'Ahead2Hours' and 'None'.
 */
MapView.prototype.setShadingMode = function (shadingMode) {

    console.log("setting new shading mode: " + shadingMode);

    var today = new Date();
    var now = Cesium.JulianDate.now();

    switch (shadingMode) {
        case 'Fixed10Am':
        case 'Fixed3Pm':
            today.setHours(shadingMode === 'Fixed10Am' ? 10 : 15, 0, 0, 0);
            var fixedTime = Cesium.JulianDate.fromDate(today);

            this.viewer.clockViewModel.startTime = fixedTime;
            this.viewer.clockViewModel.currentTime = fixedTime.clone();
            this.viewer.clockViewModel.endTime = fixedTime.clone();
            this.viewer.clockViewModel.clockStep = 0;
            break;

        case 'CurrentTime':
            var end = new Cesium.JulianDate();
            Cesium.JulianDate.addDays(now, 1, end);
            this.viewer.clockViewModel.startTime = now;
            this.viewer.clockViewModel.currentTime = now.clone();
            this.viewer.clockViewModel.endTime = end;
            this.viewer.clockViewModel.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
            break;

        case 'Ahead2Hours':
            var ahead = new Cesium.JulianDate();
            Cesium.JulianDate.addHours(now, 2, ahead);
            var end2 = new Cesium.JulianDate();
            Cesium.JulianDate.addDays(ahead, 1, end2);

            this.viewer.clockViewModel.startTime = ahead;
            this.viewer.clockViewModel.currentTime = ahead.clone();
            this.viewer.clockViewModel.endTime = end2;
            this.viewer.clockViewModel.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
            break;

        case 'None':
            break;

        default:
            console.log('invalid shading mode: ' + shadingMode);
    }

    this.viewer.scene.globe.enableLighting = shadingMode !== 'None';

    this.viewer.terrainShadows =
        shadingMode === 'None' ? Cesium.ShadowMode.DISABLED : Cesium.ShadowMode.RECEIVE_ONLY;
};

/**
 * Updates the "my location" marker on the map
 * @param {object} options Options to use for updating my location. The following object can be used:
 * { latitude: 123.45678, longitude: 9.87654, altitude:0.0, timestamp: '2018-01-29T21:06:00'
 *   displayLatitude: "123� 45.231'", displayLongitude: "9� 89.654'",
 *   displayTimestamp: "29.01.2018 21:06:00",
 *   zoomToLocation: true }
 */
MapView.prototype.updateMyLocation = function (options) {

    if (this.myLocationMarker === null) {
        console.log("warning: myLocationMarker not initialized yet");
        return;
    }

    console.log("updating my location: lat=" + options.latitude + ", long=" + options.longitude);

    this.myLocationMarker.show = true;
    this.myLocationMarker.position = Cesium.Cartesian3.fromDegrees(options.longitude, options.latitude);

    var text = '<h2><img height="48em" width="48em" src="images/map-marker.svg" style="vertical-align:middle" />My Position</h2>' +
        '<div>Latitude: ' + options.displayLatitude + '<br/>' +
        'Longitude: ' + options.displayLongitude + '<br/>' +
        'Accuracy: <span style="color:' + options.positionAccuracyColor + '">+/- ' + options.positionAccuracy + ' m</span><br/>' +
        (options.altitude !== undefined && options.altitude !== 0 ? 'Altitude: ' + options.altitude + 'm<br/>' : '') +
        'Time: ' + options.displayTimestamp +
        '</div>';

    text += '<img height="32em" width="32em" src="images/share-variant.svg" style="vertical-align:middle" />' +
        '<a href="javascript:parent.map.onShareMyLocation();">Share position</a></p>';

    this.myLocationMarker.description = text;

    if (options.zoomToLocation) {
        console.log("also zooming to my location");
        this.viewer.flyTo(
            this.myLocationMarker,
            {
                offset: new Cesium.HeadingPitchRange(
                    this.viewer.scene.camera.heading,
                    this.viewer.scene.camera.pitch,
                    5000.0)
            });
    }
};

/**
 * Zooms to given location, by flying to the location
 * @param {object} options Options to use for zooming. The following object can be used:
 * { latitude: 123.45678, longitude: 9.87654, altitude: 500 }
 */
MapView.prototype.zoomToLocation = function (options) {

    if (this.zoomEntity === undefined) {
        console.log("warning: zoomEntity not initialized yet");
        return;
    }

    console.log("zooming to: latitude=" + options.latitude + ", longitude=" + options.longitude + ", altitude=" + options.altitude);

    var altitude = options.altitude || 0.0;

    // zooming works by assinging the zoom entity a new position, making it
    // visible (but transparent), fly there and hiding it again
    this.zoomEntity.position = Cesium.Cartesian3.fromDegrees(options.longitude, options.latitude, altitude);

    this.zoomEntity.point.heightReference =
        altitude === 0.0 ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE;

    this.zoomEntity.show = true;

    console.log("zooming to: start flying");

    this.viewer.flyTo(
        this.zoomEntity,
        {
            offset: new Cesium.HeadingPitchRange(
                this.viewer.camera.heading,
                this.viewer.camera.pitch,
                5000.0)
        }).then(function () {
            this.zoomEntity.show = false;
            console.log("zooming to: flying finished");
        });
};

/**
 * Clears list of locations
 */
MapView.prototype.clearLocationList = function () {

    console.log("clearing location list");

    this.viewer.entities.removeAll();

    // re-add the special purpose entities
    if (this.myLocationMarker !== null)
        this.viewer.entities.add(this.myLocationMarker);

    if (this.findResultMarker !== null)
        this.viewer.entities.add(this.findResultMarker);

    if (this.zoomEntity !== null)
        this.viewer.entities.add(this.zoomEntity);
};

/**
 * Adds list of locations to the map, as marker pins
 * @param {array} locationList An array of location, each with the following object layout:
 * { id:"location-id", name:"Location Name", type:"LocationType", latitude: 123.45678, longitude: 9.87654, elevation:1234 }
 */
MapView.prototype.addLocationList = function (locationList) {

    console.log("adding location list, with " + locationList.length + " entries");

    for (var index in locationList) {

        var location = locationList[index];

        var text = '<h2><img height="48em" width="48em" src="' + this.imageUrlFromLocationType(location.type) + '" style="vertical-align:middle" />' +
            location.name +
            (location.elevation !== 0 ? ' ' + location.elevation + 'm' : '') +
            '</h2>';

        text += '<img height="32em" width="32em" src="images/directions.svg" style="vertical-align:middle" />' +
            '<a href="javascript:parent.map.onNavigateToLocation(\'' + location.id + '\');">Navigate here</a></p>';

        text += "<p>" + location.description + "</p>";

        var imagePath = '../' + this.imageUrlFromLocationType(location.type);

        var entity = this.createEntity(
            location.name + (location.elevation !== 0 ? ' ' + location.elevation + 'm' : ''),
            text,
            this.pinColorFromLocationType(location.type),
            imagePath,
            location.longitude,
            location.latitude);
        this.viewer.entities.add(entity);
    }
};

/**
 * Creates an entity object with given informations that can be placed into
 * the entities list.
 * @param {string} name Name of the entity
 * @param {string} description Longer description text
 * @param {string} pinColor Pin color, one of the Cesium.Color.Xxx constants
 * @param {string} pinImage Relative link URL to SVG image to use in pin
 * @param {double} longitude Longitude of entity
 * @param {double} latitude Latitude of entity
 * @returns {object} entity description, usable for viewer.entities.add()
 */
MapView.prototype.createEntity = function (name, description, pinColor, pinImage, longitude, latitude) {

    var url = Cesium.buildModuleUrl(pinImage);

    return {
        name: name,
        description: description,
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
        billboard: {
            image: this.pinBuilder.fromUrl(url, pinColor, 48),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    };
};

/**
 * Returns a relative image Url for given location type
 * @param {string} locationType location type
 * @returns {string} relative image Url
 */
MapView.prototype.imageUrlFromLocationType = function (locationType) {

    switch (locationType) {
        case 'Summit': return 'images/mountain-15.svg';
        //case 'Pass': return '';
        case 'Lake': return 'images/water-15.svg';
        case 'Bridge': return 'images/bridge.svg';
        case 'Viewpoint': return 'images/attraction-15.svg';
        case 'AlpineHut': return 'images/home-15.svg';
        case 'Restaurant': return 'images/restaurant-15.svg';
        case 'Church': return 'images/church.svg';
        case 'Castle': return 'images/castle.svg';
        //case 'Cave': return '';
        case 'Information': return 'images/information-outline.svg';
        case 'PublicTransportBus': return 'images/bus.svg';
        case 'PublicTransportTrain': return 'images/train.svg';
        case 'Parking': return 'images/parking.svg';
        //case 'ViaFerrata': return '';
        case 'CableCar': return 'images/aerialway-15.svg';
        case 'FlyingTakeoff': return 'images/paragliding.svg';
        case 'FlyingLandingPlace': return 'images/paragliding.svg';
        case 'FlyingWinchTowing': return 'images/paragliding.svg';
        //case 'LiveWaypoint': return '';
        default: return 'images/map-marker.svg';
    }
};

/**
 * Returns a pin color for given location type
 * @param {string} locationType location type
 * @returns {string} Cesium.Color constant
 */
MapView.prototype.pinColorFromLocationType = function (locationType) {

    switch (locationType) {
        case 'FlyingTakeoff': return Cesium.Color.YELLOWGREEN;
        case 'FlyingLandingPlace': return Cesium.Color.ORANGE;
        case 'FlyingWinchTowing': return Cesium.Color.CORNFLOWERBLUE;
        default: return Cesium.Color.BLUE;
    }
};

/**
 * Shows a find result pin, with a link to add a waypoint for this result.
 * @param {Object} [options] An object with the following properties:
 * @param {String} [options.name] Name of the find result
 * @param {Number} [options.latitude] Latitude of the find result
 * @param {Number} [options.longitude] Longitude of the find result
 * @param {Number} [options.displayLatitude] Display text for latitude
 * @param {Number} [options.displayLongitude] Display text for longitude
 */
MapView.prototype.showFindResult = function (options) {

    if (this.findResultMarker === undefined) {
        console.log("warning: findResultMarker not initialized yet");
        return;
    }

    console.log("showing find result for \"" + options.name +
        "\", at latitude " + options.latitude + ", longitude " + options.longitude);

    var text = '<h2><img height="48em" width="48em" src="images/magnify.svg" style="vertical-align:middle" />' + options.name + '</h2>' +
        '<div>Latitude: ' + options.displayLatitude + '<br/>' +
        'Longitude: ' + options.displayLongitude +
        '</div>';

    var optionsText = '{ name: \'' + options.name + '\', latitude:' + options.latitude + ', longitude:' + options.longitude + '}';

    text += '<img height="32em" width="32em" src="images/map-marker-plus.svg" style="vertical-align:middle" />' +
        '<a href="javascript:parent.map.onAddFindResult(' + optionsText + ');">Add as waypoint</a></p>';

    this.findResultMarker.description = text;
    this.findResultMarker.position = Cesium.Cartesian3.fromDegrees(options.longitude, options.latitude);
    this.findResultMarker.show = true;

    this.viewer.flyTo(
        this.findResultMarker,
        {
            offset: new Cesium.HeadingPitchRange(
                this.viewer.camera.heading,
                this.viewer.camera.pitch,
                5000.0)
        });
};

/**
 * Adds list of tracks to the map
 * @param {array} listOfTracks An array of tracks
 */
MapView.prototype.addTracksList = function (listOfTracks) {

    console.log("adding list of tracks, with " + listOfTracks.length + " entries");

    // TODO implement
};

/**
 * Called by the marker pin link, in order to start navigating to the location.
 * @param {string} locationId Location ID of location to navigate to
 */
MapView.prototype.onNavigateToLocation = function (locationId) {

    console.log("navigation to location started: id=" + locationId);

    if (this.options.callback !== undefined)
        this.options.callback('onNavigateToLocation', locationId);
};

/**
 * Called by the "my position" pin link, in order to share the current location.
 */
MapView.prototype.onShareMyLocation = function () {

    console.log("sharing my location started");

    if (this.options.callback !== undefined)
        this.options.callback('onShareMyLocation');
};

/**
 * Called by the "add find result" pin link, in order to add the find result as a waypoint.
 * @param {Object} [options] An object with the following properties:
 * @param {String} [options.name] Name of the find result
 * @param {Number} [options.latitude] Latitude of the find result
 * @param {Number} [options.longitude] Longitude of the find result
 */
MapView.prototype.onAddFindResult = function (options) {

    console.log("adding find result as waypoint");

    if (this.options.callback !== undefined)
        this.options.callback('onAddFindResult', options);

    this.findResultMarker.show = false;

    // hide the info box
    this.viewer.selectedEntity = undefined;
};

/**
 * Called when a long-tap occured on the map.
 * @param {Object} [options] An object with the following properties:
 * @param {Number} [options.latitude] Latitude of the long tap
 * @param {Number} [options.longitude] Longitude of the long tap
 */
MapView.prototype.onLongTap = function (options) {
    console.log("long-tap occured: lat=" + options.latitude + ", long=" + options.longitude);

    if (this.options.callback !== undefined)
        this.options.callback('onLongTap', options);
};
