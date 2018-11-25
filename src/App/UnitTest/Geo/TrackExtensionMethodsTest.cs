﻿using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.IO;
using WhereToFly.App.Geo;
using WhereToFly.App.Geo.DataFormats;
using WhereToFly.App.Geo.Spatial;

namespace WhereToFly.App.UnitTest.Geo
{
    /// <summary>
    /// Tests for track extension methods
    /// </summary>
    [TestClass]
    public class TrackExtensionMethodsTest
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
        /// Tests calculating statistics on an empty track
        /// </summary>
        [TestMethod]
        public void TestCalculateStatistics_EmptyTrack()
        {
            // set up
            var track = new Track();

            // run
            track.CalculateStatistics();

            // check
        }

        /// <summary>
        /// Tests CalculateStatistics() on all tracks that can be loaded from assets.
        /// </summary>
        [TestMethod]
        public void TestCalculateStatistics_AllAssetTracks()
        {
            // set up
            string[] trackFilenames =
            {
                "waypoints.kml",
                "track_linestring.kmz",
                "tracks.gpx",
                "tracks.kmz",
                ////"85QA3ET1.igc", // TODO causes exception
            };

            // run
            foreach (string trackFilename in trackFilenames)
            {
                string filename = Path.Combine(this.TestAssetsPath, trackFilename);
                var geoDataFile = GeoLoader.LoadGeoDataFile(filename);

                var trackList = geoDataFile.GetTrackList();
                for (int trackIndex = 0; trackIndex < trackList.Count; trackIndex++)
                {
                    var track = geoDataFile.LoadTrack(trackIndex);
                    if (track != null)
                    {
                        track.CalculateStatistics();
                    }
                }
            }
        }
    }
}
