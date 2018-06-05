﻿using SharpKml.Dom;
using SharpKml.Engine;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using WhereToFly.App.Logic;
using WhereToFly.App.Model;

namespace WhereToFly.App.Geo.DataFormats
{
    /// <summary>
    /// Loader for .kml and .kmz files; uses the SharpKml library.
    /// </summary>
    internal static class KmlFormatLoader
    {
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
                        Description = GetDescriptionFromPlacemark(placemark),
                        Type = MapPlacemarkToType(kml, placemark),
                        MapLocation = new MapPoint(point.Coordinate.Latitude, point.Coordinate.Longitude),
                        Elevation = point.Coordinate.Altitude ?? 0
                    });
                }
            }

            return locationList;
        }

        /// <summary>
        /// Returns sanitized description HTML text from given placemark.
        /// </summary>
        /// <param name="placemark">placemark to use</param>
        /// <returns>HTML description text</returns>
        private static string GetDescriptionFromPlacemark(Placemark placemark)
        {
            string text = placemark.Description?.Text ?? string.Empty;

            // no HTML tags? assume MarkDown
            if (!text.Contains("<") &&
                !text.Contains(">"))
            {
                text = HtmlConverter.FromMarkdown(text);
            }

            text = HtmlConverter.Sanitize(text);

            return text;
        }

        /// <summary>
        /// Mapping from a text that can occur in a placemark icon link, to a LocationType
        /// </summary>
        private static Dictionary<string, LocationType> iconLinkToLocationTypeMap = new Dictionary<string, LocationType>
        {
            // paraglidingsports.com types
            { "iconpg_sp.png", LocationType.FlyingTakeoff },
            { "iconpg_spk.png", LocationType.FlyingTakeoff },
            { "iconpg_spw.png", LocationType.FlyingWinchTowing },
            { "iconpg_lp.png", LocationType.FlyingLandingPlace },

            // DHV Geländedatenbank
            { "windsack_rot", LocationType.FlyingTakeoff },
            { "windsack_gruen", LocationType.FlyingLandingPlace },
            { "windsack_blau", LocationType.FlyingWinchTowing },

            // general Google Maps types
            { "parking", LocationType.Parking },
            { "dining", LocationType.Restaurant },
            { "bus", LocationType.PublicTransportBus },
            { "rail", LocationType.PublicTransportTrain },
        };

        /// <summary>
        /// Maps a placemark to a location type
        /// </summary>
        /// <param name="kml">kml file where the placemark is in</param>
        /// <param name="placemark">placemark to use</param>
        /// <returns>location type</returns>
        private static LocationType MapPlacemarkToType(KmlFile kml, Placemark placemark)
        {
            string iconLink = GetPlacemarkStyleIcon(kml, placemark);

            if (!string.IsNullOrWhiteSpace(iconLink))
            {
                foreach (var iconLinkContentAndLocationType in iconLinkToLocationTypeMap)
                {
                    if (iconLink.Contains(iconLinkContentAndLocationType.Key))
                    {
                        return iconLinkContentAndLocationType.Value;
                    }
                }
            }

            var name = placemark.Name ?? string.Empty;

            if (name.StartsWith("SP ") ||
                name.StartsWith("SP-HG "))
            {
                return LocationType.FlyingTakeoff;
            }

            if (name.StartsWith("LP "))
            {
                return LocationType.FlyingLandingPlace;
            }

            if (name.StartsWith("P "))
            {
                return LocationType.Parking;
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
                if (placemark.StyleUrl != null)
                {
                    return GetStyleIconFromStyleUrl(kml, placemark);
                }
                else if (placemark.Styles.Any())
                {
                    return GetStyleIconFromStyleCollection(placemark);
                }
            }
            catch (Exception)
            {
                // ignore any errors while trying to parse
            }

            return string.Empty;
        }

        /// <summary>
        /// Gets style icon from StyleUrl property of placemark
        /// </summary>
        /// <param name="kml">kml file where the placemark is in</param>
        /// <param name="placemark">placemark to check</param>
        /// <returns>style URL, or empty string when style couldn't be retrieved</returns>
        private static string GetStyleIconFromStyleUrl(KmlFile kml, Placemark placemark)
        {
            string styleUrl = placemark.StyleUrl.ToString();

            if (styleUrl.StartsWith("#"))
            {
                var style = kml.FindStyle(styleUrl.Substring(1));
                if (style != null &&
                    style is StyleMapCollection styleMap)
                {
                    string link = GetStyleMapNormalStyleIconLink(kml, styleMap);
                    if (!string.IsNullOrEmpty(link))
                    {
                        return link;
                    }
                }
            }

            return string.Empty;
        }

        /// <summary>
        /// Retrieves link for "normal" style icon, from given style map
        /// </summary>
        /// <param name="kml">kml file where the style map is in</param>
        /// <param name="styleMap">style map to search</param>
        /// <returns>style URL, or null when style couldn't be retrieved</returns>
        private static string GetStyleMapNormalStyleIconLink(KmlFile kml, StyleMapCollection styleMap)
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

            return null;
        }

        /// <summary>
        /// Gets style icon from Styles collection property of placemark
        /// </summary>
        /// <param name="placemark">placemark to check</param>
        /// <returns>style URL, or empty string when style couldn't be retrieved</returns>
        private static string GetStyleIconFromStyleCollection(Placemark placemark)
        {
            var style = placemark.Styles.FirstOrDefault() as Style;
            if (style != null &&
                style.Icon != null &&
                style.Icon.Icon != null &&
                style.Icon.Icon.Href != null)
            {
                return style.Icon.Icon.Href.ToString();
            }

            return string.Empty;
        }
    }
}
