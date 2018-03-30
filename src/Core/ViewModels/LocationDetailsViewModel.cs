﻿using System.Threading;
using System.Threading.Tasks;
using WhereToFly.Core.Services;
using WhereToFly.Geo.Spatial;
using WhereToFly.Logic;
using WhereToFly.Logic.Model;
using Xamarin.Forms;

namespace WhereToFly.Core.ViewModels
{
    /// <summary>
    /// View model for the location details page
    /// </summary>
    public class LocationDetailsViewModel
    {
        /// <summary>
        /// App settings object
        /// </summary>
        private readonly AppSettings appSettings;

        /// <summary>
        /// Location to show
        /// </summary>
        private readonly Location location;

        /// <summary>
        /// Distance to the user's current location
        /// </summary>
        private readonly double distance;

        #region Binding properties
        /// <summary>
        /// Property containing location name
        /// </summary>
        public string Name
        {
            get
            {
                return this.location.Name;
            }
        }

        /// <summary>
        /// Property containing location latitude
        /// </summary>
        public string Latitude
        {
            get
            {
                return !this.location.MapLocation.Valid ? string.Empty :
                    DataFormatter.FormatLatLong(this.location.MapLocation.Latitude, this.appSettings.CoordinateDisplayFormat);
            }
        }

        /// <summary>
        /// Property containing location longitude
        /// </summary>
        public string Longitude
        {
            get
            {
                return !this.location.MapLocation.Valid ? string.Empty :
                    DataFormatter.FormatLatLong(this.location.MapLocation.Longitude, this.appSettings.CoordinateDisplayFormat);
            }
        }

        /// <summary>
        /// Property containing location longitude
        /// </summary>
        public string Altitude
        {
            get
            {
                return string.Format("{0} m", (int)this.location.Elevation);
            }
        }

        /// <summary>
        /// Property containing location distance
        /// </summary>
        public string Distance
        {
            get
            {
                return DataFormatter.FormatDistance(this.distance);
            }
        }

        /// <summary>
        /// Property containing location internet link
        /// </summary>
        public string InternetLink
        {
            get
            {
                return this.location.InternetLink;
            }
        }

        /// <summary>
        /// Property containing location description
        /// </summary>
        public WebViewSource DescriptionWebViewSource
        {
            get; private set;
        }

        /// <summary>
        /// Command to execute when "zoom to" menu item is selected on a location
        /// </summary>
        public Command ZoomToLocationCommand { get; set; }

        /// <summary>
        /// Command to execute when "navigate to" menu item is selected on a location
        /// </summary>
        public Command NavigateToLocationCommand { get; set; }

        /// <summary>
        /// Command to execute when "delete" menu item is selected on a location
        /// </summary>
        public Command DeleteLocationCommand { get; set; }
        #endregion

        /// <summary>
        /// Creates a new view model object based on the given location object
        /// </summary>
        /// <param name="appSettings">app settings object</param>
        /// <param name="location">location object</param>
        /// <param name="myCurrentPosition">the user's current position; may be null</param>
        public LocationDetailsViewModel(AppSettings appSettings, Location location, LatLongAlt myCurrentPosition)
        {
            this.appSettings = appSettings;
            this.location = location;

            this.distance = myCurrentPosition != null ? myCurrentPosition.DistanceTo(
                new LatLongAlt(
                    this.location.MapLocation.Latitude,
                    this.location.MapLocation.Longitude)) : 0.0;

            this.SetupBindings();
        }

        /// <summary>
        /// Sets up bindings for this view model
        /// </summary>
        private void SetupBindings()
        {
            this.DescriptionWebViewSource = new HtmlWebViewSource
            {
                Html = this.location.Description,
                BaseUrl = "about:blank"
            };

            this.ZoomToLocationCommand =
                new Command(async () => await this.OnZoomToLocationAsync());

            this.NavigateToLocationCommand =
                new Command(this.OnNavigateToLocation);

            this.DeleteLocationCommand =
                new Command(async () => await this.OnDeleteLocationAsync());
        }

        /// <summary>
        /// Called when "Zoom to" menu item is selected
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task OnZoomToLocationAsync()
        {
            App.ZoomToLocation(this.location.MapLocation);

            // navigate back 2x, since the details can only be viewed from the location list page
            await NavigationService.Instance.GoBack();
            await NavigationService.Instance.GoBack();
        }

        /// <summary>
        /// Called when "Navigate here" menu item is selected
        /// </summary>
        private void OnNavigateToLocation()
        {
            Plugin.ExternalMaps.CrossExternalMaps.Current.NavigateTo(
                this.location.Name,
                this.location.MapLocation.Latitude,
                this.location.MapLocation.Longitude,
                Plugin.ExternalMaps.Abstractions.NavigationType.Driving);
        }

        /// <summary>
        /// Called when "Delete" menu item is selected
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task OnDeleteLocationAsync()
        {
            var dataService = DependencyService.Get<DataService>();

            var locationList = await dataService.GetLocationListAsync(CancellationToken.None);

            locationList.Remove(this.location);

            await dataService.StoreLocationListAsync(locationList);

            App.ShowToast("Selected location was deleted.");

            await NavigationService.Instance.GoBack();
        }
    }
}
