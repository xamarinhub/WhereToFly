﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WhereToFly.App.Core.Services;
using WhereToFly.App.Logic;
using WhereToFly.App.Logic.Model;
using Xamarin.Forms;

namespace WhereToFly.App.Core.ViewModels
{
    /// <summary>
    /// View model for the edit location details page
    /// </summary>
    public class EditLocationDetailsViewModel
    {
        /// <summary>
        /// App settings object
        /// </summary>
        private readonly AppSettings appSettings;

        /// <summary>
        /// Location object to edit
        /// </summary>
        private readonly Location location;

        /// <summary>
        /// All location types that can be selected by the user
        /// </summary>
        private readonly List<LocationType> allLocationTypes;

        #region Binding properties
        /// <summary>
        /// Property containing location name
        /// </summary>
        public string Name
        {
            get { return this.location.Name; }
            set { this.location.Name = value; }
        }

        /// <summary>
        /// Property containing location name
        /// </summary>
        public string Description
        {
            get { return this.location.Description; }
            set { this.location.Description = value; }
        }

        /// <summary>
        /// List of all location types that can be selected
        /// </summary>
        public string[] LocationTypeList
        {
            get
            {
                return
                    (from locationType in this.allLocationTypes
                     select locationType.ToString()).ToArray();
            }
        }

        /// <summary>
        /// Property containing location type
        /// </summary>
        public string Type
        {
            get
            {
                return this.location.Type.ToString();
            }

            set
            {
                string locationType = value;
                this.location.Type = this.allLocationTypes.Find(x => x.ToString() == locationType);
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
                return this.location.Elevation.ToString();
            }

            set
            {
                try
                {
                    this.location.Elevation = (double)System.Convert.ToInt32(value);
                }
                catch (Exception)
                {
                    // ignore errors when converting
                }
            }
        }

        /// <summary>
        /// Property containing location internet link
        /// </summary>
        public string InternetLink
        {
            get { return this.location.InternetLink; }
            set { this.location.InternetLink = value; }
        }
        #endregion

        /// <summary>
        /// Creates a new edit location details view model
        /// </summary>
        /// <param name="appSettings">app settings to use</param>
        /// <param name="location">location object to edit</param>
        public EditLocationDetailsViewModel(AppSettings appSettings, Location location)
        {
            this.appSettings = appSettings;
            this.location = location;
            this.allLocationTypes = new List<LocationType>();

            this.SetupBindings();
        }

        /// <summary>
        /// Sets up bindings properties
        /// </summary>
        private void SetupBindings()
        {
            foreach (LocationType locationType in Enum.GetValues(typeof(LocationType)))
            {
                if (locationType != LocationType.Undefined)
                {
                    this.allLocationTypes.Add(locationType);
                }
            }
        }

        /// <summary>
        /// Saves changes in location object
        /// </summary>
        /// <returns>task to wait on</returns>
        public async Task SaveChangesAsync()
        {
            var dataService = DependencyService.Get<DataService>();

            var locationList = await dataService.GetLocationListAsync(CancellationToken.None);

            var locationToChange = locationList.Find(x => x.Id == this.location.Id);

            if (locationToChange == null)
            {
                await App.Current.MainPage.DisplayAlert(
                    Constants.AppTitle,
                    "Error while saving location; not in location list!",
                    "OK");

                return;
            }

            locationToChange.Name = this.location.Name;
            locationToChange.Type = this.location.Type;
            locationToChange.Description = this.location.Description;
            locationToChange.Elevation = this.location.Elevation;
            locationToChange.InternetLink = this.location.InternetLink;

            await dataService.StoreLocationListAsync(locationList);
        }
    }
}
