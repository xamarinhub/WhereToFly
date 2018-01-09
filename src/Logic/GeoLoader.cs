﻿using SharpKml.Dom;
using SharpKml.Engine;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using WhereToFly.Logic.Model;

namespace WhereToFly.Logic
{
    /// <summary>
    /// Loader class for different geo objects, like location lists
    /// </summary>
    public static class GeoLoader
    {
        /// <summary>
        /// Loads a location list from given filename; must have .kml or .kmz extension.
        /// </summary>
        /// <param name="filename">filename of file to load</param>
        /// <returns>list of locations found in the file</returns>
        public static List<Model.Location> LoadLocationList(string filename)
        {
            string extension = Path.GetExtension(filename);

            switch (extension)
            {
                case ".kml":
                    using (Stream stream = new FileStream(filename, FileMode.Open))
                    {
                        return LoadLocationList(stream, isKml: true);
                    }

                case ".kmz":
                    using (Stream stream = new FileStream(filename, FileMode.Open))
                    {
                        return LoadLocationList(stream, isKml: false);
                    }

                default:
                    throw new ArgumentException("file is not a valid .kml or .kmz file");
            }
        }

        /// <summary>
        /// Loads a location list from given stream
        /// </summary>
        /// <param name="stream">stream of file to load</param>
        /// <param name="isKml">indicates if the stream is a .kml stream or a .kmz stream</param>
        /// <returns>list of locations found in the file</returns>
        public static List<Model.Location> LoadLocationList(Stream stream, bool isKml)
        {
            if (isKml)
            {
                var kml = KmlFile.Load(stream);
                return LoadFromKml(kml);
            }
            else
            {
                var kmz = KmzFile.Open(stream);
                return LoadFromKml(kmz.GetDefaultKmlFile());
            }
        }

        /// <summary>
        /// Loads list of locations, from .kml file.
        /// </summary>
        /// <param name="kml">kml file</param>
        /// <returns>list of locations found in the file</returns>
        private static List<Model.Location> LoadFromKml(KmlFile kml)
        {
            var locationList = new List<Model.Location>();

            foreach (var element in kml.Root.Flatten())
            {
                if (element is Placemark placemark &&
                    placemark.Geometry is Point point)
                {
                    locationList.Add(new Model.Location
                    {
                        Id = placemark.Id ?? Guid.NewGuid().ToString("B"),
                        Name = placemark.Name ?? "unknown",
                        Description = placemark.Description?.Text ?? string.Empty,
                        Type = MapPlacemarkToType(kml, placemark),
                        MapLocation = new MapPoint(point.Coordinate.Latitude, point.Coordinate.Longitude),
                        Elevation = point.Coordinate.Altitude ?? 0
                    });
                }
            }

            return locationList;
        }

        /// <summary>
        /// Maps a placemark to a location type
        /// </summary>
        /// <param name="kml">kml file where the placemark is in</param>
        /// <param name="placemark">placemark to use</param>
        /// <returns>location type</returns>
        private static LocationType MapPlacemarkToType(KmlFile kml, Placemark placemark)
        {
            string iconLink = GetPlacemarkStyleIcon(kml, placemark);

            if (iconLink.Contains("parking"))
            {
                return LocationType.Parking;
            }

            if (iconLink.Contains("dining"))
            {
                return LocationType.Restaurant;
            }

            if (iconLink.Contains("bus"))
            {
                return LocationType.PublicTransportBus;
            }

            if (iconLink.Contains("rail"))
            {
                return LocationType.PublicTransportTrain;
            }

            return LocationType.Waypoint;
        }

        /// <summary>
        /// Retrieves style icon from a placemark
        /// </summary>
        /// <param name="kml">kml file where the placemark is in</param>
        /// <param name="placemark">placemark to check</param>
        /// <returns>style URL, or empty string when style couldn't be retrieved</returns>
        private static string GetPlacemarkStyleIcon(KmlFile kml, Placemark placemark)
        {
            try
            {
                string styleUrl = placemark.StyleUrl.ToString();

                if (styleUrl.StartsWith("#"))
                {
                    var style = kml.FindStyle(styleUrl.Substring(1));
                    if (style != null &&
                        style is StyleMapCollection styleMap)
                    {
                        var normalStyle = styleMap.First(x => x.State.HasValue && x.State.Value == StyleState.Normal);
                        if (normalStyle != null)
                        {
                            string normalStyleUrl = normalStyle.StyleUrl.ToString();
                            if (normalStyleUrl.StartsWith("#"))
                            {
                                var iconStyle = kml.FindStyle(normalStyleUrl.Substring(1));
                                if (iconStyle != null &&
                                    iconStyle is Style icon)
                                {
                                    return icon.Icon.Icon.Href.ToString();
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception)
            {
                // ignore any errors while trying to parse
            }

            return string.Empty;
        }
    }
}
