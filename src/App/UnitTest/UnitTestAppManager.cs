﻿using System.Diagnostics;
using WhereToFly.App.Core;
using Xamarin.Forms;

namespace WhereToFly.App.UnitTest
{
    /// <summary>
    /// IAppManager implementation for unit tests
    /// </summary>
    internal class UnitTestAppManager : IAppManager
    {
        /// <summary>
        /// Indicates if methods should simulate that given app exists
        /// </summary>
        public bool AppExists { get; set; } = true;

        /// <summary>
        /// Indicates if app has been opened using the OpenApp() method
        /// </summary>
        public bool AppHasBeenOpened { get; internal set; }

        /// <inheritdoc />
        public ImageSource GetAppIcon(string packageName)
        {
            Debug.WriteLine("unit test: getting app icon for app " + packageName);

            return this.AppExists ? new FileImageSource { File = "dummy.png" } : null;
        }

        /// <inheritdoc />
        public bool OpenApp(string packageName)
        {
            Debug.WriteLine("unit test: opening app " + packageName);

            this.AppHasBeenOpened = true;

            return this.AppExists;
        }
    }
}
