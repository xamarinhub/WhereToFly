﻿using System;
using System.Threading.Tasks;
using WhereToFly.Geo.Model;
using Xamarin.Essentials;

namespace WhereToFly.App.Core.Services
{
    /// <summary>
    /// Geographic location service
    /// </summary>
    public class GeolocationService : IGeolocationService
    {
        /// <summary>
        /// Indicates if the geolocation service is already listening for position changes
        /// </summary>
        private bool isListening;

        /// <summary>
        /// Event handler that is called for position changes
        /// </summary>
        public event EventHandler<GeolocationEventArgs> PositionChanged;

        /// <summary>
        /// Checks for permission to use location.
        /// </summary>
        /// <returns>true when everything is ok, false when permission wasn't given</returns>
        private static async Task<bool> CheckPermissionAsync()
        {
            if (!MainThread.IsMainThread)
            {
                return await MainThread.InvokeOnMainThreadAsync(CheckPermissionAsync);
            }

            try
            {
                var status = await Permissions.CheckStatusAsync<Permissions.LocationWhenInUse>();

                if (status != PermissionStatus.Granted)
                {
                    status = await Permissions.RequestAsync<Permissions.LocationWhenInUse>();
                }

                if (Permissions.ShouldShowRationale<Permissions.LocationWhenInUse>() &&
                    status != PermissionStatus.Granted)
                {
                    await Xamarin.Forms.Application.Current.MainPage.DisplayAlert(
                        Constants.AppTitle,
                        "The location permission is needed in order to locate your position on the map",
                        "OK");
                }

                return status == PermissionStatus.Granted;
            }
            catch (Exception ex)
            {
                App.LogError(ex);
                throw;
            }
        }

        /// <summary>
        /// Returns current position
        /// </summary>
        /// <param name="timeout">timeout for waiting for position</param>
        /// <returns>current position, or null when none could be retrieved</returns>
        public async Task<Xamarin.Essentials.Location> GetPositionAsync(TimeSpan timeout)
        {
            if (!await CheckPermissionAsync())
            {
                return null;
            }

            return await Geolocation.GetLocationAsync(
                new GeolocationRequest(GeolocationAccuracy.Default, timeout));
        }

        /// <summary>
        /// Returns last known position
        /// </summary>
        /// <returns>last known position, or null when none could be retrieved</returns>
        public async Task<MapPoint> GetLastKnownPositionAsync()
        {
            var location = await Geolocation.GetLastKnownLocationAsync();
            if (location == null)
            {
                return null;
            }

            return new MapPoint(location.Latitude, location.Longitude, location.Altitude);
        }

        /// <summary>
        /// Starts listening for location updates
        /// </summary>
        /// <returns>true when successful, false when not</returns>
        public async Task<bool> StartListeningAsync()
        {
            if (this.isListening)
            {
                return true;
            }

            if (!await CheckPermissionAsync())
            {
                return false;
            }

            WhereToFly.App.Essentials.Geolocation.LocationChanged += this.OnLocationChanged;

            return await WhereToFly.App.Essentials.Geolocation.StartListeningForegroundAsync(
                new GeolocationRequest(
                    GeolocationAccuracy.Best,
                    Constants.GeoLocationMinimumTimeForUpdate));
        }

        /// <summary>
        /// Called when the position has changed
        /// </summary>
        /// <param name="sender">sender object</param>
        /// <param name="args">event args</param>
        private void OnLocationChanged(object sender, WhereToFly.App.Essentials.Geolocation.LocationEventArgs args)
        {
            this.PositionChanged?.Invoke(
                sender,
                new GeolocationEventArgs(args.Location));
        }

        /// <summary>
        /// Stops listening for location updates
        /// </summary>
        /// <returns>task to wait on</returns>
        public async Task StopListeningAsync()
        {
            if (!this.isListening)
            {
                return;
            }

            WhereToFly.App.Essentials.Geolocation.LocationChanged -= this.OnLocationChanged;

            await WhereToFly.App.Essentials.Geolocation.StopListeningForegroundAsync();

            this.isListening = false;
        }
    }
}
