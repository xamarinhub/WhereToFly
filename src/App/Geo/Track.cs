﻿using System.Collections.Generic;

namespace WhereToFly.App.Geo
{
    /// <summary>
    /// A single track consisting of track points
    /// </summary>
    public class Track
    {
        /// <summary>
        /// ID for the track; e.g. generated at import time
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Track name
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Indicates if track is a flight track and will be colored depending on climb and sink
        /// rates.
        /// </summary>
        public bool IsFlightTrack { get; set; }

        /// <summary>
        /// Color to use for the track; used when not a flight track; format is RRGGBB in hex.
        /// </summary>
        public string Color { get; set; }

        /// <summary>
        /// List of track points
        /// </summary>
        public List<TrackPoint> TrackPoints { get; set; }

        /// <summary>
        /// Creates a new and empty track object
        /// </summary>
        public Track()
        {
            this.Name = string.Empty;
            this.IsFlightTrack = false;
            this.Color = "0000FF";
            this.TrackPoints = new List<TrackPoint>();
        }
    }
}
