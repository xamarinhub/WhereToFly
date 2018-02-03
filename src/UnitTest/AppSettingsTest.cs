﻿using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereToFly.Logic.Model;

namespace WhereToFly.UnitTest
{
    /// <summary>
    /// Tests for AppSettings class
    /// </summary>
    [TestClass]
    public class AppSettingsTest
    {
        /// <summary>
        /// Tests AppSettings constructor
        /// </summary>
        [TestMethod]
        public void TestCtor()
        {
            // run
            var appSettings = new AppSettings();

            // check
            Assert.IsFalse(appSettings.LastKnownPosition.Valid, "last known position must be invalid");
        }
    }
}
