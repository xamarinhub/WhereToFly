﻿using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using WhereToFly.Logic;
using WhereToFly.Logic.Model;

namespace WhereToFly.UnitTest
{
    /// <summary>
    /// Tests class DataFormatter
    /// </summary>
    [TestClass]
    public class DataFormatterTest
    {
        /// <summary>
        /// Tests function FormatLatLong()
        /// </summary>
        [TestMethod]
        public void TestFormatLatLong()
        {
            // set up
            double latLong = 47.6764385;

            // run
            string text1 = DataFormatter.FormatLatLong(latLong, CoordinateDisplayFormat.Format_dd_dddddd);
            string text2 = DataFormatter.FormatLatLong(latLong, CoordinateDisplayFormat.Format_dd_mm_mmm);
            string text3 = DataFormatter.FormatLatLong(latLong, CoordinateDisplayFormat.Format_dd_mm_sss);

            // check
            Assert.AreEqual("47.676439", text1, "formatted text must match");
            Assert.AreEqual("47° 40.586'", text2, "formatted text must match");
            Assert.AreEqual("47° 40' 35\"", text3, "formatted text must match");
        }

        /// <summary>
        /// Tests function FormatMyPositionShareText()
        /// </summary>
        [TestMethod]
        public void TestFormatMyPositionShareText()
        {
            // set up
            var mapPoint = new MapPoint(47.6764385, 11.8710533);
            double altitude = 1685;

            // run
            string text = DataFormatter.FormatMyPositionShareText(mapPoint, altitude, DateTimeOffset.UtcNow);

            // check
            Assert.IsTrue(text.Length > 0, "formatted text must not be empty");
        }
    }
}
