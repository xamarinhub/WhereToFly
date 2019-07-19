﻿using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Refit;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using WhereToFly.Shared.Model;

namespace WhereToFly.Web.LiveTracking.Pages
{
    /// <summary>
    /// Page model for index page
    /// </summary>
    public class IndexModel : PageModel
    {
#pragma warning disable S1075 // URIs should not be hardcoded
        /// <summary>
        /// Base URL for the WebApi REST web service
        /// </summary>
        private const string BaseUrl = "https://wheretoflywebapi.azurewebsites.net";
#pragma warning restore S1075 // URIs should not be hardcoded

        /// <summary>
        /// Backend Web API access
        /// </summary>
        private readonly IBackendWebApi backendWebApi;

        /// <summary>
        /// Data sent by UpdateLiveWaypoint GET request from page
        /// </summary>
        public class UpdateLiveWaypointData
        {
            /// <summary>
            /// The URI of the live waypoint to update
            /// </summary>
            public string Uri { get; set; }
        }

        /// <summary>
        /// Infos about a single live tracking object
        /// </summary>
        public class LiveTrackingInfo
        {
            /// <summary>
            /// Name of live tracking waypoint
            /// </summary>
            public string Name { get; set; }

            /// <summary>
            /// Live tracking waypoint URI
            /// </summary>
            public string Uri { get; set; }
        }

        /// <summary>
        /// List of live tracking infos; used as the view data of the page
        /// </summary>
        [ViewData]
        public List<LiveTrackingInfo> LiveTrackingInfoList { get; private set; }

        /// <summary>
        /// Creates a new index model
        /// </summary>
        public IndexModel()
        {
            this.backendWebApi = RestService.For<IBackendWebApi>(BaseUrl);

            this.LiveTrackingInfoList = new List<LiveTrackingInfo>
            {
                new LiveTrackingInfo
                {
                    Name = "TestPos Schliersee",
                    Uri = "where-to-fly://TestPos/data"
                }
            };
        }

        /// <summary>
        /// Called when page requests an update for a live waypoint
        /// </summary>
        /// <param name="data">update live waypoint data</param>
        /// <returns>
        /// JSON result of query, either a LiveWaypointQueryResult or an exception text
        /// </returns>
        public async Task<JsonResult> OnGetUpdateLiveWaypointAsync(UpdateLiveWaypointData data)
        {
            string liveWaypointId = data.Uri;

            try
            {
                LiveWaypointQueryResult queryResult = await this.backendWebApi.GetLiveWaypointDataAsync(liveWaypointId);

                return new JsonResult(queryResult);
            }
            catch (Exception ex)
            {
                return new JsonResult(ex.Message);
            }
        }
    }
}
