﻿using MvvmHelpers.Commands;
using System;
using System.Threading.Tasks;
using System.Windows.Input;
using WhereToFly.App.Core.Services;
using WhereToFly.App.Logic;
using WhereToFly.App.Model;
using WhereToFly.Shared.Geo;
using WhereToFly.Shared.Model;
using Xamarin.Forms;

namespace WhereToFly.App.Core.ViewModels
{
    /// <summary>
    /// View model for the location details page
    /// </summary>
    public class LocationDetailsViewModel : ViewModelBase
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
        private double distance;

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
        /// Returns image source for SvgImage in order to display the type image
        /// </summary>
        public ImageSource TypeImageSource { get; }

        /// <summary>
        /// Returns if takeoff directions view should be visible at all
        /// </summary>
        public bool IsTakeoffDirectionsVisible
            => this.location.Type == LocationType.FlyingTakeoff;

        /// <summary>
        /// Takeoff directions flags; only set for FlyingTakeoff locations
        /// </summary>
        public TakeoffDirections TakeoffDirections
            => this.location.TakeoffDirections;

        /// <summary>
        /// Property containing location type
        /// </summary>
        public string Type
        {
            get
            {
                return this.location.Type.ToString();
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
        /// Property containing location altitude
        /// </summary>
        public string Altitude
        {
            get
            {
                return string.Format("{0} m", (int)this.location.MapLocation.Altitude.GetValueOrDefault(0.0));
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
        /// Command to execute when "refresh live waypoint" toolbar item is selected
        /// </summary>
        public ICommand RefreshLiveWaypointCommand { get; set; }

        /// <summary>
        /// Command to execute when "add tour plan location" toolbar item is selected
        /// </summary>
        public ICommand AddTourPlanLocationCommand { get; set; }

        /// <summary>
        /// Command to execute when "zoom to" menu item is selected on a location
        /// </summary>
        public ICommand ZoomToLocationCommand { get; set; }

        /// <summary>
        /// Command to execute when "navigate to" menu item is selected on a location
        /// </summary>
        public ICommand NavigateToLocationCommand { get; set; }

        /// <summary>
        /// Command to execute when "share" menu item is selected on a location
        /// </summary>
        public ICommand ShareLocationCommand { get; set; }

        /// <summary>
        /// Command to execute when "delete" menu item is selected on a location
        /// </summary>
        public ICommand DeleteLocationCommand { get; set; }
        #endregion

        /// <summary>
        /// Creates a new view model object based on the given location object
        /// </summary>
        /// <param name="appSettings">app settings object</param>
        /// <param name="location">location object</param>
        public LocationDetailsViewModel(AppSettings appSettings, Location location)
        {
            this.appSettings = appSettings;
            this.location = location;

            this.distance = 0.0;

            this.TypeImageSource =
                SvgImageCache.GetImageSource(location, "#000000");

            this.SetupBindings();
        }

        /// <summary>
        /// Sets up bindings for this view model
        /// </summary>
        private void SetupBindings()
        {
            this.DescriptionWebViewSource = new HtmlWebViewSource
            {
                Html = FormatLocationDescription(this.location),
                BaseUrl = "about:blank"
            };

            this.RefreshLiveWaypointCommand = new AsyncCommand(this.OnRefreshLiveWaypoint);
            this.AddTourPlanLocationCommand =
                new Xamarin.Forms.Command(this.OnAddTourPlanLocation);
            this.ZoomToLocationCommand = new AsyncCommand(this.OnZoomToLocationAsync);
            this.NavigateToLocationCommand = new AsyncCommand(this.OnNavigateToLocationAsync);
            this.ShareLocationCommand = new AsyncCommand(this.OnShareLocationAsync);
            this.DeleteLocationCommand = new AsyncCommand(this.OnDeleteLocationAsync);

            Task.Run(this.UpdateDistance);
        }

        /// <summary>
        /// Formats location description
        /// </summary>
        /// <param name="location">location to format description</param>
        /// <returns>formatted description text</returns>
        private static string FormatLocationDescription(Location location)
        {
            string desc = location.Description;

            bool hasHtmlTags = desc.Contains("<") &&
                (desc.Contains("</") || desc.Contains("/>"));

            if (!hasHtmlTags)
            {
                // try to format as markdown
                desc = HtmlConverter.FromMarkdown(desc, null);
            }

            return $"<span style=\"font-family:sans-serif\">{desc}</span>";
        }

        /// <summary>
        /// Updates distance to current position
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task UpdateDistance()
        {
            var geolocationService = DependencyService.Get<GeolocationService>();
            var position = await geolocationService.GetCurrentPositionAsync();

            if (position != null)
            {
                this.distance = position.DistanceTo(this.location.MapLocation);

                this.OnPropertyChanged(nameof(this.Distance));
            }
        }

        /// <summary>
        /// Called when "Refresh live waypoint" toolbar button is selected
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task OnRefreshLiveWaypoint()
        {
            try
            {
                var dataService = DependencyService.Get<IDataService>();
                var result = await dataService.GetLiveWaypointDataAsync(this.location.InternetLink);

                this.location.MapLocation =
                    new MapPoint(result.Data.Latitude, result.Data.Longitude, result.Data.Altitude);

                this.location.Description = result.Data.Description.Replace("\n", "<br/>");

                this.DescriptionWebViewSource = new HtmlWebViewSource
                {
                    Html = this.location.Description,
                    BaseUrl = "about:blank"
                };

                this.OnPropertyChanged(nameof(this.Latitude));
                this.OnPropertyChanged(nameof(this.Longitude));
                this.OnPropertyChanged(nameof(this.Altitude));
                this.OnPropertyChanged(nameof(this.Distance));
                this.OnPropertyChanged(nameof(this.DescriptionWebViewSource));

                // store new infos in location list
                var locationDataService = dataService.GetLocationDataService();

                var locationInList = await locationDataService.Get(this.location.Id);
                locationInList.MapLocation = this.location.MapLocation;
                locationInList.Description = this.location.Description;

                await locationDataService.Update(locationInList);

                var liveWaypointRefreshService = DependencyService.Get<LiveWaypointRefreshService>();
                liveWaypointRefreshService.RemoveLiveWaypoint(locationInList.Id);
                liveWaypointRefreshService.AddLiveWaypoint(locationInList);
            }
            catch (Exception ex)
            {
                App.LogError(ex);

                await App.Current.MainPage.DisplayAlert(
                    Constants.AppTitle,
                    "Error while refreshing live waypoint: " + ex.Message,
                    "OK");
            }
        }

        /// <summary>
        /// Called when "Add tour plan location" toolbar button is selected
        /// </summary>
        private void OnAddTourPlanLocation()
        {
            App.AddTourPlanLocation(this.location);
        }

        /// <summary>
        /// Called when "Zoom to" menu item is selected
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task OnZoomToLocationAsync()
        {
            await App.UpdateLastShownPositionAsync(this.location.MapLocation);

            App.MapView.ZoomToLocation(this.location.MapLocation);

            await NavigationService.Instance.NavigateAsync(Constants.PageKeyMapPage, animated: true);
        }

        /// <summary>
        /// Called when "Navigate here" menu item is selected
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task OnNavigateToLocationAsync()
        {
            var navigateLocation = new Xamarin.Essentials.Location(
                latitude: this.location.MapLocation.Latitude,
                longitude: this.location.MapLocation.Longitude);

            var options = new Xamarin.Essentials.MapLaunchOptions
            {
                Name = this.location.Name,
                NavigationMode = Xamarin.Essentials.NavigationMode.Driving,
            };

            await Xamarin.Essentials.Map.OpenAsync(navigateLocation, options);
        }

        /// <summary>
        /// Called when "Share" menu item is selected
        /// </summary>
        /// <returns>task to wait for</returns>
        private async Task OnShareLocationAsync()
        {
            string text = "Share this location with...";
            string message = DataFormatter.FormatLocationShareText(this.location);

            await App.ShareMessageAsync(text, message);
        }

        /// <summary>
        /// Called when "Delete" menu item is selected
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task OnDeleteLocationAsync()
        {
            var dataService = DependencyService.Get<IDataService>();
            var locationDataService = dataService.GetLocationDataService();

            await locationDataService.Remove(this.location.Id);

            var liveWaypointRefreshService = DependencyService.Get<LiveWaypointRefreshService>();
            liveWaypointRefreshService.RemoveLiveWaypoint(this.location.Id);

            App.UpdateMapLocationsList();

            await NavigationService.Instance.GoBack();

            App.ShowToast("Selected location was deleted.");
        }
    }
}
