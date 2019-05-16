﻿using System;
using System.IO;
using WhereToFly.App.Core;
using Windows.Storage;
using Xamarin.Forms;

[assembly: Dependency(typeof(WhereToFly.App.UWP.UwpPlatform))]

namespace WhereToFly.App.UWP
{
    /// <summary>
    /// Platform specific functions
    /// </summary>
    public class UwpPlatform : IPlatform
    {
        /// <summary>
        /// Path URL for assets files
        /// </summary>
        private const string AppxAssetsPathUrl = "ms-appx:///WhereToFly.App.Resources.UWP/Assets/";

        /// <summary>
        /// Property containing the UWP app data folder
        /// </summary>
        public string AppDataFolder => ApplicationData.Current.LocalFolder.Path;

        /// <summary>
        /// Property containing the UWP app cache data folder
        /// </summary>
        public string CacheDataFolder => ApplicationData.Current.LocalCacheFolder.Path;

        /// <summary>
        /// Base path to use in WebView control, for Android
        /// </summary>
        public string WebViewBasePath => "ms-appx-web:///WhereToFly.App.Resources.UWP/Assets/";

        /// <summary>
        /// Opens UWP asset stream and returns it
        /// </summary>
        /// <param name="assetFilename">asset filename</param>
        /// <returns>stream to read from file</returns>
        public Stream OpenAssetStream(string assetFilename)
        {
            string fullAssetPath = AppxAssetsPathUrl + assetFilename;
            var uri = new Uri(fullAssetPath);

            var file = StorageFile.GetFileFromApplicationUriAsync(uri).AsTask().Result;

            return file.OpenStreamForReadAsync().Result;
        }

        /// <summary>
        /// Loads text of UWP asset file from given filename
        /// </summary>
        /// <param name="assetFilename">asset filename</param>
        /// <returns>text content of asset</returns>
        public string LoadAssetText(string assetFilename)
        {
            using (var stream = this.OpenAssetStream(assetFilename))
            using (var streamReader = new StreamReader(stream))
            {
                return streamReader.ReadToEnd();
            }
        }

        /// <summary>
        /// Loads binary data of asset file from given filename
        /// </summary>
        /// <param name="assetFilename">asset filename</param>
        /// <returns>binary content of asset</returns>
        public byte[] LoadAssetBinaryData(string assetFilename)
        {
            using (var stream = this.OpenAssetStream(assetFilename))
            using (var memoryStream = new MemoryStream())
            {
                stream.CopyTo(memoryStream);
                return memoryStream.GetBuffer();
            }
        }
    }
}
