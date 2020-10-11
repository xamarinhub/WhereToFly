﻿using WhereToFly.App.Core.Controls;
using WhereToFly.App.Geo;
using Xamarin.Forms;

namespace WhereToFly.App.Core.Views
{
    /// <summary>
    /// Page showing a track height profile
    /// </summary>
    public class TrackHeightProfilePage : ContentPage
    {
        /// <summary>
        /// Creates track height profile page
        /// </summary>
        /// <param name="track">track to display</param>
        public TrackHeightProfilePage(Track track)
        {
            this.Content = new HeightProfileWebView
            {
                HorizontalOptions = LayoutOptions.FillAndExpand,
                VerticalOptions = LayoutOptions.FillAndExpand,
                Track = track
            };

            this.AutomationId = "TrackHeightProfile";
        }
    }
}
