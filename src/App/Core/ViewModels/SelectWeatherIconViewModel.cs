﻿using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using WhereToFly.App.Model;
using Xamarin.Forms;

namespace WhereToFly.App.Core.ViewModels
{
    /// <summary>
    /// View model for the weather icon selection page. Used by SelectWeatherIconPage and
    /// SelectWeatherIconPopupPage.
    /// </summary>
    public partial class SelectWeatherIconViewModel : ViewModelBase
    {
        #region Binding properties
        /// <summary>
        /// Current location list; may be filtered by filter text
        /// </summary>
        public ObservableCollection<WeatherIconListEntryViewModel> WeatherIconList { get; set; }

        /// <summary>
        /// Command to execute when an item in the weather icon list has been tapped
        /// </summary>
        public Command<WeatherIconDescription> ItemTappedCommand { get; private set; }
        #endregion

        /// <summary>
        /// Creates a new select weather icon view model
        /// </summary>
        /// <param name="selectAction">action to call when a weather icon description was selected</param>
        /// <param name="group">group to filter by, or null to show all groups</param>
        public SelectWeatherIconViewModel(Action<WeatherIconDescription> selectAction, string group = null)
        {
            Debug.Assert(selectAction != null, "selectAction must not be null");

            this.SetupBindings(selectAction, group);
        }

        /// <summary>
        /// Sets up bindings properties
        /// </summary>
        /// <param name="selectAction">action to call when a weather icon description was selected</param>
        /// <param name="group">group to filter by, or null to show all groups</param>
        private void SetupBindings(Action<WeatherIconDescription> selectAction, string group)
        {
            this.ItemTappedCommand = new Command<WeatherIconDescription>(selectAction);

            Task.Run(() =>
            {
                var dataService = DependencyService.Get<IDataService>();

                var weatherIconList = dataService.GetWeatherIconDescriptionRepository();
                if (!weatherIconList.Any())
                {
                    weatherIconList = new List<WeatherIconDescription>
                    {
                        new WeatherIconDescription
                        {
                            Name = "Add new...",
                            Type = WeatherIconDescription.IconType.IconPlaceholder,
                        },
                    };
                }

                this.WeatherIconList = new ObservableCollection<WeatherIconListEntryViewModel>(
                    from weatherIcon in weatherIconList
                    where @group == null || @group == weatherIcon.Group
                    select new WeatherIconListEntryViewModel(weatherIcon));

                this.OnPropertyChanged(nameof(this.WeatherIconList));
            });
        }
    }
}
