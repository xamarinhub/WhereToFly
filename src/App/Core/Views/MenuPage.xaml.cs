﻿using WhereToFly.App.Core.ViewModels;
using Xamarin.Forms;

namespace WhereToFly.App.Core.Views
{
    /// <summary>
    /// Page to display menu for the master-detail root page
    /// </summary>
    public partial class MenuPage : ContentPage
    {
        /// <summary>
        /// Creates new menu page
        /// </summary>
        public MenuPage()
        {
            this.InitializeComponent();

            this.BindingContext = new MenuViewModel();
        }
    }
}
