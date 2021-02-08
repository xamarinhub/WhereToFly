﻿using System;
using WhereToFly.Shared.Model;

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
        /// Visual Studio App Center key for UWP app
        /// </summary>
        public const string AppCenterKeyUwp = "74bfda82-7b61-4490-ac61-b28ec404c1fc";

        /// <summary>
        /// MessagingCenter message constant to show toast message
        /// </summary>
        public const string MessageShowToast = "ShowToast";

        /// <summary>
        /// Clears cache of web view control
        /// </summary>
        public const string MessageWebViewClearCache = "WebViewClearCache";

        /// <summary>
        /// MessagingCenter message constant to add tour plan location
        /// </summary>
        public const string MessageAddTourPlanLocation = "AddTourPlanLocation";

        /// <summary>
        /// MessagingCenter message constant to update settings on MapPage
        /// </summary>
        public const string MessageUpdateMapSettings = "UpdateMapSettings";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to map page
        /// </summary>
        public const string PageKeyMapPage = "MapPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to layer list page
        /// </summary>
        public const string PageKeyLayerListPage = "LayerListPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to layer details page. The layer
        /// must be passed as parameter to the NavigationService.
        /// </summary>
        public const string PageKeyLayerDetailsPage = "LayerDetailsPage";

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
        /// Page key for use in NavigationService, to navigate to track list page.
        /// </summary>
        public const string PageKeyTrackListPage = "TrackListPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to track info page.
        /// </summary>
        public const string PageKeyTrackInfoPage = "TrackInfoPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to track height profile page.
        /// </summary>
        public const string PageKeyTrackHeightProfilePage = "TrackHeightProfile";

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
        /// The page must be started with a TaskCompletionSource with WeatherIconDescription as
        /// parameter that is used to set a result when a weather icon was selected.
        /// </summary>
        public const string PageKeySelectWeatherIconPage = "SelectWeatherIconPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to settings page
        /// </summary>
        public const string PageKeySettingsPage = "SettingsPage";

        /// <summary>
        /// Page key for use in NavigationService, to navigate to info page
        /// </summary>
        public const string PageKeyInfoPage = "InfoPage";

        /// <summary>
        /// GeoLocation: Minimum distance to travel to send the next update
        /// </summary>
        public const double GeoLocationMinimumDistanceForUpdateInMeters = 2;

        /// <summary>
        /// GeoLocation: Time span that must elapse until the next update is sent
        /// </summary>
        public static readonly TimeSpan GeoLocationMinimumTimeForUpdate = TimeSpan.FromSeconds(5);

        /// <summary>
        /// Primary color for User Interface
        /// </summary>
        public static readonly Xamarin.Forms.Color PrimaryColor = Xamarin.Forms.Color.FromHex("2F299E");

        /// <summary>
        /// Initial center point for the map when no last know position is available
        /// </summary>
        public static readonly MapPoint InitialCenterPoint = new MapPoint(47.67, 11.88);

        /// <summary>
        /// Bing maps API key; used for displaying Bing maps layer
        /// </summary>
        public static readonly string BingMapsKey = "AuuY8qZGx-LAeruvajcGMLnudadWlphUWdWb0k6N6lS2QUtURFk3ngCjIXqqFOoe";

        /// <summary>
        /// Bing maps API key; used for geocoding in UWP app
        /// </summary>
        public static readonly string BingMapsKeyUwp = "8KK08riht3IKUuEIHhO9~kiUuKLsWDkuE5jm4d2gBDQ~Aho0ktyzI5HmMR7lM_2JwyptBV5ltSyzJAgvfISK_RE1BexmpSH2bInepuuZrMjP";

        /// <summary>
        /// Key for the SecureStorage to store and read username for Alptherm web page
        /// </summary>
        public static readonly string SecureSettingsAlpthermUsername = "AlpthermUsername";

        /// <summary>
        /// Key for the SecureStorage to store and read password for Alptherm web page
        /// </summary>
        [System.Diagnostics.CodeAnalysis.SuppressMessage(
            "Sonar Vulnerability",
            "S2068:Hard-coded credentials are security-sensitive",
            Justification = "false positive")]
        public static readonly string SecureSettingsAlpthermPassword = "AlpthermPassword";
    }
}
