﻿using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.IO;
using System.Linq;
using WhereToFly.Logic;

namespace WhereToFly.UnitTest
{
    /// <summary>
    /// Tests GeoLoader class
    /// </summary>
    [TestClass]
    public class GeoLoaderTest
    {
        /// <summary>
        /// Returns the Assets path for all unit tests; place your test files in the Assets folder
        /// and mark them with "Content" and "Copy if newer".
        /// </summary>
        public string TestAssetsPath
        {
            get
            {
                return Path.Combine(
                    Path.GetDirectoryName(this.GetType().Assembly.Location),
                    "Assets");
            }
        }

        /// <summary>
        /// Tests loading location list, in .kml format
        /// </summary>
        [TestMethod]
        public void TestLoadLocationListKml()
        {
            // run
            string filename = Path.Combine(this.TestAssetsPath, "waypoints.kml");
            var locationList = GeoLoader.LoadLocationList(filename);

            // check
            Assert.IsTrue(locationList.Any(), "loaded location list must contain locations");
        }

        /// <summary>
        /// Tests loading location list, in zipped .kmz format
        /// </summary>
        [TestMethod]
        public void TestLoadLocationListKmz()
        {
            // run
            string filename = Path.Combine(this.TestAssetsPath, "waypoints.kmz");
            var locationList = GeoLoader.LoadLocationList(filename);

            // check
            Assert.IsTrue(locationList.Any(), "loaded location list must contain locations");
        }

        /// <summary>
        /// Tests loading a kmz file with only tracks in it, but no placemarks
        /// </summary>
        [TestMethod]
        public void TestTrackKmzWithoutPlacemarksKmz()
        {
            // run
            string filename = Path.Combine(this.TestAssetsPath, "tracks.kmz");
            var locationList = GeoLoader.LoadLocationList(filename);

            // check
            Assert.IsFalse(locationList.Any(), "loaded location list must not contain locations");
        }
    }
}
