﻿using System;

namespace WhereToFly.App.Core
{
    /// <summary>
    /// Constants for the app
    /// </summary>
    public static class Constants
    {
        /// <summary>
        /// App title for display in pages and alert boxes
        /// </summary>
        public const string AppTitle = "Where-to-fly";

        /// <summary>
        /// Visual Studio App Center key for Android app
        /// </summary>
        public const string AppCenterKeyAndroid = "dc3a41ea-d024-41a8-9940-4529a24086b1";

        /// <summary>
        /// MessagingCenter message constant to show toast message
        /// </summary>
        public const string MessageShowToast = "ShowToast";

        /// <summary>
        /// MessagingCenter message constant to zoom to a location on MapPage
        /// </summary>
        public const string MessageZoomToLocation = "ZoomToLocation";

        /// <summary>
        /// MessagingCenter message constant to update settings on MapPage
        /// </summary>
        public const string MessageUpdateMapSettings = "UpdateMapSettings";

        /// <summary>
        /// MessagingCenter message constant to update location list on MapPage
        /// </summary>
        public const string MessageUpdateMapLocations = "UpdateMapLocations";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to map page
        /// </summary>
        public const string PageKeyMapPage = "MapPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to current position details page
        /// </summary>
        public const string PageKeyCurrentPositionDetailsPage = "CurrentPositionDetailsPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to location list page
        /// </summary>
        public const string PageKeyLocationListPage = "LocationListPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to location details page. The
        /// location must be passed as parameter to the NavigationService.
        /// </summary>
        public const string PageKeyLocationDetailsPage = "LocationDetailsPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to edit location details page. The
        /// location to edit must be passed as parameter to the NavigationService.
        /// </summary>
        public const string PageKeyEditLocationDetailsPage = "EditLocationDetailsPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to weather dashboard page.
        /// </summary>
        public const string PageKeyWeatherDashboardPage = "WeatherDashboardPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to weather details page. The page
        /// must be started with a string parameter specifying the URL of the web page to display.
        /// </summary>
        public const string PageKeyWeatherDetailsPage = "WeatherDetailsPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to weather icon selection page.
        /// The page must be started with an Action with WeatherIconDescription as parameter that
        /// is called when a weather icon was selected.
        /// </summary>
        public const string PageKeySelectWeatherIconPage = "SelectWeatherIconPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to settings page
        /// </summary>
        public const string PageKeySettingsPage = "SettingsPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to import locations page
        /// </summary>
        public const string PageKeyImportLocationsPage = "ImportLocationsPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to info page
        /// </summary>
        public const string PageKeyInfoPage = "InfoPage";

        /// <summary>
        /// Primary color for User Interface
        /// </summary>
        public static readonly Xamarin.Forms.Color PrimaryColor = Xamarin.Forms.Color.FromHex("2F299E");

        /// <summary>
        /// GeoLocation: Time span that must elapse until the next update is sent
        /// </summary>
        public static readonly TimeSpan GeoLocationMinimumTimeForUpdate = TimeSpan.FromSeconds(5);

        /// <summary>
        /// GeoLocation: Minimum distance to travel to send the next update
        /// </summary>
        public const double GeoLocationMinimumDistanceForUpdateInMeters = 2;
    }
}
