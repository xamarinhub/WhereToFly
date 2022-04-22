// Cesium.js
import * as Cesium from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

// local
import * as Utils from './utils.js';
import { HeightProfileView } from './heightProfileView.js';
import '../css/mapView.css';

export class MapView {

    /**
     * Console log style
     */
    static consoleLogStyle = "background: lightgreen; color: darkblue; padding: 1px 3px; border-radius: 3px;";

    /**
     * Creates a new instance of MapView
     * @constructor
     * @param {object} [options] Options to use for initializing map view
     * @param {String} [options.id] DOM ID of the div element to create map view in
     * @param {String} [options.messageBandId] DOM ID of the message band div element
     * @param {String} [options.liveTrackToolbarId] DOM ID of the live track toolbar div element
     * @param {object} [options.initialCenterPoint] initial center point of map view
     * @param {double} [options.initialCenterPoint.latitude] latitude of center point
     * @param {double} [options.initialCenterPoint.longitude] longitude of center point
     * @param {Number} [options.initialViewingDistance] initial viewing distance
     * @param {Boolean} [options.hasMouse] indicates if the device this is running supports a mouse
     * @param {Boolean} [options.useAsynchronousPrimitives] indicates if asynchronous primitives
     * should be used
     * @param {Boolean} [options.useEntityClustering] indicates if entity clustering should be used
     * @param {String} [options.bingMapsApiKey] Bing maps API key to use
     * @param {String} [options.cesiumIonApiKey] Cesium Ion API key to use
     * @param {Function} [options.callback] callback function to use for calling back to C# code
     */
    constructor(options) {

        console.groupCollapsed("%cMapView%ccreating new 3D map view", MapView.consoleLogStyle);
        console.time("ctor");

        this.options = Object.assign({
            id: 'mapElement',
            liveTrackToolbarId: 'liveTrackToolbar',
            initialCenterPoint: { latitude: 47.67, longitude: 11.88 },
            initialViewingDistance: 5000.0,
            hasMouse: false,
            useAsynchronousPrimitives: true,
            useEntityClustering: true
        }, options);

        this.options.bingMapsApiKey = this.options.bingMapsApiKey || 'AuuY8qZGx-LAeruvajcGMLnudadWlphUWdWb0k6N6lS2QUtURFk3ngCjIXqqFOoe';
        this.options.cesiumIonApiKey = this.options.cesiumIonApiKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZWMzMjU5NC00MTg4LTQwYmEtYWNhYi01MDYwMWQyZDIxNTUiLCJpZCI6NjM2LCJpYXQiOjE1MjUzNjQ5OTN9.kXik5Mg_-01LBkN-5OTIDpwlMcuE2noRaaHrqjhbaRE';

        if (this.options.callback === undefined)
            this.options.callback = Utils.callAction;

        this.showMessageBand("Initializing map...");

        console.log("#1 imagery provider");

        Cesium.Ion.defaultAccessToken = this.options.cesiumIonApiKey;

        this.openStreetMapImageryLayer = null;
        this.openStreetMapImageryProvider = new Cesium.OpenStreetMapImageryProvider({
            url: 'https://{s}.tile.openstreetmap.org/',
            subdomains: 'abc',
            maximumLevel: 18
        });

        this.bingMapsAerialWithLabelsImageryLayer = null;
        this.bingMapsAerialWithLabelsImageryProvider = null;

        this.openTopoMapImageryLayer = null;
        this.openTopoMapImageryProvider = new Cesium.OpenStreetMapImageryProvider({
            url: 'https://{s}.tile.opentopomap.org/',
            subdomains: 'abc',
            maximumLevel: 18,
            credits: '<code>Kartendaten: &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM | Kartendarstellung: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)</code>'
        });

        this.sentinel2ImageryLayer = null;
        this.sentinel2ImageryProvider = null;

        this.openFlightMapsImageryLayer = null;
        var airacId = MapView.calcCurrentAiracId();
        this.openFlightMapsImageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: 'https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=' + airacId + '/aero/latest',
            tileWidth: 512,
            tileHeight: 512,
            maximumLevel: 11,
            enablePickFeatures: false,
            credit: '(c) <a href="https://openflightmaps.org/" target="_blank">Open Flightmaps association</a>, (c) OpenStreetMap contributors, NASA elevation data'
        });

        this.setupSlopeAndContourLines();

        this.thermalSkywaysLayer = null;
        this.thermalSkywaysOverlay = this.createThermalImageryProvider();
        this.thermalSkywaysOverlay.readyPromise.then(success => {
            MapView.log("thermal maps url: " + this.thermalSkywaysOverlay.url);
        });

        this.blackMarbleLayer = null;
        this.blackMarbleOverlay = null;

        console.log("#2 terrain provider");
        this.initTerrainProvider();

        console.log("#3 clock");
        var now = Cesium.JulianDate.now();
        var start = Cesium.JulianDate.addDays(now, -1, new Cesium.JulianDate());
        var end = Cesium.JulianDate.addDays(now, 1, new Cesium.JulianDate());

        var clock = new Cesium.Clock({
            startTime: start,
            endTime: end,
            currentTime: now.clone(),
            clockStep: Cesium.ClockStep.SYSTEM_CLOCK,
            clockRange: Cesium.ClockRange.CLAMPED
        });

        console.log("#4 viewer");
        var webGLPowerPreference = 'low-power';

        this.viewer = new Cesium.Viewer(this.options.id, {
            imageryProvider: this.openStreetMapImageryProvider,
            terrainProvider: null, // is later set when readyPromise completes
            clockViewModel: new Cesium.ClockViewModel(clock),
            baseLayerPicker: false,
            sceneModePicker: false,
            animation: false,
            geocoder: false,
            homeButton: false,
            fullscreenButton: false,
            timeline: false,
            skyBox: false,
            scene3DOnly: true,
            requestRenderMode: true,
            // when no animation happens, render after this number of seconds
            maximumRenderTimeChange: 60.0,
            contextOptions: {
                requestWebgl2: true,
                webgl: {
                    powerPreference: webGLPowerPreference
                }
            }
        });

        console.log("#5 globe options");

        var globe = this.viewer.scene.globe;
        globe.enableLighting = true;
        globe.backFaceCulling = false;
        globe.showSkirts = false;
        globe.dynamicAtmosphereLighting = false;

        // clip walls against terrain
        globe.depthTestAgainstTerrain = true;

        // increase resolution for all image layer
        // https://github.com/CesiumGS/cesium/issues/3279
        globe.maximumScreenSpaceError = 1.666;

        // allow scripts to run in info box
        console.log("#6 sandboxing");
        this.viewer.infoBox.frame.sandbox = this.viewer.infoBox.frame.sandbox + " allow-scripts";
        this.viewer.infoBox.frame.setAttribute('src', 'about:blank'); // needed to apply new sandbox attributes

        if (!options.hasMouse) {
            // switch to Touch instructions, as the control is only used on touch devices
            this.viewer.navigationHelpButton.viewModel.showTouch();
        }

        console.log("#7 setView");
        var longitude = this.options.initialCenterPoint['longitude'];
        var latitude = this.options.initialCenterPoint['latitude'];

        if (longitude !== 0 && latitude !== 0) {

            var initialHeading = 0.0; // north
            var initialPitch = Cesium.Math.toRadians(-35);
            var initialViewingDistance = this.options.initialViewingDistance || 5000.0;

            this.viewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, initialViewingDistance),
                orientation: {
                    initialHeading,
                    initialPitch,
                    roll: 0.0
                }
            });

            var altitude = this.options.initialCenterPoint['altitude'] || 0.0;

            this.flyTo({
                longitude: longitude,
                latitude: latitude,
                altitude: altitude
            });
        }

        console.log("#8 location markers");
        this.initLocationMarkers();

        console.log("#9 long tap handler");

        this.pickingHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

        this.pickingHandler.setInputAction(this.onScreenTouchDown.bind(this), Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.pickingHandler.setInputAction(this.onScreenTouchUp.bind(this), Cesium.ScreenSpaceEventType.LEFT_UP);

        if (options.hasMouse) {
            this.pickingHandler.setInputAction(this.onScreenRightClick.bind(this), Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        }

        console.log("#10 entity clustering");
        this.setupEntityClustering();

        console.log("#11 other stuff");

        this.heightProfileView = null;

        // add a dedicated track primitives collection, as we can't call viewer.scene.primitives.removeAll()
        this.trackPrimitivesCollection = new Cesium.PrimitiveCollection({
            show: true,
            destroyPrimitives: true
        });

        this.viewer.scene.primitives.add(this.trackPrimitivesCollection);

        this.trackIdToTrackDataMap = {};

        this.dataSourceMap = {};

        this.osmBuildingsTileset = null;

        this.inOnCloseHandler = false;

        this.locationDataSource = new Cesium.CustomDataSource('locations');
        this.locationDataSource.clustering = this.clustering;
        this.viewer.dataSources.add(this.locationDataSource);

        this.liveTrackDataSource = new Cesium.CustomDataSource('livetrack');
        this.viewer.dataSources.add(this.liveTrackDataSource);

        this.currentLiveTrackTimeOffset = -180;

        this.setupLiveTrackToolbar();

        // swap out console.error for logging purposes
        var that = this;
        var oldLog = console.error;
        console.error = function (message) {
            that.onConsoleErrorMessage(message);
            oldLog.apply(console, arguments);
        };

        this.onMapInitialized();

        this.hideMessageBand();

        console.timeEnd("ctor");
        console.groupEnd();
    }

    /**
     * Logs a message to the console, just like console.log, but with styled output.
     */
    static log(message) {
        console.log("%cMapView%c" + message, MapView.consoleLogStyle);
    }

    /**
     * Called to initialize terrain provider, which may not available when
     * offline.
     */
    async initTerrainProvider() {

        try {
            let terrainProvider = Cesium.createWorldTerrain({
                requestWaterMask: false,
                requestVertexNormals: true
            });

            await terrainProvider.readyPromise;
            this.viewer.terrainProvider = terrainProvider;
            MapView.log("terrain provider is ready!");

        } catch (error) {

            // waiting for onNetworkConnectivityChanged
            console.error("MapView.initTerrainProvider: failed init'ing terrain provider", error);
        }
    }

    /**
     * Initializes location markers.
     */
    async initLocationMarkers() {
        this.myLocationMarker = null;

        this.pinBuilder = new Cesium.PinBuilder();

        try {
            let myLocationEntity = await this.createEntity(
                undefined,
                'My Position',
                '',
                Cesium.Color.GREEN,
                'images/map-marker.svg',
                0.0,
                0.0);

            myLocationEntity.show = false;
            this.myLocationMarker = this.viewer.entities.add(myLocationEntity);

        } catch (error) {
            console.error("MapView: #8 error creating my location entity: " + error);
        }

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

        // the track marker is initially invisible and only used when a track is tapped
        try {
            let trackEntity = await this.createEntity(
                'trackMarker',
                'Track point',
                '',
                Cesium.Color.PURPLE,
                'images/map-marker-distance.svg',
                0.0,
                0.0);

            trackEntity.show = false;
            trackEntity.billboard.heightReference = Cesium.HeightReference.NONE;
            this.trackMarker = this.viewer.entities.add(trackEntity);
        } catch (error) {
            console.error("MapView: #8 error creating find result entity: " + error);
        }

        // the find result entity is initially invisible
        try {

            let findResultEntity = await this.createEntity(
                undefined,
                'Find result',
                '',
                Cesium.Color.ORANGE,
                'images/magnify.svg',
                0.0,
                0.0);
            findResultEntity.show = false;
            this.findResultMarker = this.viewer.entities.add(findResultEntity);
        } catch (error) {
            console.error("MapView: #8 error creating find result entity: " + error);
        }
    }

    /**
     * Called when the screen space event handler detected a touch-down event.
     * @param {object} movement movement info object
     */
    onScreenTouchDown(movement) {

        this.currentLeftDownPosition = movement.position;
        this.currentLeftDownTime = new Date().getTime();
    }

    /**
     * Called when the screen space event handler detected a touch-up event.
     * @param {object} movement movement info object
     */
    onScreenTouchUp(movement) {

        var deltaX = this.currentLeftDownPosition.x - movement.position.x;
        var deltaY = this.currentLeftDownPosition.y - movement.position.y;
        var deltaSquared = deltaX * deltaX + deltaY * deltaY;

        var deltaTime = new Date().getTime() - this.currentLeftDownTime;

        // check if tap was longer than 600ms and moved less than 10 pixels
        var longTapDetected = false;
        if (deltaTime > 600 && deltaSquared < 10 * 10) {

            var ray = this.viewer.camera.getPickRay(movement.position);
            var cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
            if (cartesian) {
                var cartographic = Cesium.Cartographic.fromCartesian(cartesian);

                longTapDetected = true;
                this.onLongTap({
                    latitude: Cesium.Math.toDegrees(cartographic.latitude),
                    longitude: Cesium.Math.toDegrees(cartographic.longitude),
                    altitude: cartographic.height
                });
            }
        }

        // check if user tapped a track primitive
        if (!longTapDetected) {
            var feature = this.viewer.scene.pick(movement.position, 10, 10);
            if (feature !== undefined && feature.id !== undefined && typeof feature.id === 'string') {
                var trackId = feature.id.replace('track-', '');
                MapView.log("picked track " + trackId);
                this.showTrackHeightProfile(trackId);
            }
        }
    }

    /**
     * Called when the screen space event handler detected a right-click event.
     * @param {object} movement movement info object
     */
    onScreenRightClick(movement) {

        var ray = this.viewer.camera.getPickRay(movement.position);
        var cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        if (cartesian) {
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);

            this.onLongTap({
                latitude: Cesium.Math.toDegrees(cartographic.latitude),
                longitude: Cesium.Math.toDegrees(cartographic.longitude),
                altitude: cartographic.height
            });
        }
    }

    /**
     * Creates a new imagery provider that uses the Thermal Skyways from https://thermal.kk7.ch/.
     * @returns {object} generated imagery provider object
     */
    createThermalImageryProvider() {

        var url = 'https://thermal.kk7.ch/tiles/skyways_all/{z}/{x}/{reverseY}.png?src=https://github.com/vividos/WhereToFly';

        var creditText = 'Skyways &copy; <a href="https://thermal.kk7.ch/">thermal.kk7.ch</a>';

        var tilingScheme = new Cesium.WebMercatorTilingScheme();

        return new Cesium.UrlTemplateImageryProvider({
            url: url,
            credit: new Cesium.Credit(creditText, false),
            tilingScheme: tilingScheme,
            tileWidth: 256,
            tileHeight: 256,
            minimumLevel: 0,
            maximumLevel: 12,
            rectangle: tilingScheme.rectangle
        });
    }

    /**
     * Sets up entity clustering, showing custom pins for clustered locations when
     * too far away.
     */
    setupEntityClustering() {

        this.clustering = new Cesium.EntityCluster({
            enabled: this.options.useEntityClustering,
            minimumClusterSize: 5,
            pixelRange: 40
        });

        // When EntityCluster is added to more than one DataSource, it will try to
        // destroy the EntityCluster object; prevent that here. Ugly workaround!
        // See: https://github.com/CesiumGS/cesium/issues/9336
        this.clustering.destroy = function () {
            // do nothing
        };

        var pinBuilder = new Cesium.PinBuilder();
        this.clustering.pin50 = pinBuilder.fromText("50+", Cesium.Color.RED, 48).toDataURL();
        this.clustering.pin40 = pinBuilder.fromText("40+", Cesium.Color.RED, 48).toDataURL();
        this.clustering.pin30 = pinBuilder.fromText("30+", Cesium.Color.RED, 48).toDataURL();
        this.clustering.pin20 = pinBuilder.fromText("20+", Cesium.Color.RED, 48).toDataURL();
        this.clustering.pin10 = pinBuilder.fromText("10+", Cesium.Color.RED, 48).toDataURL();

        this.clustering.singleDigitPins = new Array(8);
        for (var i = 0; i < this.clustering.singleDigitPins.length; ++i) {
            this.clustering.singleDigitPins[i] = pinBuilder
                .fromText("" + (i + 2), Cesium.Color.RED, 48).toDataURL();
        }

        var that = this;
        this.clustering.clusterEvent.addEventListener(
            function (clusteredEntities, cluster) {
                that.onNewCluster(clusteredEntities, cluster);
            });
    }

    /**
     * Called when a cluster of entities will be displayed
     * @param {any} clusteredEntities
     * @param {any} cluster
     */
    onNewCluster(clusteredEntities, cluster) {

        cluster.label.show = false;
        cluster.billboard.show = true;
        cluster.billboard.id = "cluster-billboard-" + cluster.label.id;
        cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
        cluster.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;

        if (clusteredEntities.length >= 50)
            cluster.billboard.image = this.clustering.pin50;
        else if (clusteredEntities.length >= 40)
            cluster.billboard.image = this.clustering.pin40;
        else if (clusteredEntities.length >= 30)
            cluster.billboard.image = this.clustering.pin30;
        else if (clusteredEntities.length >= 20)
            cluster.billboard.image = this.clustering.pin20;
        else if (clusteredEntities.length >= 10)
            cluster.billboard.image = this.clustering.pin10;
        else
            cluster.billboard.image =
                this.clustering.singleDigitPins[clusteredEntities.length - 2];
    }

    /**
     * Sets up the live track toolbar to show when one or more live tracks are
     * present. The toolbar consists of a slider to adjust the time offset into
     * the past, a text div displaying the time offset and a button to reset the
     * time offset to the default value.
     */
    setupLiveTrackToolbar() {

        if (this.options.liveTrackToolbarId === undefined)
            return;

        var toolbar = document.getElementById(this.options.liveTrackToolbarId);

        // add title
        var titleDiv = document.createElement('div');
        titleDiv.classList.add('livetrack-toolbar-title');
        titleDiv.innerText = 'Live Tracking';
        toolbar.appendChild(titleDiv);

        // add slider
        var sliderCont = document.createElement('div');
        sliderCont.classList.add('livetrack-slider-container');
        sliderCont.innerHTML = 'Time offset';

        var sliderInput = document.createElement('input');
        sliderInput.type = 'range';
        sliderInput.min = -900;
        sliderInput.max = 0;
        sliderInput.value = this.currentLiveTrackTimeOffset;
        sliderInput.classList.add('livetrack-slider');

        var that = this;
        sliderInput.oninput = function () {
            var timeOffset = parseInt(this.value, 10);
            that.setLiveTrackTime(timeOffset);
        }
        sliderCont.appendChild(sliderInput);

        // slider text
        var sliderText = document.createElement('div');
        sliderText.id = 'liveTrackSliderText';
        sliderCont.appendChild(sliderText);

        toolbar.appendChild(sliderCont);

        // add toolbar buttons
        var toolbarCont = document.createElement('div');
        toolbarCont.classList.add('livetrack-toolbar-button-container');

        // reset button
        var resetButton = document.createElement('div');
        resetButton.classList.add('livetrack-toolbar-button');
        resetButton.onclick = function () {
            that.setLiveTrackTime(-180);
            sliderInput.value = that.currentLiveTrackTimeOffset;
        }

        // reset button image
        var resetButtonImg = document.createElement('img');
        resetButtonImg.src = 'images/timeline-clock-outline.svg';
        resetButtonImg.classList.add('livetrack-toolbar-button-image');
        resetButton.appendChild(resetButtonImg);
        toolbarCont.appendChild(resetButton);

        toolbar.appendChild(toolbarCont);
    }

    /**
     * Displays the live track toolbar, e.g. when a live track was loaded.
     */
    showLiveTrackToolbar() {

        if (this.options.liveTrackToolbarId === undefined)
            return;

        var toolbar = document.getElementById(this.options.liveTrackToolbarId);

        toolbar.style.display = 'flex';
    }

    /**
     * Hides the live track toolbar, e.g. when no live tracks are displayed anymore.
     */
    hideLiveTrackToolbar() {

        if (this.options.liveTrackToolbarId === undefined)
            return;

        var toolbar = document.getElementById(this.options.liveTrackToolbarId);

        toolbar.style.display = 'none';
    }

    /**
     * Updates scene by requesting rendering from scene. This can be used to
     * update the view, e.g. when a pin was added or removed, and CesiumJS
     * wouldn't update the scene itself.
     */
    updateScene(imageryType) {
        this.viewer.scene.requestRender();
    }

    /**
     * Shows message band with given text.
     * @param {String} messageText message text to show
     */
    showMessageBand(messageText) {

        if (this.options.messageBandId === undefined)
            return;

        var bandElement = document.getElementById(this.options.messageBandId);
        if (bandElement === undefined)
            return;

        bandElement.style.opacity = '0';
        bandElement.style.display = 'flex';

        setTimeout(function () {
            bandElement.style.opacity = '0.7';
        }, 1);

        bandElement.innerHTML = messageText;
    }

    /**
     * Hides message band again.
     */
    hideMessageBand() {

        if (this.options.messageBandId === undefined)
            return;

        var bandElement = document.getElementById(this.options.messageBandId);
        if (bandElement !== undefined) {
            bandElement.style.opacity = '0.0';

            setTimeout(function () {
                bandElement.style.display = 'none';
            }, 700);
        }

    }

    /**
     * Sets new map imagery type
     * @param {string} imageryType imagery type constant; the following constants currently can be
     * used: 'OpenStreetMap'.
     */
    setMapImageryType(imageryType) {

        MapView.log("setting new imagery type: " + imageryType);

        var layers = this.viewer.scene.imageryLayers;

        if (this.openStreetMapImageryLayer !== null)
            layers.remove(this.openStreetMapImageryLayer, false);

        if (this.bingMapsAerialWithLabelsImageryLayer !== null)
            layers.remove(this.bingMapsAerialWithLabelsImageryLayer, false);

        if (this.openTopoMapImageryLayer !== null)
            layers.remove(this.openTopoMapImageryLayer, false);

        if (this.sentinel2ImageryLayer !== null)
            layers.remove(this.sentinel2ImageryLayer, false);

        if (this.openFlightMapsImageryLayer !== null)
            layers.remove(this.openFlightMapsImageryLayer, false);

        switch (imageryType) {
            case 'OpenStreetMap':
                if (this.openStreetMapImageryLayer === null)
                    this.openStreetMapImageryLayer = layers.addImageryProvider(this.openStreetMapImageryProvider, 1);
                else
                    layers.add(this.openStreetMapImageryLayer, 1);
                break;

            case 'BingMapsAerialWithLabels':
                if (this.bingMapsAerialWithLabelsImageryLayer === null) {

                    // lazy initialize provider
                    if (this.bingMapsAerialWithLabelsImageryProvider === null)
                        this.bingMapsAerialWithLabelsImageryProvider = new Cesium.BingMapsImageryProvider({
                            url: 'https://dev.virtualearth.net',
                            key: this.options.bingMapsApiKey,
                            mapStyle: Cesium.BingMapsStyle.AERIAL_WITH_LABELS_ON_DEMAND
                        });

                    this.bingMapsAerialWithLabelsImageryLayer = layers.addImageryProvider(this.bingMapsAerialWithLabelsImageryProvider, 1);
                }
                else
                    layers.add(this.bingMapsAerialWithLabelsImageryLayer, 1);
                break;

            case 'OpenTopoMap':
                if (this.openTopoMapImageryLayer === null)
                    this.openTopoMapImageryLayer = layers.addImageryProvider(this.openTopoMapImageryProvider, 1);
                else
                    layers.add(this.openTopoMapImageryLayer, 1);
                break;

            case 'Sentinel2':
                if (this.sentinel2ImageryLayer === null) {

                    // lazy initialize provider
                    if (this.sentinel2ImageryProvider === null)
                        this.sentinel2ImageryProvider = new Cesium.IonImageryProvider({ assetId: 3954 });

                    this.sentinel2ImageryLayer = layers.addImageryProvider(this.sentinel2ImageryProvider, 1);
                }
                else
                    layers.add(this.sentinel2ImageryLayer, 1);
                break;

            case 'OpenFlightMaps':
                if (this.openFlightMapsImageryLayer === null)
                    this.openFlightMapsImageryLayer = layers.addImageryProvider(this.openFlightMapsImageryProvider, 1);
                else
                    layers.add(this.openFlightMapsImageryLayer, 1);
                break;

            default:
                console.warn('MapView.setMapImageryType: invalid imagery type: ' + imageryType);
                break;
        }

        this.updateScene();
    }

    static slopeRamp = [0.0, 0.29, 0.5, Math.sqrt(2) / 2, 0.87, 0.91, 1.0];

    /**
     * Generates a color ramp canvas element and returns it. From
     * https://cesiumjs.org/Cesium/Build/Apps/Sandcastle/index.html?src=Globe%20Materials.html
     * @returns {object} generated canvas object
     */
    static getColorRamp() {
        var ramp = document.createElement('canvas');
        ramp.width = 100;
        ramp.height = 1;
        var ctx = ramp.getContext('2d');

        var values = MapView.slopeRamp;

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
    setupSlopeAndContourLines() {

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
        shadingUniforms.image = MapView.getColorRamp();

        this.slopeAndContourLinesMaterial = material;
    }

    /**
     * Sets new map overlay type
     * @param {string} overlayType overlay type constant; the following constants currently can be
     * used: 'None', 'ContourLines', 'SlopeAndContourLines', 'ThermalSkywaysKk7', 'BlackMarble'.
     */
    setMapOverlayType(overlayType) {

        MapView.log("setting new map overlay type: " + overlayType);

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
                    if (this.blackMarbleOverlay === null) {
                        // The Earth at Night, also known as Black Marble 2017 and Night Lights
                        this.blackMarbleOverlay = new Cesium.IonImageryProvider({ assetId: 3812 });
                    }

                    this.blackMarbleLayer = layers.addImageryProvider(this.blackMarbleOverlay);
                    this.blackMarbleLayer.alpha = 0.5; // 0.0 is transparent.  1.0 is opaque.
                    this.blackMarbleLayer.brightness = 2.0; // > 1.0 increases brightness.  < 1.0 decreases.
                }
                else
                    layers.add(this.blackMarbleLayer);
                break;

            default:
                console.warn('MapView.setMapOverlayType: invalid map overlay type: ' + overlayType);
                break;
        }

        this.updateScene();
    }

    /**
     * Sets new map shading mode
     * @param {string} shadingMode shading mode constant; the following constants currently can be
     * used: 'Fixed10Am', 'Fixed3Pm', 'CurrentTime', 'Ahead6Hours' and 'None'.
     */
    setShadingMode(shadingMode) {

        this.lastShadingMode = shadingMode;

        if (this.viewer.scene.requestRenderMode === false) {
            MapView.log("ignored setting shading mode; currently showing live track(s)");
            return;
        }

        MapView.log("setting new shading mode: " + shadingMode);

        var today = new Date();
        var now = Cesium.JulianDate.now();
        var start = Cesium.JulianDate.addDays(now, -1, new Cesium.JulianDate());

        switch (shadingMode) {
            case 'Fixed10Am':
            case 'Fixed3Pm':
                today.setHours(shadingMode === 'Fixed10Am' ? 10 : 15, 0, 0, 0);
                var fixedTime = Cesium.JulianDate.fromDate(today);

                this.viewer.clockViewModel.startTime = fixedTime;
                this.viewer.clockViewModel.currentTime = fixedTime.clone();
                this.viewer.clockViewModel.endTime = fixedTime.clone();
                this.viewer.clockViewModel.clockStep = 0;
                this.viewer.clockViewModel.shouldAnimate = false;
                break;

            case 'CurrentTime':
                var end = Cesium.JulianDate.addDays(now, 1, new Cesium.JulianDate());

                this.viewer.clockViewModel.startTime = start;
                this.viewer.clockViewModel.currentTime = now.clone();
                this.viewer.clockViewModel.endTime = end;
                this.viewer.clockViewModel.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
                this.viewer.clockViewModel.shouldAnimate = true;
                break;

            case 'Ahead6Hours':
                var ahead = Cesium.JulianDate.addHours(now, 6, new Cesium.JulianDate());
                var end2 = Cesium.JulianDate.addDays(ahead, 1, new Cesium.JulianDate());

                this.viewer.clockViewModel.startTime = ahead;
                this.viewer.clockViewModel.currentTime = ahead.clone();
                this.viewer.clockViewModel.endTime = end2;
                this.viewer.clockViewModel.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
                this.viewer.clockViewModel.shouldAnimate = true;
                break;

            case 'None':
                this.viewer.clockViewModel.shouldAnimate = false;
                break;

            default:
                console.warn('MapView.setShadingMode: invalid shading mode: ' + shadingMode);
                break;
        }

        this.viewer.scene.globe.enableLighting = shadingMode !== 'None';

        this.viewer.terrainShadows =
            shadingMode === 'None' ? Cesium.ShadowMode.DISABLED : Cesium.ShadowMode.RECEIVE_ONLY;

        this.updateScene();
    }

    /**
     * Sets if entity clustering is used
     * @param {boolean} useEntityClustering true when entity clustering should be used
     */
    setEntityClustering(useEntityClustering) {

        this.options.useEntityClustering = useEntityClustering;
        this.clustering.enabled = useEntityClustering;

        if (useEntityClustering) {
            // force re-clustering
            var lastPixelRange = this.clustering.pixelRange;
            this.clustering.pixelRange = 0;
            this.clustering.pixelRange = lastPixelRange;
        }

        this.updateScene();
    }

    /**
     * Updates the "my location" marker on the map
     * @param {object} [options] Options to use for updating "my location" pin.
     * @param {double} [options.latitude] Latitude of position
     * @param {double} [options.longitude] Longitude of position
     * @param {double} [options.displayLatitude] Display text of latitude
     * @param {double} [options.displayLongitude] Display text of longitude
     * @param {double} [options.altitude] Altitude of position
     * @param {double} [options.speed] Current speed, in km/h
     * @param {double} [options.displaySpeed] Display text for current speed
     * @param {string} [options.timestamp] Timestamp of position, as parseable date string
     * @param {string} [options.displayTimestamp] Display text of timestamp
     * @param {Number} [options.positionAccuracy] Accuracy of position, in meter
     * @param {string} [options.positionAccuracyColor] Hex color in format #rrggbb for position accuracy
     * @param {Boolean} [options.zoomToLocation] indicates if view should also zoom to this position
     */
    updateMyLocation(options) {

        if (this.myLocationMarker === null) {
            console.warn("MapView.updateMyLocation: myLocationMarker not initialized yet");
            return;
        }

        MapView.log("updating my location: lat=" + options.latitude + ", long=" + options.longitude);

        this.myLocationMarker.show = true;
        this.myLocationMarker.position = Cesium.Cartesian3.fromDegrees(options.longitude, options.latitude);

        var text = '<h2><img height="48em" width="48em" src="images/map-marker.svg" style="vertical-align:middle" />My Position</h2>' +
            '<div>Latitude: ' + options.displayLatitude + '<br/>' +
            'Longitude: ' + options.displayLongitude + '<br/>' +
            'Accuracy: <span style="color:' + options.positionAccuracyColor + '">+/- ' + options.positionAccuracy + ' m</span><br/>' +
            (options.altitude !== undefined && options.altitude !== 0 ? 'Altitude: ' + options.altitude.toFixed(1) + 'm<br/>' : '') +
            'Speed: ' + options.displaySpeed + "<br/>" +
            'Time: ' + options.displayTimestamp +
            '</div>';

        text += '<img height="32em" width="32em" src="images/share-variant.svg" style="vertical-align:middle" />' +
            '<a href="javascript:parent.map.onShareMyLocation();">Share position</a></p>';

        this.myLocationMarker.description = text;

        if (options.zoomToLocation) {
            MapView.log("also zooming to my location");
            this.flyTo(options);
        }
    }

    /**
     * Returns the current viewing distance from the camera to the terrain in the
     * center of the scene.
     */
    getCurrentViewingDistance() {

        var width = this.viewer.container.clientWidth;
        var height = this.viewer.container.clientHeight;

        var ray = this.viewer.camera.getPickRay(new Cesium.Cartesian2(width / 2, height / 2));
        var position = this.viewer.scene.globe.pick(ray, this.viewer.scene);

        if (position !== undefined) {
            return Cesium.Cartesian3.distance(this.viewer.camera.positionWC, position);
        }

        return 5000.0;
    }

    /**
     * Flies to to given location
     * @param {object} [options] Options to use for zooming
     * @param {double} [options.latitude] Latitude of zoom target
     * @param {double} [options.longitude] Longitude of zoom target
     * @param {double} [options.altitude] Altitude of zoom target; optional
     */
    async flyTo(options) {

        if (this.zoomEntity === undefined) {
            console.warn("MapView.zoomToLocation: zoomEntity not initialized yet");
            return;
        }

        MapView.log("flying to: latitude=" + options.latitude +
            ", longitude=" + options.longitude +
            ", altitude=" + options.altitude);

        var altitude = options.altitude || 0.0;

        var viewingDistance = this.getCurrentViewingDistance();

        // zooming works by assinging the zoom entity a new position, making it
        // visible (but transparent), fly there and hiding it again
        this.zoomEntity.position = Cesium.Cartesian3.fromDegrees(options.longitude, options.latitude, altitude);

        this.zoomEntity.point.heightReference =
            altitude === 0.0 ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE;

        this.zoomEntity.show = true;

        var that = this;
        await this.viewer.flyTo(
            this.zoomEntity,
            {
                offset: new Cesium.HeadingPitchRange(
                    this.viewer.camera.heading,
                    this.viewer.camera.pitch,
                    viewingDistance)
            });

        this.zoomEntity.show = false;
        MapView.log("flying finished");

        this.onUpdateLastShownLocation({
            latitude: options.latitude,
            longitude: options.longitude,
            altitude: options.altitude,
            viewingDistance: that.getCurrentViewingDistance()
        });
    }

    /**
     * Zooms to given location, by flying to the location
     * @param {object} [options] Options to use for zooming
     * @param {double} [options.latitude] Latitude of zoom target
     * @param {double} [options.longitude] Longitude of zoom target
     * @param {double} [options.altitude] Altitude of zoom target
     */
    zoomToLocation(options) {

        MapView.log("zooming to location at: " +
            "latitude=" + options.latitude + ", longitude=" + options.longitude +
            ", altitude=" + options.altitude);

        this.flyTo(options);
    }

    /**
     * Zooms to given map rectangle
     * @param {object} [rectangle] map rectangle to zoom to
     * @param {double} [rectangle.minLatitude] minimum latitude
     * @param {double} [rectangle.maxLatitude] maximum latitude
     * @param {double} [rectangle.minLongitude] minimum longitude
     * @param {double} [rectangle.maxLongitude] maximum longitude
     * @param {double} [rectangle.minAltitude] minimum altitude
     * @param {double} [rectangle.maxAltitude] maximum altitude
     */
    zoomToRectangle(rectangle) {

        MapView.log("start flying to rectangle");

        var corner = Cesium.Cartesian3.fromDegrees(rectangle.minLongitude, rectangle.minLatitude, rectangle.minAltitude);
        var oppositeCorner = Cesium.Cartesian3.fromDegrees(rectangle.maxLongitude, rectangle.maxLatitude, rectangle.maxAltitude);

        var boundingSphere = Cesium.BoundingSphere.fromCornerPoints(corner, oppositeCorner);

        var that = this;
        this.viewer.camera.flyToBoundingSphere(boundingSphere, {
            offset: new Cesium.HeadingPitchRange(
                this.viewer.camera.heading,
                this.viewer.camera.pitch,
                0.0),
            complete: function () {
                MapView.log("flying to rectangle finished");

                var center = Cesium.Cartographic.fromCartesian(boundingSphere.center);

                that.onUpdateLastShownLocation({
                    latitude: Cesium.Math.toDegrees(center.latitude),
                    longitude: Cesium.Math.toDegrees(center.longitude),
                    altitude: center.height,
                    viewingDistance: that.getCurrentViewingDistance()
                });
            }
        });
    }

    /**
     * Adds a new layer to the map
     * @param {object} [layer] Layer object to add
     * @param {string} [layer.id] ID of layer
     * @param {string} [layer.name] Layer name
     * @param {string} [layer.type] Layer type
     * @param {boolean} [layer.isVisible] Indicates if layer is visible
     * @param {string} [layer.data] CZML data of layer
     */
    async addLayer(layer) {

        MapView.log("adding layer " + layer.name + ", with type " + layer.type);

        if (layer.type === 'LocationLayer' || layer.type === 'TrackLayer') {
            this.setLayerVisibility(layer);
            return;
        }

        if (layer.type === 'OsmBuildingsLayer') {
            if (this.osmBuildingsTileset === null)
                this.osmBuildingsTileset = Cesium.createOsmBuildings();

            this.viewer.scene.primitives.add(this.osmBuildingsTileset);

            this.setLayerVisibility(layer);
            return;
        }

        MapView.log("layer data length: " + layer.data.length + " bytes");

        let czml = JSON.parse(layer.data);

        try {
            let dataSource = await Cesium.CzmlDataSource.load(czml);

            // don't set clustering on CZML data sources, since the object can't be shared;
            // see https://github.com/CesiumGS/cesium/issues/9336
            // dataSource.clustering = that.clustering;
            this.viewer.dataSources.add(dataSource);
            this.dataSourceMap[layer.id] = dataSource;

            this.setLayerVisibility(layer);

        } catch (error) {
            console.error("MapView.addLayer: error while loading CZML data source: " + error);
        }
    }

    /**
     * Gets the bounding sphere of a data source
     * @param {Cesium.DataSource} [dataSource] data source
     * @returns {Cesium.BoundingSphere} bounding sphere object, or null when no
     * bounding sphere could be determined
     */
    getDataSourceBoundingSphere(dataSource) {

        var entities = dataSource.entities.values;
        MapView.log("getting bounding spheres of " + entities.length + " entities");

        var boundingSphereScratch = new Cesium.BoundingSphere();

        var boundingSpheres = [];
        for (var i = 0, len = entities.length; i < len; i++) {
            try {
                var state = this.viewer.dataSourceDisplay.getBoundingSphere(entities[i], false, boundingSphereScratch);

                if (state === Cesium.BoundingSphereState.PENDING) {
                    continue;
                } else if (state !== Cesium.BoundingSphereState.FAILED) {
                    boundingSpheres.push(Cesium.BoundingSphere.clone(boundingSphereScratch));
                }
            } catch (e) {
                console.warn("MapView.getDataSourceBoundingSphere: " + e.message);
            }
        }

        if (boundingSpheres.length === 0) {
            return null;
        }

        return Cesium.BoundingSphere.fromBoundingSpheres(boundingSpheres);
    }

    /**
     * Zooms to layer with given layer ID
     * @param {string} [layerId] ID of layer
     */
    zoomToLayer(layerId) {

        MapView.log("zooming to layer with id " + layerId);

        if (layerId === "osmBuildingsLayer") {

            console.warn("can't zoom to OSM buildings layer");
            return;
        }

        var dataSource;
        if (layerId === "locationLayer")
            dataSource = this.locationDataSource;
        else if (layerId === "trackLayer")
            dataSource = this.trackPrimitivesCollection;
        else
            dataSource = this.dataSourceMap[layerId];

        if (dataSource !== undefined) {

            this.viewer.flyTo(dataSource);

            var boundingSphere = this.getDataSourceBoundingSphere(dataSource);
            if (boundingSphere !== null) {
                var center = Cesium.Cartographic.fromCartesian(boundingSphere.center);

                this.onUpdateLastShownLocation({
                    latitude: Cesium.Math.toDegrees(center.latitude),
                    longitude: Cesium.Math.toDegrees(center.longitude),
                    altitude: center.height,
                    viewingDistance: this.getCurrentViewingDistance()
                });
            }
        }
    }

    /**
     * Sets layer visibility
     * @param {object} [layer] Layer object to set visibility for
     * @param {string} [layer.id] ID of layer
     * @param {boolean} [layer.isVisible] Indicates if layer is visible
     */
    setLayerVisibility(layer) {

        MapView.log("setting new visibility for layer with id " + layer.id +
            ", visibility: " + layer.isVisible);

        if (layer.id === "locationLayer")
            this.locationDataSource.show = layer.isVisible;
        else if (layer.id === "trackLayer")
            this.trackPrimitivesCollection.show = layer.isVisible;
        else if (layer.id === "osmBuildingsLayer")
            this.osmBuildingsTileset.show = layer.isVisible;
        else {
            var dataSource = this.dataSourceMap[layer.id];
            if (dataSource !== undefined)
                dataSource.show = layer.isVisible;
        }

        this.updateScene();
    }

    /**
     * Exports layer with given ID to KMZ bytestream
     *
     * @param {string} layerId
     */
    async exportLayer(layerId) {

        MapView.log("exporting layer with id " + layerId);

        if (layerId === "locationLayer" ||
            layerId === "trackLayer" ||
            layerId === "osmBuildingsLayer") {
            console.warn("MapView: can't export layer of type " + layerId);
            this.onExportLayer(null);
            return;
        }

        var dataSource = this.dataSourceMap[layerId];
        if (dataSource === undefined)
            return;

        try {
            let result = await Cesium.exportKml({
                entities: dataSource.entities,
                kmz: true
            });

            this.onExportLayer(result.kmz);

        } catch (error) {
            console.error(error);
            this.onExportLayer(null);
        }
    }

    /**
     * Removes layer with given layer ID
     * @param {string} [layerId] ID of layer
     */
    removeLayer(layerId) {

        MapView.log("removing layer with id " + layerId);

        if (layerId === "osmBuildingsLayer" && this.osmBuildingsTileset !== null) {
            this.viewer.scene.primitives.remove(this.osmBuildingsTileset);
            this.osmBuildingsTileset = null;

            this.updateScene();
            return;
        }

        var dataSource = this.dataSourceMap[layerId];
        if (dataSource !== undefined) {
            this.viewer.dataSources.remove(dataSource);
            this.dataSourceMap[layerId] = undefined;

            // force re-clustering
            var lastPixelRange = this.clustering.pixelRange;
            this.clustering.pixelRange = 0;
            this.clustering.pixelRange = lastPixelRange;
        }

        this.updateScene();
    }

    /**
     * Clears list of layers
     */
    clearLayerList() {

        MapView.log("clearing layer list");

        if (this.osmBuildingsTileset !== null) {
            this.viewer.scene.primitives.remove(this.osmBuildingsTileset);
            this.osmBuildingsTileset = null;
        }

        for (var layerId in this.dataSourceMap) {
            var dataSource = this.dataSourceMap[layerId];
            if (dataSource !== undefined) {
                this.viewer.dataSources.remove(dataSource);
            }
        }

        this.dataSourceMap = {};

        // force re-clustering
        var lastPixelRange = this.clustering.pixelRange;
        this.clustering.pixelRange = 0;
        this.clustering.pixelRange = lastPixelRange;

        this.updateScene();
    }

    /**
     * Clears list of locations
     */
    clearLocationList() {

        MapView.log("clearing location list");

        this.locationDataSource.entities.removeAll();
    }

    /**
     * Formats description text for a location
     * @param {string} [location] Location to format text for
     * @param {string} [location.id] Location ID
     * @param {string} [location.type] Location type
     * @param {string} [location.name] Location name
     * @param {string} [location.description] Location description text
     * @param {Number} [location.altitude] Altitude of the location
     * @param {boolean} [location.isPlanTourLocation] Indicates if it's a tour planning location
     * @returns {string} formatted location text
     */
    formatLocationText(location) {

        var altitudeText =
            location.altitude !== undefined && location.altitude !== 0 ? ' ' + location.altitude.toFixed(1) + 'm' : '';

        var text = '<h2><img height="48em" width="48em" src="' + this.imageUrlFromLocationType(location.type) + '" style="vertical-align:middle" />' +
            location.name + altitudeText + '</h2>';

        text += '<p><img height="32em" width="32em" src="images/information-outline.svg" style="vertical-align:middle" /> ' +
            '<a href="javascript:parent.map.onShowLocationDetails(\'' + location.id + '\');">Show details</a> ';

        text += '<img height="32em" width="32em" src="images/directions.svg" style="vertical-align:middle" /> ' +
            '<a href="javascript:parent.map.onNavigateToLocation(\'' + location.id + '\');">Navigate here</a></p>';

        if (location.isPlanTourLocation === true) {
            text += '<img height="32em" width="32em" src="images/map-marker-plus.svg" style="vertical-align:middle" /> ' +
                '<a href="javascript:parent.map.onAddTourPlanLocation(\'' + location.id + '\');">Plan tour</a></p>';
        }

        text += "<p>" + location.description + "</p>";

        return text;
    }

    /**
     * Adds list of locations to the map, as marker pins
     * @param {array} locationList An array of location, each with the following object layout:
     * { id:"location-id", name:"Location Name", type:"LocationType", latitude: 123.45678, longitude: 9.87654, altitude:1234.5 }
     */
    async addLocationList(locationList) {

        MapView.log("adding location list, with " + locationList.length + " entries");
        console.time("MapView.addLocationList");

        for (var index in locationList) {

            var location = locationList[index];

            if (location.id === undefined) {
                console.warn("MapView: ignored adding location without ID");
                continue;
            }

            var text = this.formatLocationText(location);

            var imagePath = this.imageUrlFromLocationType(location.type);

            var altitudeText =
                location.altitude !== undefined && location.altitude !== 0 ? ' ' + location.altitude.toFixed(1) + 'm' : '';

            try {
                let entity = await this.createEntity(
                    location.id,
                    location.name + altitudeText,
                    text,
                    this.pinColorFromLocationType(location.type),
                    imagePath,
                    location.longitude,
                    location.latitude);

                if (location.takeoffDirections !== undefined && location.takeoffDirections !== 0)
                    this.addTakeoffEntities(entity, location);

                this.locationDataSource.entities.add(entity);

            } catch (error) {
                console.error("MapView.addLocationList: error while adding location entity: " + error);
            }
        }

        this.updateScene();

        console.timeEnd("MapView.addLocationList");
    }

    /**
     * Creates an entity object with given informations that can be placed into
     * the entities list.
     * @param {string} id Unique ID of the entity; may be 'undefined'
     * @param {string} name Name of the entity
     * @param {string} description Longer description text
     * @param {string} pinColor Pin color, one of the Cesium.Color.Xxx constants
     * @param {string} pinImage Relative link URL to SVG image to use in pin
     * @param {double} longitude Longitude of entity
     * @param {double} latitude Latitude of entity
     * @returns {Promise<object>} entity description, usable for viewer.entities.add()
     */
    async createEntity(id, name, description, pinColor, pinImage, longitude, latitude) {

        var url = Cesium.getAbsoluteUri(pinImage, window.location.href);

        let canvas = window.location.protocol === "file:" && !window.location.href.includes("android_asset")
            ? this.pinBuilder.fromColor(pinColor, 48)
            : await this.pinBuilder.fromUrl(url, pinColor, 48)

        try {
            return {
                id: id,
                name: name,
                description: description,
                position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
                billboard: {
                    image: canvas.toDataURL(),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: 5000.0
                }
            };

        } catch (error) {
            console.error("MapView.createEntity: error while generating pin from URL " + url + ": " + error);
        }
    }

    /**
     * Returns a relative image Url for given location type
     * @param {string} locationType location type
     * @returns {string} relative image Url
     */
    imageUrlFromLocationType(locationType) {

        switch (locationType) {
            case 'Summit': return 'images/mountain-15.svg';
            case 'Pass': return 'images/mountain-pass.svg';
            case 'Lake': return 'images/water-15.svg';
            case 'Bridge': return 'images/bridge.svg';
            case 'Viewpoint': return 'images/attraction-15.svg';
            case 'AlpineHut': return 'images/home-15.svg';
            case 'Restaurant': return 'images/restaurant-15.svg';
            case 'Church': return 'images/church.svg';
            case 'Castle': return 'images/castle.svg';
            case 'Cave': return 'images/cave.svg';
            case 'Information': return 'images/information-outline.svg';
            case 'PublicTransportBus': return 'images/bus.svg';
            case 'PublicTransportTrain': return 'images/train.svg';
            case 'Parking': return 'images/parking.svg';
            case 'Webcam': return 'images/camera-outline.svg';
            //case 'ViaFerrata': return '';
            case 'CableCar': return 'images/aerialway-15.svg';
            case 'FlyingTakeoff': return 'images/paragliding.svg';
            case 'FlyingLandingPlace': return 'images/paragliding.svg';
            case 'FlyingWinchTowing': return 'images/paragliding.svg';
            //case 'Turnpoint': return '';
            case 'Thermal': return 'images/weather-partly-cloudy.svg';
            case 'MeteoStation': return 'images/cloud-upload-outline-modified.svg';
            case 'LiveWaypoint': return 'images/autorenew.svg';
            default: return 'images/map-marker.svg';
        }
    }

    /**
     * Returns a pin color for given location type
     * @param {string} locationType location type
     * @returns {string} Cesium.Color constant
     */
    pinColorFromLocationType(locationType) {

        switch (locationType) {
            case 'FlyingTakeoff': return Cesium.Color.YELLOWGREEN;
            case 'FlyingLandingPlace': return Cesium.Color.ORANGE;
            case 'FlyingWinchTowing': return Cesium.Color.CORNFLOWERBLUE;
            case 'Turnpoint': return Cesium.Color.RED;
            default: return Cesium.Color.BLUE;
        }
    }

    /**
     * Calculates a point on a circle around a given center.
     * Note: Most of the code is adapted from code in Cesium's EllipseGeometryLibrary.js
     * @param {Cesium.Cartesian3} [center] Center point of the circle
     * @param {number} [radius] radius of the circle, in meter
     * @param {number} [angleDegrees] angle of point on circle, in degrees
     * @returns {Cesium.Cartesian3} calculated point coordinates
     */
    static pointFromCenterRadiusAngle(center, radius, angleDegrees) {

        var unitPosScratch = new Cesium.Cartesian3();
        var unitPos = Cesium.Cartesian3.normalize(center, unitPosScratch);

        var eastVecScratch = new Cesium.Cartesian3();
        var eastVec = Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, center, eastVecScratch);
        eastVec = Cesium.Cartesian3.normalize(eastVec, eastVec);

        var northVecScratch = new Cesium.Cartesian3();
        var northVec = Cesium.Cartesian3.cross(unitPos, eastVec, northVecScratch);

        var azimuth = Cesium.Math.toRadians(angleDegrees);

        var rotAxis = new Cesium.Cartesian3();
        var tempVec = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(eastVec, Math.cos(azimuth), rotAxis);
        Cesium.Cartesian3.multiplyByScalar(northVec, Math.sin(azimuth), tempVec);
        Cesium.Cartesian3.add(rotAxis, tempVec, rotAxis);

        var mag = Cesium.Cartesian3.magnitude(center);
        var angle = radius / mag;

        // Create the quaternion to rotate the position vector to the boundary of the ellipse.
        var unitQuat = new Cesium.Quaternion();
        Cesium.Quaternion.fromAxisAngle(rotAxis, angle, unitQuat);

        var rotMtx = new Cesium.Matrix3();
        Cesium.Matrix3.fromQuaternion(unitQuat, rotMtx);

        var result = new Cesium.Cartesian3();
        Cesium.Matrix3.multiplyByVector(rotMtx, unitPos, result);
        Cesium.Cartesian3.normalize(result, result);

        Cesium.Cartesian3.multiplyByScalar(result, mag, result);
        return result;
    }

    /**
     * Adds a polyline and polygon entity visualizing the takeoff directions of
     * the given location, to an existing entity.
     * @param {Object} [entity] Entity object to add to
     * @param {Object} [location] An object with at least the following properties:
     * @param {String} [location.id] ID of the location to update
     * @param {Number} [location.latitude] Latitude of the location to update
     * @param {Number} [location.longitude] Longitude of the location to update
     * @param {number} [location.takeoffDirections] Takeoff directions bit values
     */
    addTakeoffEntities(entity, location) {

        var center = Cesium.Cartesian3.fromDegrees(location.longitude, location.latitude);
        var radius = 50.0; // in meter

        var pointArray = [];
        var takeoffBits = location.takeoffDirections;
        var sliceAngle = 360.0 / 16.0;

        pointArray.push(center);

        // from the bits, calculate the takeoff angle and add polygon points
        for (var angleBit = 0; angleBit <= 16; angleBit++) {
            var bitmask = 1 << angleBit;
            var angle = 180.0 - angleBit * sliceAngle;

            if ((takeoffBits & bitmask) !== 0) {
                pointArray.push(MapView.pointFromCenterRadiusAngle(center, radius, angle - sliceAngle / 2.0));
                pointArray.push(MapView.pointFromCenterRadiusAngle(center, radius, angle));
                pointArray.push(MapView.pointFromCenterRadiusAngle(center, radius, angle + sliceAngle / 2.0));
                pointArray.push(center);
            }
        }

        var distanceDisplayCondition =
            new Cesium.DistanceDisplayCondition(0.0, 5000.0);

        entity.polyline = {
            positions: pointArray,
            width: 3.0,
            material: new Cesium.Color(1.0, 1.0, 0.5, 0.4), // light yellow
            clampToGround: true,
            distanceDisplayCondition: distanceDisplayCondition
        };

        entity.polygon = {
            // note: clamping to terrain is achieved by not specifying height and heightReference at all
            hierarchy: new Cesium.PolygonHierarchy(pointArray),
            material: new Cesium.Color(0.0, 0.0, 0.54, 0.4), // dark blue
            outline: false, // when an outline would be present, it would not clamp to ground
            distanceDisplayCondition: distanceDisplayCondition
        };
    }

    /**
     * Updates a single location
     * @param {Object} [location] An object with the following properties:
     * @param {String} [location.id] ID of the location to update
     * @param {string} [location.name] Location name
     * @param {string} [location.type] Location type
     * @param {Number} [location.latitude] Latitude of the location to update
     * @param {Number} [location.longitude] Longitude of the location to update
     * @param {Number} [location.altitude] Altitude of the location to update
     * @param {string} [location.description] Location description text
     * @param {boolean} [location.isPlanTourLocation] Indicates if it's a tour planning location
     */
    updateLocation(location) {

        MapView.log("updating location \"" + location.id +
            "\", new position at at latitude " + location.latitude +
            ", longitude " + location.longitude +
            ", altitude " + location.altitude);

        var entity = this.locationDataSource.entities.getById(location.id);

        if (entity === undefined) {
            console.error("MapView.updateLocation: couldn't find entity for id: " + location.id);
            return;
        }

        entity.position = Cesium.Cartesian3.fromDegrees(location.longitude, location.latitude, location.altitude);

        entity.name = location.name;
        entity.description = this.formatLocationText(location);

        this.updateScene();
    }

    /**
     * Removes a single location from map
     * @param {String} [locationId] ID of the location to remove
     */
    removeLocation(locationId) {

        MapView.log("removing location with ID: " + locationId);

        var entity = this.locationDataSource.entities.getById(locationId);

        this.locationDataSource.entities.remove(entity);

        this.updateScene();
    }

    /**
     * Shows a find result pin, with a link to add a waypoint for this result.
     * @param {Object} [options] An object with the following properties:
     * @param {String} [options.name] Name of the find result
     * @param {String} [options.description] Description text of the find result
     * @param {Number} [options.latitude] Latitude of the find result
     * @param {Number} [options.longitude] Longitude of the find result
     * @param {Number} [options.displayLatitude] Display text for latitude
     * @param {Number} [options.displayLongitude] Display text for longitude
     */
    showFindResult(options) {

        if (this.findResultMarker === undefined) {
            console.warn("MapView.showFindResult: findResultMarker not initialized yet");
            return;
        }

        MapView.log("showing find result for \"" + options.name +
            "\", at latitude " + options.latitude + ", longitude " + options.longitude);

        var text = '<h2><img height="48em" width="48em" src="images/magnify.svg" style="vertical-align:middle" />' + options.name + '</h2>' +
            '<div>Latitude: ' + options.displayLatitude + '<br/>' +
            'Longitude: ' + options.displayLongitude +
            '</div>';

        var optionsText = '{ name: \'' + options.name + '\', latitude:' + options.latitude + ', longitude:' + options.longitude + '}';

        text += '<img height="32em" width="32em" src="images/map-marker-plus.svg" style="vertical-align:middle" />' +
            '<a href="javascript:parent.map.onAddFindResult(' + optionsText + ');">Add as waypoint</a></p>';

        if (options.description !== undefined)
            text += '<div>' + options.description + '</div>';

        this.findResultMarker.description = text;
        this.findResultMarker.position = Cesium.Cartesian3.fromDegrees(options.longitude, options.latitude);
        this.findResultMarker.show = true;

        this.flyTo(options);
    }

    /**
     * Shows flying range for a given map point and using flying range parameters.
     * @param {Object} [options] Options for showing flying range:
     * @param {Number} [options.latitude] Latitude of the point to show flying range
     * @param {Number} [options.longitude] Longitude of the point to show flying range
     * @param {double} [options.displayLatitude] Display text of latitude
     * @param {double} [options.displayLongitude] Display text of longitude
     * @param {Number} [options.altitude] Altitude of the point to show flying range
     * @param {Number} [options.glideRatio] Glide ratio, in km flying per 1000m sink
     * @param {Number} [options.gliderSpeed] Glider speed, in km/h; must be above wind speed
     * @param {Number} [options.windDirection] Wind direction, in degrees
     * @param {Number} [options.windSpeed] Wind speed, in km/h
     */
    showFlyingRange(options) {

        if (this.flyingRangeCone !== null)
            this.viewer.entities.remove(this.flyingRangeCone);

        // limit wind speed so that we don't get a negative glide angle
        if (options.windSpeed > options.gliderSpeed - 1)
            options.windSpeed = options.gliderSpeed - 1;

        // use wind speed to calculate the angle to pitch the cone
        var glideAngle = Math.atan(options.glideRatio);
        var glideRatioWithWind = options.glideRatio * (options.gliderSpeed - options.windSpeed) / options.gliderSpeed;
        var glideAngleWithWind = Math.atan(glideRatioWithWind);
        var conePitch = glideAngle - glideAngleWithWind;

        var quat = Cesium.Transforms.headingPitchRollQuaternion(
            Cesium.Cartesian3.fromDegrees(options.longitude, options.latitude, options.altitude / 2.0),
            new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(options.windDirection + 90.0),
                conePitch, 0.0)
        );

        var text = '<p><img height="32em" width="32em" src="images/close-circle-outline.svg" style="vertical-align:middle" />' +
            '<a href="javascript:parent.map.hideFlyingRangeCone();">Hide</a></p>';

        text += '<p>Flying range for map point at<br/>Latitude: ' + options.displayLatitude + '<br/>' +
            'Longitude: ' + options.displayLongitude + '<br/>' +
            'Altitude: ' + options.altitude.toFixed(1) + 'm</p>';

        text += '<p>' +
            'Glide ratio: ' + options.glideRatio + '<br/>' +
            'Glide angle: ' + (90.0 - Cesium.Math.toDegrees(glideAngle)).toFixed(1) + ' degrees<br/>' +
            //'Glider speed: ' + options.gliderSpeed + ' km/h<br/>' +
            //'Glide ratio with wind: ' + glideRatioWithWind.toFixed(1) + '<br/>' +
            //'Glide angle with wind: ' + (90.0 - Cesium.Math.toDegrees(glideAngleWithWind)).toFixed(1) + ' degrees<br/>' +
            //'Wind: ' + options.windSpeed + ' km/h from ' + options.windDirection + ' degrees' +
            '</p>';

        this.flyingRangeCone = this.viewer.entities.add({
            name: 'Flying range',
            description: text,
            position: Cesium.Cartesian3.fromDegrees(options.longitude, options.latitude, options.altitude / 2.0),
            orientation: quat,
            cylinder: {
                length: options.altitude,
                topRadius: 0.0,
                bottomRadius: options.altitude * options.glideRatio,
                numberOfVerticalLines: 18,
                material: Cesium.Color.BLUE.withAlpha(0.4),
                outline: true,
                outlineColor: Cesium.Color.WHITE
            }
        });

        this.viewer.flyTo(this.flyingRangeCone,
            {
                offset: new Cesium.HeadingPitchRange(
                    this.viewer.camera.heading,
                    this.viewer.camera.pitch,
                    20 * 1000.0)
            });
    }

    /**
     * Samples track point heights from actual map and adjusts the track when it goes below terrain
     * height.
     * @param {object} [track] Track object to add
     * @param {string} [track.id] unique ID of the track
     * @param {array} [track.listOfTrackPoints] An array of track points in long, lat, alt, long, lat, alt ... order
     */
    async sampleTrackHeights(track) {

        MapView.log("sampleTrackHeights: #1 start sampling track point heights for " + track.listOfTrackPoints.length + " points...");
        console.time("MapView.sampleTrackHeights");

        if (!Cesium.Entity.supportsPolylinesOnTerrain(this.viewer.scene)) {
            console.warn("MapView.sampleTrackHeights: #2: polylines on terrain are not supported");
            return;
        }

        var trackPointArray = Cesium.Cartesian3.fromDegreesArrayHeights(track.listOfTrackPoints);

        var cartographicArray = [];
        for (let trackPoint of trackPointArray)
            cartographicArray.push(Cesium.Cartographic.fromCartesian(trackPoint));

        MapView.log("sampleTrackHeights: #3: waiting for terrain provider to be ready");

        try {
            await this.viewer.terrainProvider.readyPromise;

        } catch (error) {
            console.error("MapView.sampleTrackHeights: #8: error while waiting for terrain provider promise: " + error);
            this.onSampledTrackHeights(null);

            console.timeEnd("MapView.sampleTrackHeights");
            return;
        }

        MapView.log("sampleTrackHeights: #4: terrain provider is ready; starting sampling terrain");

        try {
            let samples = await Cesium.sampleTerrainMostDetailed(
                this.viewer.terrainProvider,
                cartographicArray);

            MapView.log("sampleTrackHeights: #5: terrain provider reports back " + samples.length + " samples");

            var trackPointHeightArray = [];

            for (let sampledValue of samples) {
                var sampledHeight = sampledValue.height;
                trackPointHeightArray.push(sampledHeight);
            }

            MapView.log("sampleTrackHeights: #6: sampling track point heights finished.");

            this.onSampledTrackHeights(trackPointHeightArray);

            console.timeEnd("MapView.sampleTrackHeights");

        } catch (error) {
            console.error("MapView.sampleTrackHeights: #9: error while sampling track point heights: " + error);
            this.onSampledTrackHeights(null);
            console.timeEnd("MapView.sampleTrackHeights");
        }

        MapView.log("sampleTrackHeights: #7: call to sampleTrackHeights() returns.");
    }

    /**
     * Called when sampling track points has finished.
     * @param {array} [listOfTrackPointHeights] An array of track point heights for all track points
     * that were passed to sampleTrackHeights().
     */
    onSampledTrackHeights(listOfTrackPointHeights) {

        MapView.log("sampling track heights has finished");

        if (this.options.callback !== undefined)
            this.options.callback('onSampledTrackHeights', listOfTrackPointHeights);
    }

    /**
     * Calculates track color from given variometer climb/sink rate value.
     * @param {double} varioValue variometer value, in m/s
     * @returns {Cesium.Color} Track color
     */
    trackColorFromVarioValue(varioValue) {

        var varioColorMapping = [
            5.0, Cesium.Color.RED,
            4.5, Cesium.Color.fromBytes(255, 64, 0),
            4.0, Cesium.Color.fromBytes(255, 128, 0),
            3.5, Cesium.Color.fromBytes(255, 192, 0),
            3.0, Cesium.Color.YELLOW,
            2.5, Cesium.Color.fromBytes(192, 255, 0),
            2.0, Cesium.Color.fromBytes(128, 255, 0),
            1.5, Cesium.Color.fromBytes(64, 255, 128),
            1.0, Cesium.Color.CYAN,
            0.5, Cesium.Color.fromBytes(0, 224, 255),
            0.0, Cesium.Color.fromBytes(0, 192, 255),
            -0.5, Cesium.Color.fromBytes(0, 160, 255),
            -1.0, Cesium.Color.fromBytes(0, 128, 255),
            -1.5, Cesium.Color.fromBytes(0, 96, 224),
            -2.0, Cesium.Color.fromBytes(0, 64, 192),
            -3.0, Cesium.Color.fromBytes(0, 32, 160),
            -3.5, Cesium.Color.fromBytes(0, 0, 128),
            -4.0, Cesium.Color.fromBytes(64, 0, 128)
        ];

        for (var mappingIndex = 0; mappingIndex < varioColorMapping.length; mappingIndex += 2) {
            if (varioValue >= varioColorMapping[mappingIndex])
                return varioColorMapping[mappingIndex + 1];
        }

        return Cesium.Color.fromBytes(128, 0, 128); // smaller than -4.0
    }

    /**
     * Calculates an array of track colors based on the altitude changes of the given track points.
     * @param {array} listOfTrackPoints An array of track points in long, lat, alt, long, lat, alt ... order
     * @param {array} listOfTimePoints An array of time points in seconds; same length as listOfTrackPoints; may be null
     * @returns {array} Array with same number of entries as track points in the given list
     */
    calcTrackColors(listOfTrackPoints, listOfTimePoints) {

        var trackColors = [];

        trackColors[0] = this.trackColorFromVarioValue(0.0);

        for (var index = 3; index < listOfTrackPoints.length; index += 3) {

            var altitudeDiff = listOfTrackPoints[index + 2] - listOfTrackPoints[index - 1];

            var timeDiff = 1.0;
            if (listOfTimePoints !== null)
                timeDiff = listOfTimePoints[index / 3] - listOfTimePoints[index / 3 - 1];

            var varioValue = altitudeDiff / timeDiff;

            var varioColor = this.trackColorFromVarioValue(varioValue);

            if (varioColor === undefined)
                MapView.log("undefined color for vario value " + varioValue);

            trackColors[index / 3] = varioColor;
        }

        return trackColors;
    }

    /**
     * Creates a primitive for a flight track
     * @param {object} [track] Track object to add
     * @param {array} [track.listOfTrackPoints] An array of track points in long, lat, alt, long, lat, alt ... order
     * @param {array} [track.listOfTimePoints] An array of time points in seconds; same length as listOfTrackPoints; may be null
     * @param {array} [trackPointArray] An array of track points to use
     * @returns {Cesium.Primitive} created primitive object
     */
    getFlightTrackPrimitive(track, trackPointArray) {

        var trackColors = this.calcTrackColors(track.listOfTrackPoints, track.listOfTimePoints);

        var trackPolyline = new Cesium.PolylineGeometry({
            positions: trackPointArray,
            width: 5,
            vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
            colors: trackColors,
            colorsPerVertex: false
        });

        var primitive = new Cesium.Primitive({
            asynchronous: this.options.useAsynchronousPrimitives,
            geometryInstances: new Cesium.GeometryInstance({
                id: "track-" + track.id,
                geometry: trackPolyline
            }),
            appearance: new Cesium.PolylineColorAppearance({ translucent: false })
        });

        return primitive;
    }

    /**
     * Creates a wall primitive for a flight track to display relation to ground
     * @param {string} [trackId] unique ID of the track
     * @param {array} [trackPointArray] An array of track points to use
     * @returns {Cesium.Primitive} created wall primitive object
     */
    getFlightTrackWallPrimitive(trackId, trackPointArray) {

        var wallGeometry = new Cesium.WallGeometry({
            positions: trackPointArray
        });

        var wallMaterial = Cesium.Material.fromType('Color');

        wallMaterial.uniforms.color = new Cesium.Color(0.5, 0.5, 1, 0.4);

        var wallPrimitive = new Cesium.Primitive({
            asynchronous: this.options.useAsynchronousPrimitives,
            geometryInstances: new Cesium.GeometryInstance({
                id: "track-" + trackId,
                geometry: wallGeometry
            }),
            appearance: new Cesium.MaterialAppearance({
                translucent: true,
                material: wallMaterial,
                faceForward: true
            })
        });

        return wallPrimitive;
    }

    /**
     * Creates a ground primitive for a non-flight track
     * @param {object} [track] Track object to add
     * @param {string} [track.id] unique ID of the track
     * @param {string} [track.color] Color as "RRGGBB" string value
     * @param {array} [trackPointArray] An array of track points to use
     * @returns {Cesium.Primitive} created primitive object
     */
    getGroundTrackPrimitive(track, trackPointArray) {

        var groundTrackPolyline = new Cesium.GroundPolylineGeometry({
            positions: trackPointArray,
            width: 5
        });

        var primitive = new Cesium.GroundPolylinePrimitive({
            asynchronous: this.options.useAsynchronousPrimitives,
            geometryInstances: new Cesium.GeometryInstance({
                id: "track-" + track.id,
                geometry: groundTrackPolyline,
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString('#' + track.color))
                }
            }),
            appearance: new Cesium.PolylineColorAppearance({ translucent: false })
        });

        return primitive;
    }

    /**
     * Adds a track to the map
     * @param {object} [track] Track object to add
     * @param {string} [track.id] unique ID of the track
     * @param {string} [track.name] track name to add
     * @param {boolean} [track.isFlightTrack] indicates if track is a flight
     * @param {boolean} [track.isLiveTrack] indicates if track is a live track
     * that is updated periodically
     * @param {array} [track.listOfTrackPoints] An array of track points in long,
     * lat, alt, long, lat, alt ... order
     * @param {array} [track.listOfTimePoints] An array of time points in seconds;
     * same length as listOfTrackPoints.length / 3; may be null
     * @param {array} [track.groundHeightProfile] An array of ground height
     * profile elevations; same length as listOfTimePoints; may be null
     * @param {string} [track.color] Color as "RRGGBB" string value, or undefined
     * when track should be colored according to climb and sink rate.
     */
    addTrack(track) {

        this.removeTrack(track.id);

        MapView.log("adding list of track points, with ID " + track.id + " and " + track.listOfTrackPoints.length + " track points");

        this.trackIdToTrackDataMap[track.id] = {
            track: track,
            primitive: undefined,
            wallPrimitive: undefined,
            boundingSphere: undefined
        };

        this.addOrUpdateTrackPrimitives(track);

        if (track.isLiveTrack) {
            this.addLiveTrackEntity(track);
            this.viewer.scene.requestRenderMode = false;

            this.showLiveTrackToolbar();

            this.setLiveTrackTime(this.currentLiveTrackTimeOffset);
        }
    }

    /**
     * Adds or updates track primitives to display ground track or flight track + wall. When the
     * primitives already exist, the primitives are recreated with the current track data
     * @param {object} [track] Track object to use
     * @param {string} [track.id] unique ID of the track
     * @param {boolean} [track.isFlightTrack] indicates if track is a flight
     * @param {array} [track.listOfTrackPoints] An array of track points in long,
     * lat, alt, long, lat, alt ... order
     * @param {array} [track.listOfTimePoints] An array of time points in seconds;
     * same length as listOfTrackPoints.length / 3; may be null
     */
    addOrUpdateTrackPrimitives(track) {

        var trackPointArray = track.listOfTrackPoints.length > 0
            ? Cesium.Cartesian3.fromDegreesArrayHeights(track.listOfTrackPoints)
            : [];

        // remove duplicates so that color values are calculated correctly
        if (track.isFlightTrack)
            trackPointArray = this.removeTrackDuplicatePoints(track, trackPointArray);

        // need at least 2 points for the track primitives
        if (trackPointArray.length < 2)
            return;

        var trackData = this.trackIdToTrackDataMap[track.id];

        if (trackData.boundingSphere !== undefined) {
            // remove the existing primitives
            if (trackData.primitive !== undefined)
                this.trackPrimitivesCollection.remove(trackData.primitive);

            if (trackData.wallPrimitive !== undefined)
                this.trackPrimitivesCollection.remove(trackData.wallPrimitive);
        }

        // create new primitives
        if (track.isFlightTrack) {
            trackData.primitive = this.getFlightTrackPrimitive(track, trackPointArray);
            trackData.wallPrimitive = this.getFlightTrackWallPrimitive(track.id, trackPointArray);

            this.trackPrimitivesCollection.add(trackData.wallPrimitive);

        } else {
            trackData.primitive = this.getGroundTrackPrimitive(track, trackPointArray);
        }

        if (trackData.primitive !== undefined)
            this.trackPrimitivesCollection.add(trackData.primitive);

        trackData.boundingSphere = Cesium.BoundingSphere.fromPoints(trackPointArray, null);
    }

    /**
     * Adds a live track entity for the given track object
     * @param {object} [track] track object, with at least the following properties:
     * @param {string} [track.id] unique ID of the track
     * @param {string} [track.name] track name to add
     * @param {string} [track.description] track description
     * @param {string} [track.color] Color as "RRGGBB" string value, for trailing path
     */
    async addLiveTrackEntity(track) {

        var pinColor = this.pinColorFromLocationType('LiveWaypoint');
        var pinImage = this.imageUrlFromLocationType('LiveWaypoint');

        var url = Cesium.getAbsoluteUri(pinImage, window.location.href);

        let canvas = window.location.protocol === "file:" && !window.location.href.includes("android_asset")
            ? this.pinBuilder.fromColor(pinColor, 48)
            : await this.pinBuilder.fromUrl(url, pinColor, 48);

        try {
            var sampledPos = new Cesium.SampledPositionProperty();
            sampledPos.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
            sampledPos.setInterpolationOptions({
                interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
                interpolationDegree: 3
            });

            var showLabelProperty = new Cesium.TimeIntervalCollectionProperty();
            showLabelProperty.intervals.addInterval(
                new Cesium.TimeInterval({
                    start: Cesium.JulianDate.now,
                    stop: Cesium.JulianDate.addDays(Cesium.JulianDate.now, 365, new Cesium.JulianDate()),
                    data: false // label is not visible
                }));

            var entityOptions = {
                id: "livetrackpoint-" + track.id,
                name: track.name,
                description: track.description,
                position: sampledPos,
                billboard: {
                    image: canvas.toDataURL(),
                    heightReference: Cesium.HeightReference.NONE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    disableDepthTestDistance: 5000.0
                },
                path: {
                    leadTime: 0,
                    trailTime: 15 * 60,
                    resolution: 60,
                    width: 3,
                    material: Cesium.Color.fromCssColorString('#' + track.color)
                },
                label: {
                    text: new Cesium.ConstantProperty("out of current track data"),
                    show: showLabelProperty,
                    font: "14pt sans-serif",
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    fillColor: Cesium.Color.WHITE,
                    showBackground: false,
                    outlineWidth: 10.0,
                    outlineColor: Cesium.Color.BLACK,
                    pixelOffset: new Cesium.Cartesian2(64, 0),
                    heightReference: Cesium.HeightReference.NONE,
                    disableDepthTestDistance: 5000.0
                }
            };

            var entity = this.liveTrackDataSource.entities.add(entityOptions);

            var trackData = this.trackIdToTrackDataMap[track.id];
            trackData.liveTrackEntity = entity;

        } catch (error) {
            console.error("MapView.addLiveTrackEntity: error while generating pin from URL " + url + ": " + error);
        }
    }

    /**
     * Updates track infos like name and color
     * @param {object} [track] Track object to update, with at least the following properties:
     * @param {string} [track.id] unique ID of the track
     * @param {string} [track.name] track name to add
     * @param {boolean} [track.isFlightTrack] indicates if track is a flight
     * @param {string} [track.color] Color as "RRGGBB" string value, or undefined
     * when track should be colored according to climb and sink rate.
     */
    updateTrack(track) {

        var trackInfos = this.trackIdToTrackDataMap[track.id];
        if (trackInfos !== undefined) {
            trackInfos.track.name = track.name;

            if (!track.isFlightTrack) {
                var attributes = trackInfos.primitive.getGeometryInstanceAttributes(
                    "track-" + track.id);

                attributes.color = Cesium.ColorGeometryInstanceAttribute.toValue(
                    Cesium.Color.fromCssColorString('#' + track.color),
                    attributes.color);
            }

            this.updateScene();
        }
    }

    /**
     * Removes duplicate track points, e.g. when the track position hasn't changed
     * for several seconds. This is needed since CesiumJS removes duplicate
     * position values from tracks, but doesn't remove per-vertex color values.
     * See also: https://github.com/CesiumGS/cesium/issues/9379
     * @param {object} track Track object to modify, with at least the following
     * properties:
     * @param {array} [track.listOfTrackPoints] An array of track points in long,
     * lat, alt, long, lat, alt ... order
     * @param {array} [track.listOfTimePoints] An array of time points in seconds;
     * same length as listOfTrackPoints.length / 3; may be null
     * @param {array} [track.groundHeightProfile] An array of ground height
     * profile elevations; same length as listOfTimePoints; may be null
     * @param {array} [trackPointArray] An array of track points to modify
     * @returns {array} new trackPointArray array
     */
    removeTrackDuplicatePoints(track, trackPointArray) {

        // add index to every track point
        for (var trackPointIndex = 0; trackPointIndex < trackPointArray.length; trackPointIndex++) {
            trackPointArray[trackPointIndex].trackPointIndex = trackPointIndex;
        }

        var modifiedTrackPointArray = Cesium.arrayRemoveDuplicates(trackPointArray, Cesium.Cartesian3.equalsEpsilon);

        if (trackPointArray.length === modifiedTrackPointArray.length)
            return trackPointArray; // nothing was removed

        var removedTrackPoints = trackPointArray.length - modifiedTrackPointArray.length;
        MapView.log("removed " + removedTrackPoints + " duplicate track points from track");

        var newListOfTrackPoints = [];
        var newListOfTimePoints = [];
        var newGroundHeightProfile = [];

        for (var modifiedIndex = 0; modifiedIndex < modifiedTrackPointArray.length; modifiedIndex++) {
            var oldTrackPointIndex = modifiedTrackPointArray[modifiedIndex].trackPointIndex;

            newListOfTrackPoints.push(track.listOfTrackPoints[oldTrackPointIndex * 3]);
            newListOfTrackPoints.push(track.listOfTrackPoints[oldTrackPointIndex * 3 + 1]);
            newListOfTrackPoints.push(track.listOfTrackPoints[oldTrackPointIndex * 3 + 2]);

            if (track.listOfTimePoints !== null)
                newListOfTimePoints.push(track.listOfTimePoints[oldTrackPointIndex]);

            if (track.groundHeightProfile !== null)
                newGroundHeightProfile.push(track.groundHeightProfile[oldTrackPointIndex]);
        }

        track.listOfTrackPoints = newListOfTrackPoints;

        if (track.listOfTimePoints !== null)
            track.listOfTimePoints = newListOfTimePoints;

        if (track.groundHeightProfile !== null)
            track.groundHeightProfile = newGroundHeightProfile;

        return modifiedTrackPointArray;
    }

    /**
     * When getting back live track data from the web API, it uses a different
     * format for track points; convert here to the track format.
     * @param {object} track Track object to modify
     * @param {Number} track.trackStart track start, in seconds from epoch or as
     * ISO8601 string
     * @param {Array} track.trackPoints track points, with latitude, longitude,
     * altitude and offset values
     */
    convertResponseDataToTrack(track) {

        var trackStart = typeof track.trackStart === 'string'
            ? Math.floor(new Date(track.trackStart).getTime() / 1000.0)
            : track.trackStart;

        track.listOfTrackPoints = [];
        track.listOfTimePoints = [];

        for (var trackPointIndex in track.trackPoints) {

            var trackPoint = track.trackPoints[trackPointIndex];

            track.listOfTrackPoints.push(trackPoint.longitude);
            track.listOfTrackPoints.push(trackPoint.latitude);
            track.listOfTrackPoints.push(trackPoint.altitude);

            track.listOfTimePoints.push(trackStart + trackPoint.offset);
        }

        track.trackStart = undefined;
        track.trackPoints = undefined;
    }

    /**
     * Updates a live track with new track points. The track points are displayed
     * using a Path entity object. If the height profile view is currently open,
     * also add the track points there and update the view.
     * @param {object} track Track object to modify, with at least the following
     * @param {string} track.id unique ID of the track to add more track points
     * properties:
     * @param {array} [track.listOfTrackPoints] An array of track points in long,
     * lat, alt, long, lat, alt ... order
     * @param {array} [track.listOfTimePoints] An array of time points in seconds;
     * same length as listOfTrackPoints.length / 3; must not be null
     * Also the following properties can be set, which will be converted to
     * listOfTrackPoints and listOfTimePoints internally:
     * @param {Number} track.trackStart track start, in seconds from epoch or as
     * ISO8601 string
     * @param {Array} track.trackPoints track points, with latitude, longitude,
     * altitude and offset values
     */
    updateLiveTrack(track) {

        if (track.trackStart !== undefined)
            this.convertResponseDataToTrack(track);

        if (!(track.id in this.trackIdToTrackDataMap)) {
            console.warn("called updateLiveTrack(), but track wasn't added with addTrack() yet");
            return;
        }

        var trackData = this.trackIdToTrackDataMap[track.id];

        if (trackData.liveTrackEntity === undefined) {
            console.warn("called updateLiveTrack(), but track is no live track");
            return;
        }

        track.color = trackData.track.color;
        track.isFlightTrack = trackData.track.isFlightTrack;
        track.isLiveTrack = trackData.track.isLiveTrack;

        trackData.liveTrackEntity.name = track.name;
        trackData.liveTrackEntity.description = track.description;

        // add new track points to track and wall primitives
        this.mergeLiveTrackPoints(track);
        this.addOrUpdateTrackPrimitives(track);

        // add points to path entity
        var trackPointArray = Cesium.Cartesian3.fromDegreesArrayHeights(track.listOfTrackPoints);

        var julianTimePoints = [];
        for (var index = 0; index < track.listOfTimePoints.length; index++)
            julianTimePoints.push(
                Cesium.JulianDate.fromDate(
                    new Date(track.listOfTimePoints[index] * 1000.0)));

        var lastTimePoint = track.listOfTimePoints[track.listOfTimePoints.length - 1];

        console.info("MapView: added new track points, from " +
            new Date(track.listOfTimePoints[0] * 1000.0) +
            " to " +
            new Date(lastTimePoint * 1000.0));

        var sampledPos = trackData.liveTrackEntity.position;
        sampledPos.addSamples(julianTimePoints, trackPointArray);

        // update visibility and text of label
        var showLabelProperty = trackData.liveTrackEntity.label.show;
        showLabelProperty.intervals.addInterval(
            new Cesium.TimeInterval({
                start: julianTimePoints[0],
                stop: julianTimePoints[julianTimePoints.length - 1],
                data: false // label is not visible
            }));

        var text = "out of data\nsince " +
            new Date(lastTimePoint * 1000.0).toTimeString().substring(0, 8);

        trackData.liveTrackEntity.label.text =
            new Cesium.ConstantProperty(text);

        // update height profile when shown
        if (this.heightProfileView !== null &&
            track.id === this.currentHeightProfileTrackId) {
            this.heightProfileView.addTrackPoints(track);
        }
    }

    /**
     * Merges the track points in given track object with track points already
     * stored in the trackData mapping. Used for live tracking.
     * @param {object} track Track object to use
     * @param {string} track.id unique ID of the track to add more track points
     * @param {array} [track.listOfTrackPoints] An array of track points in long,
     * lat, alt, long, lat, alt ... order
     * @param {array} [track.listOfTimePoints] An array of time points in seconds;
     * same length as listOfTrackPoints.length / 3; must not be null
     */
    mergeLiveTrackPoints(track) {

        var trackData = this.trackIdToTrackDataMap[track.id];

        if (track.listOfTrackPoints.length === 0 ||
            track.listOfTrackPoints.length !== track.listOfTimePoints.length * 3)
            return;

        var startTimePoint = track.listOfTimePoints[0];

        var timePos = trackData.track.listOfTimePoints.indexOf(startTimePoint);

        var removedTrackPoints = (timePos === -1 ? "no " : (trackData.track.listOfTimePoints.length - timePos) + " ");
        console.info("MapView: removing " + removedTrackPoints +
            "live track points and adding " + track.listOfTimePoints.length + " new track points");

        if (timePos !== -1) {
            var trackPos = timePos * 3;
            trackData.track.listOfTrackPoints.splice(trackPos, trackData.track.listOfTrackPoints.length - trackPos);
            trackData.track.listOfTimePoints.splice(timePos, trackData.track.listOfTimePoints.length - timePos);
        }

        trackData.track.listOfTrackPoints = trackData.track.listOfTrackPoints.concat(track.listOfTrackPoints);
        trackData.track.listOfTimePoints = trackData.track.listOfTimePoints.concat(track.listOfTimePoints);

        track.listOfTrackPoints = trackData.track.listOfTrackPoints;
        track.listOfTimePoints = trackData.track.listOfTimePoints;
    }

    /**
     * Returns the time of the last (latest) track point of a track.
     * @param {string} trackId track ID of track
     * @returns track point time, in seconds since epoch, or null when no track
     * points are available yet
     */
    getTrackLastTrackPointTime(trackId) {

        var trackData = this.trackIdToTrackDataMap[trackId];

        if (trackData === undefined ||
            trackData.track === undefined ||
            trackData.track.listOfTimePoints.length === 0)
            return null;

        return trackData.track.listOfTimePoints[trackData.track.listOfTimePoints.length - 1];
    }

    /**
     * Sets a new time offset from current time ("now")
     * @param {Number} timeOffset time offset from now, in seconds; usually
     * negative, since most live tracking data is sent from the past
     */
    setLiveTrackTime(timeOffset) {

        this.currentLiveTrackTimeOffset = timeOffset;

        var now = Cesium.JulianDate.now();
        var liveTrackTime = Cesium.JulianDate.addSeconds(now, timeOffset, new Cesium.JulianDate());
        var end = Cesium.JulianDate.addDays(now, 1, new Cesium.JulianDate());

        // note: set clockStep before currentTime, or it will be reset
        this.viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
        this.viewer.clock.stopTime = end.clone();
        this.viewer.clock.currentTime = liveTrackTime.clone();

        // also update text
        if (this.options.liveTrackToolbarId === undefined)
            return;

        var liveTrackSliderText = document.getElementById("liveTrackSliderText");

        if (timeOffset === 0)
            liveTrackSliderText.innerHTML = "now";
        else
            liveTrackSliderText.innerHTML = "-" + new Date(-timeOffset * 1000).toTimeString().substring(3, 8);

    }

    /**
     * Zooms to the current position of a live waypoint with given location ID
     * @param {string} locationId unique ID of the live waypoint to zoom to
     */
    zoomToLiveWaypointCurrentPos(locationId) {

        var entity = this.locationDataSource.entities.getById(locationId);

        if (entity === undefined) {
            console.error("MapView: couldn't find entity for live waypoint id: " + locationId);
            return;
        }

        var position = entity.position.getValue(this.viewer.clock.currentTime);
        var location = Cesium.Cartographic.fromCartesian(position);

        this.zoomToLocation({
            longitude: Cesium.Math.toDegrees(location.longitude),
            latitude: Cesium.Math.toDegrees(location.latitude),
            altitude: location.height
        });
    }

    /**
     * Zooms to a track on the map
     * @param {string} trackId unique ID of the track to zoom to
     */
    zoomToTrack(trackId) {

        var trackData = this.trackIdToTrackDataMap[trackId];

        if (trackData !== undefined) {

            MapView.log("zooming to track with ID: " + trackId);

            if (trackData.liveTrackEntity !== undefined) {

                var sampledPos = trackData.liveTrackEntity.position;

                var currentPosCartesian = sampledPos.getValue(this.viewer.clockViewModel.currentTime, new Cesium.Cartesian3());
                if (currentPosCartesian !== undefined) {
                    var currentPos = Cesium.Cartographic.fromCartesian(currentPosCartesian);

                    this.flyTo({
                        latitude: Cesium.Math.toDegrees(currentPos.latitude),
                        longitude: Cesium.Math.toDegrees(currentPos.longitude),
                        altitude: currentPos.height,
                    });
                }
            }
            else if (trackData.boundingSphere !== undefined) {

                this.viewer.camera.flyToBoundingSphere(trackData.boundingSphere);

                var center = Cesium.Cartographic.fromCartesian(trackData.boundingSphere.center);

                this.onUpdateLastShownLocation({
                    latitude: Cesium.Math.toDegrees(center.latitude),
                    longitude: Cesium.Math.toDegrees(center.longitude),
                    altitude: center.height,
                    viewingDistance: this.getCurrentViewingDistance()
                });
            }
        }
    }

    /**
     * Removes a track from the map
     * @param {string} trackId unique ID of the track
     */
    removeTrack(trackId) {

        var trackData = this.trackIdToTrackDataMap[trackId];

        if (trackData !== undefined) {

            MapView.log("removing track with ID: " + trackId);

            if (trackData.primitive !== undefined)
                this.trackPrimitivesCollection.remove(trackData.primitive);

            if (trackData.wallPrimitive !== undefined)
                this.trackPrimitivesCollection.remove(trackData.wallPrimitive);

            if (trackData.liveTrackEntity !== undefined)
                this.liveTrackDataSource.entities.remove(trackData.liveTrackEntity);

            this.trackIdToTrackDataMap[trackId] = undefined;
        }

        if (trackId === this.currentHeightProfileTrackId)
            this.closeHeightProfileView();

        if (this.liveTrackDataSource.entities.values.length === 0) {
            // removed the last live track entity
            this.viewer.scene.requestRenderMode = true;

            if (this.lastShadingMode !== undefined)
                this.setShadingMode(this.lastShadingMode);

            this.hideLiveTrackToolbar();
        }

        this.updateScene();
    }

    /**
     * Clears all tracks from the map
     */
    clearAllTracks() {

        MapView.log("clearing all tracks");

        this.trackPrimitivesCollection.removeAll();

        this.liveTrackDataSource.entities.removeAll();
        this.viewer.scene.requestRenderMode = true;

        if (this.lastShadingMode !== undefined)
            this.setShadingMode(this.lastShadingMode);

        this.hideLiveTrackToolbar();

        this.trackIdToTrackDataMap = {};

        if (this.heightProfileView !== null)
            this.closeHeightProfileView();

        this.updateScene();
    }

    /**
     * Shows track height profile.
     * @param {string} trackId unique ID of the track
     */
    showTrackHeightProfile(trackId) {

        if (typeof HeightProfileView !== "function") {
            console.warn("can't display track height profile; HeightProfileView class is not available");
            return;
        }

        if (this.currentHeightProfileTrackId === trackId)
            return; // already shown

        var trackData = this.trackIdToTrackDataMap[trackId];
        if (trackData === undefined) {
            console.warn("no track found for track ID " + trackId);
            return;
        }

        this.currentHeightProfileTrackId = trackId;

        if (this.heightProfileView !== null) {
            this.heightProfileView.destroy();
        }

        var that = this;
        this.heightProfileView = new HeightProfileView({
            id: 'chartElement',
            containerId: 'chartContainer',
            setBodyBackgroundColor: false,
            useDarkTheme: true,
            showCloseButton: true,
            colorFromVarioValue: function (varioValue) {
                return that.trackColorFromVarioValue(varioValue).toCssColorString();
            },
            callback: function (funcName, params) {
                that.heightProfileCallAction(funcName, params);
            }
        });

        this.heightProfileView.setTrack(trackData.track);

        if (trackData.track.groundHeightProfile !== undefined &&
            trackData.track.groundHeightProfile !== null)
            this.heightProfileView.addGroundProfile(trackData.track.groundHeightProfile);
    }

    /**
     * Closes height profile view again
     */
    closeHeightProfileView() {

        if (this.heightProfileView !== null) {
            var view = this.heightProfileView;
            this.heightProfileView = null;

            view.hide();
            view.destroy();
        }

        this.trackMarker.show = false;

        if (this.trackMarker === this.viewer.trackedEntity)
            this.viewer.trackedEntity = null;

        this.currentHeightProfileTrackId = undefined;
    }

    /**
     * Called for an action of the height profile view
     * @param {string} funcName action function name
     * @param {object} params action params
     */
    heightProfileCallAction(funcName, params) {

        if (funcName === "onHover" || funcName === "onClick") {

            this.updateTrackMarker(this.currentHeightProfileTrackId, params);

            if (funcName === "onClick") {

                this.viewer.flyTo(
                    this.trackMarker,
                    {
                        offset: new Cesium.HeadingPitchRange(
                            this.viewer.scene.camera.heading,
                            this.viewer.scene.camera.pitch,
                            2000.0)
                    });
            }
        }
        else if (funcName === "onClose" && this.inOnCloseHandler === false) {
            this.inOnCloseHandler = true;
            this.closeHeightProfileView();
            this.inOnCloseHandler = false;
        }
    }

    /**
     * Updates track marker to be placed on a track point index.
     * @param {string} trackId unique ID of the track
     * @param {object} trackPointIndex index of track point
     */
    updateTrackMarker(trackId, trackPointIndex) {

        var trackData = this.trackIdToTrackDataMap[trackId];
        if (trackData === undefined) {
            console.warn("no track found for track ID " + trackId);
            return;
        }

        var longitude = trackData.track.listOfTrackPoints[trackPointIndex * 3];
        var latitude = trackData.track.listOfTrackPoints[trackPointIndex * 3 + 1];
        var altitude = trackData.track.listOfTrackPoints[trackPointIndex * 3 + 2];

        this.trackMarker.show = true;
        this.trackMarker.position =
            Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);

        this.updateScene();
    }

    /**
     * Called by the map ctor when the map is initialized and ready.
     */
    onMapInitialized() {

        MapView.log("map is initialized");

        if (this.options.callback !== undefined)
            this.options.callback('onMapInitialized');
    }

    /**
     * Called by the marker pin link, in order to show details of the location.
     * @param {string} locationId Location ID of location to show
     */
    onShowLocationDetails(locationId) {

        MapView.log("showing details to location with ID:" + locationId);

        if (this.options.callback !== undefined)
            this.options.callback('onShowLocationDetails', locationId);
    }

    /**
     * Called by the marker pin link, in order to start navigating to the location.
     * @param {string} locationId Location ID of location to navigate to
     */
    onNavigateToLocation(locationId) {

        MapView.log("navigation to location started, with ID:" + locationId);

        if (this.options.callback !== undefined)
            this.options.callback('onNavigateToLocation', locationId);
    }

    /**
     * Called by the "my position" pin link, in order to share the current location.
     */
    onShareMyLocation() {

        MapView.log("sharing my location started");

        if (this.options.callback !== undefined)
            this.options.callback('onShareMyLocation');
    }

    /**
     * Called by the "add find result" pin link, in order to add the find result as a waypoint.
     * @param {Object} [options] An object with the following properties:
     * @param {String} [options.name] Name of the find result
     * @param {Number} [options.latitude] Latitude of the find result
     * @param {Number} [options.longitude] Longitude of the find result
     */
    onAddFindResult(options) {

        MapView.log("adding find result as waypoint");

        if (this.options.callback !== undefined)
            this.options.callback('onAddFindResult', options);

        this.findResultMarker.show = false;

        // hide the info box
        this.viewer.selectedEntity = undefined;

        this.updateScene();
    }

    /**
     * Called when a long-tap occured on the map.
     * @param {Object} [options] An object with the following properties:
     * @param {Number} [options.latitude] Latitude of the long tap
     * @param {Number} [options.longitude] Longitude of the long tap
     * @param {Number} [options.altitude] Altitude of the long tap
     */
    onLongTap(options) {

        MapView.log("long-tap occured: lat=" + options.latitude +
            ", long=" + options.longitude +
            ", alt=" + options.altitude);

        if (this.options.callback !== undefined)
            this.options.callback('onLongTap', options);
    }

    /**
     * Called by the marker pin link, in order to add the location to tour planning.
     * @param {string} locationId Location ID of location to add
     */
    onAddTourPlanLocation(locationId) {

        MapView.log("adding tour planning location: id=" + locationId);

        if (this.options.callback !== undefined)
            this.options.callback('onAddTourPlanLocation', locationId);

        // hide the info box
        this.viewer.selectedEntity = undefined;
    }


    /**
     * Called when a console.error() is called, e.g. for rendering errors from CesiumJS.
     * @param {string} message error message
     */
    onConsoleErrorMessage(message) {

        if (this.options.callback !== undefined)
            this.options.callback('onConsoleErrorMessage', message);
    }

    /**
     * Called to update the last shown location stored in the app.
     * @param {Object} [options] An object with the following properties:
     * @param {Number} [options.latitude] Latitude of the position
     * @param {Number} [options.longitude] Longitude of the position
     * @param {Number} [options.altitude] Altitude of the position
     * @param {Number} [options.viewingDistance] viewing distance of camera; optional
     */
    onUpdateLastShownLocation(options) {

        options.viewingDistance = Math.floor(options.viewingDistance);

        MapView.log("updating last shown location: " +
            "lat=" + options.latitude +
            ", long=" + options.longitude +
            ", alt=" + options.altitude +
            ", viewingDistance=" + options.viewingDistance);

        if (this.options.callback !== undefined)
            this.options.callback('onUpdateLastShownLocation', options);
    }

    /**
     * Called by the "hide" link in the info text are of the flying range cone.
     */
    hideFlyingRangeCone() {

        MapView.log("hiding flying range cone");

        this.viewer.entities.remove(this.flyingRangeCone);

        this.updateScene();
    }

    /**
     * Called when the network connectivity has changed.
     * @param {boolean} isAvailable indicates if network is available now
     */
    onNetworkConnectivityChanged(isAvailable) {

        // retry initializing terrain provider
        if (isAvailable &&
            (this.viewer.terrainProvider === null || this.viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider))
            this.initTerrainProvider();
    }

    /**
     * Called when a layer was successfully exported as KMZ byte stream
     * @param {string} blobData KMZ data, as blob, or null
     */
    onExportLayer(blobData) {

        if (this.options.callback === undefined)
            return;

        // convert to base64
        var reader = new FileReader();
        var that = this;
        reader.onloadend = function () {
            var dataUrl = reader.result;
            var base64data = dataUrl.substr(dataUrl.indexOf(',') + 1);

            that.options.callback('onExportLayer', base64data);
        }

        reader.readAsDataURL(blobData);
    }

    /**
     * AIRAC cycle start dates, by year:
     * https://www.nm.eurocontrol.int/RAD/common/airac_dates.html
     */
    static airacStartDates = {
        2020: "2020-01-02",
        2021: "2021-01-28",
        2022: "2022-01-27",
        2023: "2023-01-26",
    };

    /**
     * Calculates the current airac ID, based on the current date. The first two
     * digits represent the last two year digits. The remaining two digits are
     * counted up from 1, every 28 days, starting on a specific date.
     * @returns {number} current airac ID
     */
    static calcCurrentAiracId() {
        var now = new Date();
        var currentYear = now.getFullYear();

        var baseAirac = new Date(MapView.airacStartDates[currentYear]);
        if (now < baseAirac) {
            currentYear--;
            baseAirac = new Date(MapView.airacStartDates[currentYear]);
        }

        var diffInDays = (now - baseAirac) / 86400000;

        var airacId = ((currentYear - 2000) * 100) + 1 + Math.floor(diffInDays / 28);
        return airacId;
    }
}
