﻿using System.ComponentModel;
using System.Threading.Tasks;
using WhereToFly.App.Model;
using Xamarin.Forms;

namespace WhereToFly.App.Core.ViewModels
{
    /// <summary>
    /// View model for a weather icon as a list entry
    /// </summary>
    public class WeatherIconListEntryViewModel : INotifyPropertyChanged
    {
        #region Binding properties
        /// <summary>
        /// Title of weather icon
        /// </summary>
        public string Title { get => this.IconDescription.Name; }

        /// <summary>
        /// Image source for weather icon
        /// </summary>
        public ImageSource Icon { get; private set; }
        #endregion

        /// <summary>
        /// Weather icon description instance
        /// </summary>
        public WeatherIconDescription IconDescription { get; private set; }

        /// <summary>
        /// Creates a new weather icon view model from weather icon description
        /// </summary>
        /// <param name="iconDescription">weather icon description to use</param>
        public WeatherIconListEntryViewModel(WeatherIconDescription iconDescription)
        {
            this.IconDescription = iconDescription;

            this.SetupBindings();
        }

        /// <summary>
        /// Sets up bindings properties
        /// </summary>
        private void SetupBindings()
        {
            Task.Run(async () =>
            {
                var imageCache = DependencyService.Get<WeatherImageCache>();

                this.Icon = await imageCache.GetImageAsync(this.IconDescription);

                this.OnPropertyChanged(nameof(this.Icon));
            });
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
    }
}
