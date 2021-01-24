﻿using System;
using WhereToFly.App.Geo.DataFormats.Czml;

namespace WhereToFly.App.Geo.DataFormats.GeoJson
{
    /// <summary>
    /// Options for converting GeoJSON to CZML
    /// </summary>
    public class CzmlConvertOptions
    {
        /// <summary>
        /// Document name
        /// </summary>
        public string DocumentName { get; set; } = string.Empty;

        /// <summary>
        /// Document description text
        /// </summary>
        public string DocumentDescription { get; set; } = string.Empty;

        /// <summary>
        /// Point size for point elements
        /// </summary>
        public double PointSize { get; set; } = 2.0;

        /// <summary>
        /// Color for point elements
        /// </summary>
        public Color PointColor { get; internal set; }

        /// <summary>
        /// Line width for line strings
        /// </summary>
        public double LineWidth { get; set; } = 2.0;

        /// <summary>
        /// Color for line strings
        /// </summary>
        public Color LineColor { get; internal set; }

        /// <summary>
        /// Color for polygon elements
        /// </summary>
        public Color PolygonColor { get; internal set; }

        /// <summary>
        /// Custom function to format names for CZML elements; may be null
        /// </summary>
        public Func<Element, string> CustomNameFormatter { get; set; } = null;

        /// <summary>
        /// Custom function to format description texts for CZML elements; may be null
        /// </summary>
        public Func<Element, string> CustomDescriptionFormatter { get; set; } = null;

        /// <summary>
        /// Custom function to get point colors for CZML point elements; may be null
        /// </summary>
        public Func<Element, Color> CustomPointColorResolver { get; set; } = null;
    }
}
