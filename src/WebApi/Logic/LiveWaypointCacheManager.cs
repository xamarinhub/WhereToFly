﻿using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using WhereToFly.Shared.Model;
using WhereToFly.WebApi.Logic.Services;

namespace WhereToFly.WebApi.Logic
{
    /// <summary>
    /// Manager for live waypoint cache
    /// </summary>
    public class LiveWaypointCacheManager
    {
        /// <summary>
        /// Logger for cache manager
        /// </summary>
        private readonly ILogger<LiveWaypointCacheManager> logger;

        /// <summary>
        /// Cacle for live waypoint data, keyed by ID
        /// </summary>
        private readonly Dictionary<string, LiveWaypointData> liveWaypointCache = new Dictionary<string, LiveWaypointData>();

        /// <summary>
        /// Lock object for cache and queue
        /// </summary>
        private readonly object lockCacheAndQueue = new object();

        /// <summary>
        /// Data service for querying Find Me SPOT service
        /// </summary>
        private readonly FindMeSpotTrackerDataService findMeSpotTrackerService = new FindMeSpotTrackerDataService();

        /// <summary>
        /// Data service for querying Garmin inReach services
        /// </summary>
        private readonly GarminInreachDataService garminInreachService = new GarminInreachDataService();

        /// <summary>
        /// Creates a new live waypoint cache manager object
        /// </summary>
        /// <param name="logger">logger instance to use</param>
        public LiveWaypointCacheManager(ILogger<LiveWaypointCacheManager> logger)
        {
            this.logger = logger;
        }

        /// <summary>
        /// Returns live waypoint data for given live waypoint ID. May throw an exception when the
        /// data is not readily available and must be fetched.
        /// </summary>
        /// <param name="rawId">live waypoint ID (maybe urlencoded)</param>
        /// <returns>live waypoint query result</returns>
        public async Task<LiveWaypointQueryResult> GetLiveWaypointData(string rawId)
        {
            AppResourceUri uri = GetAndCheckLiveWaypointId(rawId);

            LiveWaypointQueryResult result = this.CheckCache(uri);
            if (result != null)
            {
                return result;
            }

            result = await this.GetLiveWaypointQueryResult(uri);

            if (result != null)
            {
                this.CacheLiveWaypointData(result.Data);
            }

            return result;
        }

        /// <summary>
        /// Parses a raw live waypoint ID and returns an AppResourceId object from it
        /// </summary>
        /// <param name="rawId">raw live waypoint ID</param>
        /// <returns>live waypoint ID as AppResourceUri object</returns>
        private static AppResourceUri GetAndCheckLiveWaypointId(string rawId)
        {
            string id = System.Net.WebUtility.UrlDecode(rawId);
            var uri = new AppResourceUri(id);
            if (!uri.IsValid)
            {
                throw new ArgumentException("invalid live waypoint ID", nameof(rawId));
            }

            return uri;
        }

        /// <summary>
        /// Checks next request date if a new request can be made; when not, returns cache entry
        /// when available.
        /// </summary>
        /// <param name="uri">live waypoint ID</param>
        /// <returns>
        /// query result from cache, or null when there's no request in cache or when a request
        /// can be made online
        /// </returns>
        private LiveWaypointQueryResult CheckCache(AppResourceUri uri)
        {
            if (this.IsNextRequestPossible(uri))
            {
                return null;
            }

            // ask cache
            string id = uri.ToString();

            LiveWaypointData cachedData;
            lock (this.lockCacheAndQueue)
            {
                cachedData = this.liveWaypointCache.ContainsKey(id) ? this.liveWaypointCache[id] : null;
            }

            if (cachedData == null)
            {
                return null;
            }

            return new LiveWaypointQueryResult
            {
                Data = cachedData,
                NextRequestDate = this.GetNextRequestDate(uri)
            };
        }

        /// <summary>
        /// Returns if next request is possible for the given app resource URI
        /// </summary>
        /// <param name="uri">live waypoint ID</param>
        /// <returns>
        /// true when web service request is possible, false when cache should be used
        /// </returns>
        private bool IsNextRequestPossible(AppResourceUri uri)
        {
            switch (uri.Type)
            {
                case AppResourceUri.ResourceType.FindMeSpotPos:
                case AppResourceUri.ResourceType.GarminInreachPos:
                    DateTimeOffset nextRequestDate = this.GetNextRequestDate(uri);
                    return nextRequestDate <= DateTimeOffset.Now;

                case AppResourceUri.ResourceType.TestPos:
                    return true; // request is always possible

                default:
                    Debug.Assert(false, "invalid app resource URI type");
                    return false;
            }
        }

        /// <summary>
        /// Returns next request date for live waypoint in given ID
        /// </summary>
        /// <param name="uri">live waypoint ID</param>
        /// <returns>date time offset of next possible request for this ID</returns>
        private DateTimeOffset GetNextRequestDate(AppResourceUri uri)
        {
            switch (uri.Type)
            {
                case AppResourceUri.ResourceType.FindMeSpotPos:
                    return this.findMeSpotTrackerService.GetNextRequestDate(uri);

                case AppResourceUri.ResourceType.GarminInreachPos:
                    return this.garminInreachService.GetNextRequestDate(uri.Data);

                case AppResourceUri.ResourceType.TestPos:
                    return DateTimeOffset.Now + TimeSpan.FromMinutes(1.0);

                default:
                    Debug.Assert(false, "invalid app resource URI type");
                    return DateTimeOffset.MaxValue;
            }
        }

        /// <summary>
        /// Gets actual live waypoint query result from web services
        /// </summary>
        /// <param name="uri">live waypoint ID</param>
        /// <returns>query result</returns>
        private async Task<LiveWaypointQueryResult> GetLiveWaypointQueryResult(AppResourceUri uri)
        {
            switch (uri.Type)
            {
                case AppResourceUri.ResourceType.FindMeSpotPos:
                    return await this.GetFindMeSpotPosResult(uri);

                case AppResourceUri.ResourceType.GarminInreachPos:
                    return await this.GetGarminInreachPosResult(uri);

                case AppResourceUri.ResourceType.TestPos:
                    return await this.GetTestPosResult(uri);

                default:
                    Debug.Assert(false, "invalid app resource URI type");
                    return null;
            }
        }

        /// <summary>
        /// Gets query result for a Find Me SPOT live waypoint ID
        /// </summary>
        /// <param name="uri">live waypoint ID</param>
        /// <returns>live waypoint query result</returns>
        private async Task<LiveWaypointQueryResult> GetFindMeSpotPosResult(AppResourceUri uri)
        {
            var liveWaypointData = await this.findMeSpotTrackerService.GetDataAsync(uri);

            return new LiveWaypointQueryResult
            {
                Data = liveWaypointData,
                NextRequestDate = this.findMeSpotTrackerService.GetNextRequestDate(uri)
            };
        }

        /// <summary>
        /// Gets query result for a Garmin inReach live waypoint ID
        /// </summary>
        /// <param name="uri">live waypoint Id</param>
        /// <returns>live waypoint query result</returns>
        private async Task<LiveWaypointQueryResult> GetGarminInreachPosResult(AppResourceUri uri)
        {
            string mapShareIdentifier = uri.Data;

            var liveWaypointData = await this.garminInreachService.GetDataAsync(mapShareIdentifier);

            return new LiveWaypointQueryResult
            {
                Data = liveWaypointData,
                NextRequestDate = this.garminInreachService.GetNextRequestDate(mapShareIdentifier)
            };
        }

        /// <summary>
        /// Returns a test position, based on the current time
        /// </summary>
        /// <param name="uri">live waypoint ID to use</param>
        /// <returns>live waypoint query result</returns>
        private Task<LiveWaypointQueryResult> GetTestPosResult(AppResourceUri uri)
        {
            DateTimeOffset nextRequestDate = DateTimeOffset.Now + TimeSpan.FromMinutes(1.0);

            var mapPoint = new MapPoint(47.664601, 11.885455, 0.0);

            double timeAngleInDegrees = (DateTimeOffset.Now.TimeOfDay.TotalMinutes * 6.0) % 360;
            double timeAngle = timeAngleInDegrees / 180.0 * Math.PI;
            mapPoint.Latitude += 0.025 * Math.Sin(timeAngle);
            mapPoint.Longitude -= 0.025 * Math.Cos(timeAngle);

            return Task.FromResult(
                new LiveWaypointQueryResult
                {
                    Data = new LiveWaypointData
                    {
                        ID = uri.ToString(),
                        TimeStamp = DateTimeOffset.Now,
                        Longitude = mapPoint.Longitude,
                        Latitude = mapPoint.Latitude,
                        Altitude = mapPoint.Altitude.Value,
                        Name = "Live waypoint test position",
                        Description = "Hello from the Where-to-fly backend services!<br/>" +
                            $"Next request date is {nextRequestDate.ToString()}",
                        DetailsLink = string.Empty
                    },
                    NextRequestDate = nextRequestDate
                });
        }

        /// <summary>
        /// Caches (new or updated) live waypoint data
        /// </summary>
        /// <param name="data">live waypoint data to cache</param>
        public void CacheLiveWaypointData(LiveWaypointData data)
        {
            this.logger.LogDebug($"caching live waypoint data for id: {data.ID}");

            lock (this.lockCacheAndQueue)
            {
                this.liveWaypointCache[data.ID] = data;
            }
        }
    }
}
