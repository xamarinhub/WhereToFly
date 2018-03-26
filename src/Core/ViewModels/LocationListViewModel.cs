﻿using Plugin.Geolocator.Abstractions;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WhereToFly.Core.Services;
using WhereToFly.Geo.Spatial;
using WhereToFly.Logic.Model;
using Xamarin.Forms;

namespace WhereToFly.Core.ViewModels
{
    /// <summary>
    /// View model for the location list page
    /// </summary>
    public class LocationListViewModel : INotifyPropertyChanged, IDisposable
    {
        /// <summary>
        /// Location list
        /// </summary>
        private List<Location> locationList = new List<Location>();

        /// <summary>
        /// Backing store for FilterText property
        /// </summary>
        private string filterText = string.Empty;

        /// <summary>
        /// Timer that is triggered after filter text was updated and 
        /// </summary>
        private System.Timers.Timer filterTextUpdateTimer = new System.Timers.Timer(1000.0);

        #region Binding properties
        /// <summary>
        /// Current location list; may be filtered by filter text
        /// </summary>
        public ObservableCollection<LocationInfoViewModel> LocationList { get; set; }

        /// <summary>
        /// Filter text string that filters entries by text
        /// </summary>
        public string FilterText
        {
            get
            {
                return this.filterText;
            }

            set
            {
                this.filterText = value;

                this.filterTextUpdateTimer.Stop();
                this.filterTextUpdateTimer.Start();
            }
        }

        /// <summary>
        /// Returns true when the location list has entries, but all entries were filtered out by
        /// the filter text
        /// </summary>
        public bool AreAllLocationsFilteredOut
        {
            get
            {
                return this.locationList.Any() &&
                    !this.LocationList.Any();
            }
        }

        /// <summary>
        /// Command to execute when an item in the location list has been tapped
        /// </summary>
        public Command<Location> ItemTappedCommand { get; private set; }
        #endregion

        /// <summary>
        /// Creates a new view model object for location list
        /// </summary>
        /// <param name="appSettings">app settings to use</param>
        public LocationListViewModel(AppSettings appSettings)
        {
            this.filterText = appSettings.LastLocationListFilterText;

            this.filterTextUpdateTimer.Elapsed += (sender, args) =>
            {
                App.RunOnUiThread(() => this.UpdateLocationList());
            };

            this.SetupBindings();
        }

        /// <summary>
        /// Sets up bindings properties
        /// </summary>
        private void SetupBindings()
        {
            Task.Factory.StartNew(this.LoadDataAsync);

            this.ItemTappedCommand =
                new Command<Location>(async (location) =>
                {
                    await this.NavigateToLocationDetails(location);
                });
        }

        /// <summary>
        /// Loads data; async method
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task LoadDataAsync()
        {
            var dataService = DependencyService.Get<DataService>();

            this.locationList = await dataService.GetLocationListAsync(CancellationToken.None);

            this.UpdateLocationList();
        }

        /// <summary>
        /// Updates location list based on filter and current position
        /// </summary>
        private void UpdateLocationList()
        {
            if (string.IsNullOrWhiteSpace(this.filterText))
            {
                var locationViewModelList =
                    from location in this.locationList
                    orderby location.Distance
                    select new LocationInfoViewModel(location);

                this.LocationList = new ObservableCollection<LocationInfoViewModel>(locationViewModelList);
            }
            else
            {
                var filteredLocationList =
                    from location in this.locationList
                    where this.IsFilterMatch(location)
                    orderby location.Distance
                    select new LocationInfoViewModel(location);

                this.LocationList = new ObservableCollection<LocationInfoViewModel>(filteredLocationList);
            }

            this.OnPropertyChanged(nameof(this.LocationList));
            this.OnPropertyChanged(nameof(this.AreAllLocationsFilteredOut));
        }

        /// <summary>
        /// Checks if given location is a current filter match, based on the filter text
        /// </summary>
        /// <param name="location">location to check</param>
        /// <returns>matching filter</returns>
        private bool IsFilterMatch(Location location)
        {
            if (string.IsNullOrWhiteSpace(this.filterText))
            {
                return true;
            }

            string text = this.filterText;

            bool inName = location.Name != null &&
                location.Name.IndexOf(text, 0, StringComparison.OrdinalIgnoreCase) >= 0;

            bool inDescription = !inName &&
                location.Description != null &&
                location.Description.IndexOf(text, 0, StringComparison.OrdinalIgnoreCase) >= 0;

            bool inInternetLink = !inDescription &&
                location.InternetLink != null &&
                location.InternetLink.IndexOf(text, 0, StringComparison.OrdinalIgnoreCase) >= 0;

            bool inMapLocation = !inInternetLink &&
                location.MapLocation != null &&
                location.MapLocation.ToString().IndexOf(text, 0, StringComparison.OrdinalIgnoreCase) >= 0;

            bool inElevation = !inMapLocation &&
                location.Elevation != 0 &&
                ((int)location.Elevation).ToString().IndexOf(text, 0, StringComparison.OrdinalIgnoreCase) >= 0;

            bool inDistance = !inElevation &&
                Math.Abs(location.Distance) > 1e-6 &&
                LocationInfoViewModel.FormatDistance(location.Distance).IndexOf(text, 0, StringComparison.OrdinalIgnoreCase) >= 0;

            return
                inName ||
                inDescription ||
                inInternetLink ||
                inMapLocation ||
                inElevation ||
                inDistance;
        }

        /// <summary>
        /// Navigates to location info page, showing details about given location
        /// </summary>
        /// <param name="location">location to show</param>
        /// <returns>task to wait on</returns>
        private async Task NavigateToLocationDetails(Location location)
        {
            await Task.CompletedTask;
            //// TODO implement
            ////await NavigationService.Instance.NavigateAsync(Constants.PageKeyLocationInfoPage, true, location);
        }

        /// <summary>
        /// Reloads location list and shows it on the page
        /// </summary>
        /// <returns>task to wait on</returns>
        public async Task ReloadLocationListAsync()
        {
            await this.LoadDataAsync();
            this.UpdateLocationList();
        }

        /// <summary>
        /// Called when position has changed; updates distance of locations to the current
        /// position and updates location list
        /// </summary>
        /// <param name="sender">sender object</param>
        /// <param name="args">event args, including position</param>
        public void OnPositionChanged(object sender, PositionEventArgs args)
        {
            var myPosition = new LatLongAlt(args.Position.Latitude, args.Position.Longitude);

            foreach (var location in this.locationList)
            {
                var locationPosition = new LatLongAlt(location.MapLocation.Latitude, location.MapLocation.Longitude);

                location.Distance = locationPosition.DistanceTo(myPosition);
            }

            this.UpdateLocationList();
        }

        #region INotifyPropertyChanged implementation
        /// <summary>
        /// Event that gets signaled when a property has changed
        /// </summary>
        public event PropertyChangedEventHandler PropertyChanged;

        /// <summary>
        /// Call this method to signal that a property has changed
        /// </summary>
        /// <param name="propertyName">property name; use C# 6 nameof() operator</param>
        protected virtual void OnPropertyChanged(string propertyName)
        {
            this.PropertyChanged?.Invoke(
                this,
                new PropertyChangedEventArgs(propertyName));
        }
        #endregion

        #region IDisposable Support
        /// <summary>
        /// To detect redundant calls
        /// </summary>
        private bool disposedValue = false;

        /// <summary>
        /// Disposes of managed and unmanaged resources
        /// </summary>
        /// <param name="disposing">
        /// true when called from Dispose(), false when called from finalizer
        /// </param>
        protected virtual void Dispose(bool disposing)
        {
            if (!this.disposedValue)
            {
                if (disposing)
                {
                    this.filterTextUpdateTimer.Stop();
                    this.filterTextUpdateTimer.Dispose();
                    this.filterTextUpdateTimer = null;
                }

                this.disposedValue = true;
            }
        }

        /// <summary>
        /// This code added to correctly implement the disposable pattern.
        /// </summary>
        public void Dispose()
        {
            // Do not change this code. Put cleanup code in Dispose(bool disposing) above.
            this.Dispose(true);
        }
        #endregion
    }
}
