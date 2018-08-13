﻿using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using WhereToFly.App.Logic;

namespace WhereToFly.App.Geo.DataFormats
{
    /// <summary>
    /// Parser for the IGC flight log format specified by the FAI in the document
    /// "IGC GNSS FR Specification" (file tech_spec_gnss.pdf), Appendix A.
    /// Note that the parser doesn't check the exact format of the file, but instead tries to get
    /// a best-effort track representation of the IGC file and its flight(s).
    /// </summary>
    internal class IgcParser
    {
        /// <summary>
        /// Track that was produced while loading and parsing the IGC file
        /// </summary>
        public Track Track { get; set; } = new Track();

        /// <summary>
        /// Header fields, from H records
        /// </summary>
        private readonly Dictionary<string, string> headerFields = new Dictionary<string, string>();

        /// <summary>
        /// Current date part of track
        /// </summary>
        private DateTimeOffset? currentDate = null;

        /// <summary>
        /// Creates a new IGC parser and parses the given stream
        /// </summary>
        /// <param name="stream">IGC data stream</param>
        public IgcParser(Stream stream)
        {
            this.Track.Id = Guid.NewGuid().ToString("B");
            this.Parse(stream);
        }

        /// <summary>
        /// Parses stream as IGC text file
        /// </summary>
        /// <param name="stream">IGC data stream</param>
        private void Parse(Stream stream)
        {
            using (var reader = new StreamReader(stream))
            {
                while (!reader.EndOfStream)
                {
                    string line = reader.ReadLine();

                    if (line.Length > 0)
                    {
                        this.ParseLine(line);
                    }
                }
            }

            this.Track.Name = this.headerFields.GetValueOrDefault("PILOT", "???");
        }

        /// <summary>
        /// Parses a single line in the IGC file
        /// </summary>
        /// <param name="line">text line to parse</param>
        private void ParseLine(string line)
        {
            Debug.Assert(line.Length > 0, "line must not be empty");

            switch (line[0])
            {
                case 'H':
                    this.ParseRecordH(line);
                    break;

                case 'B': // Fix
                    var trackPoint = this.ParseRecordB(line);
                    this.Track.TrackPoints.Add(trackPoint);

                    if (trackPoint.Time.HasValue &&
                        trackPoint.Time.Value.Date != this.currentDate)
                    {
                        // next day
                        this.currentDate = trackPoint.Time.Value.Date;
                    }

                    break;

                case 'G': // Security
                    break;

                default:
                    Debug.WriteLine($"unknown IGC record {line[0]}");
                    break;
            }
        }

        /// <summary>
        /// Parses H record, as defined in Annex 1, chapter 3.3
        /// </summary>
        /// <param name="line">line to parse</param>
        private void ParseRecordH(string line)
        {
            if (line.StartsWith("HFDTE") &&
                DateTimeOffset.TryParseExact(
                    line.Substring(5),
                    "ddMMyy",
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AssumeUniversal,
                    out DateTimeOffset startDate))
            {
                this.currentDate = startDate.Date;
            }

            int pos = line.IndexOf(':');
            if (pos == -1 || pos < 5)
            {
                return;
            }

            string key = line.Substring(5, pos - 5).Trim();
            string text = line.Substring(pos + 1).Trim();

            this.headerFields.Add(key, text);
        }

        /// <summary>
        /// Parses B record, as defined in Annex 1, chapter 4.1, and returns a track point.
        /// </summary>
        /// <param name="line">line to parse</param>
        /// <returns>parsed track point</returns>
        private TrackPoint ParseRecordB(string line)
        {
#pragma warning disable S125 // Sections of code should not be "commented out"
            // Record type, B
            // |
            // |Time in HHMMSS, index 1
            // ||
            // ||     Latitude in DDMMmmmN/S, 8 bytes, index 7
            // ||     |
            // ||     |       Longitude in DDDMMmmmE/W, 9 bytes, index 15
            // ||     |       |
            // ||     |       |        Fix validity, A or V, index 24
            // ||     |       |        |
            // ||     |       |        |Pressure altitude, PPPPP, 5 bytes, index 25
            // ||     |       |        ||
            // ||     |       |        ||    GNSS altitude, GGGGG, 5 bytes, index 30
            // ||     |       |        ||    |
            // ||     |       |        ||    |    Optional infos
            // ||     |       |        ||    |    |
            // B0903544724034N01052829EA009300100900108000
            // B0859144723871N01053378EA013770146800109000
#pragma warning restore S125

            double latitude = ParseLatLong("0" + line.Substring(7, 8));
            double longitude = ParseLatLong(line.Substring(15, 9));

            int altitude = Convert.ToInt32(line.Substring(30, 5));

            var trackPoint = new TrackPoint(latitude, longitude, altitude, null);

            bool hasTimeOffset = TimeSpan.TryParseExact(
                line.Substring(1, 6),
                "hhmmss",
                System.Globalization.CultureInfo.InvariantCulture,
                out TimeSpan timeOffset);

            if (hasTimeOffset &&
                this.currentDate.HasValue)
            {
                trackPoint.Time = this.currentDate.Value + timeOffset;
            }

            return trackPoint;
        }

        /// <summary>
        /// Parses latitude or longitude string value, in the format DDDMMmmmX, with DDD the
        /// degrees part, MM the minutes part, mmm the fractional minutes part and X the
        /// direction, either N, S, E or W. Specified in Annex 1, chapter 4.1.
        /// As latitude has only 2 digits for DDD, prepend it with digit 0 before passing to this
        /// method.
        /// </summary>
        /// <param name="latLong">latitude or longitude value as text</param>
        /// <returns>parsed latitude or longitude value</returns>
        private static double ParseLatLong(string latLong)
        {
            int decimalValue = Convert.ToInt32(latLong.Substring(0, 3));
            int minuteValue = Convert.ToInt32(latLong.Substring(3, 2));
            int minuteFractional = Convert.ToInt32(latLong.Substring(5, 3));

            double value = (double)decimalValue + ((minuteValue + (minuteFractional / 1000.0)) / 60.0);

            char direction = latLong[7];
            if (direction == 'S' || direction == 'W')
            {
                value = -value;
            }

            return value;
        }
    }
}
