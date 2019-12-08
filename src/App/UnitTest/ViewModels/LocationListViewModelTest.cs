﻿using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Linq;
using System.Threading;
using WhereToFly.App.Core;
using WhereToFly.App.Core.Services;
using WhereToFly.App.Core.ViewModels;
using WhereToFly.App.Model;
using Xamarin.Forms;

namespace WhereToFly.App.UnitTest.ViewModels
{
    /// <summary>
    /// Unit tests for LocationListViewModel
    /// </summary>
    [TestClass]
    public class LocationListViewModelTest
    {
        /// <summary>
        /// Sets up tests by initializing Xamarin.Forms.Mocks and DependencyService with
        /// DataService.
        /// </summary>
        [TestInitialize]
        public void SetUp()
        {
            Xamarin.Forms.Mocks.MockForms.Init();
            DependencyService.Register<IDataService, JsonFileDataService>();
            DependencyService.Register<IPlatform, UnitTestPlatform>();
        }

        /// <summary>
        /// Tests ctor
        /// </summary>
        [TestMethod]
        public void TestCtor()
        {
            // set up
            var appSettings = new AppSettings();
            var viewModel = new LocationListViewModel(appSettings);

            var propertyChangedEvent = new ManualResetEvent(false);

            viewModel.PropertyChanged += (sender, args) =>
                {
                    if (args.PropertyName == nameof(viewModel.LocationList))
                    {
                        propertyChangedEvent.Set();
                    }
                };

            propertyChangedEvent.WaitOne();

            // check
            Assert.IsTrue(viewModel.LocationList.Any(), "location list initially contains the default locations");
            Assert.AreEqual(0, viewModel.FilterText.Length, "filter text is initially empty");
            Assert.IsFalse(viewModel.AreAllLocationsFilteredOut, "as there is no filter text, no location was filtered out");
        }
    }
}
