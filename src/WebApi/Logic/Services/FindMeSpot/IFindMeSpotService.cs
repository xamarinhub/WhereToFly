﻿using Newtonsoft.Json;
using Refit;
using System;
using System.Threading.Tasks;

#pragma warning disable CS1591 // Missing XML comment for publicly visible type or member

/// <summary>
/// Content classes for the Find Me SPOT REST web services call
/// </summary>
namespace WhereToFly.WebApi.Logic.Services.FindMeSpot
{
    [System.Diagnostics.CodeAnalysis.SuppressMessage(
        "Microsoft.StyleCop.CSharp.DocumentationRules",
        "SA1600:ElementsMustBeDocumented",
        Justification = "Content classes generated from REST web service response")]
    public class Model
    {
        public class Feed
        {
            public string Id { get; set; }

            public string Name { get; set; }

            public string Description { get; set; }

            public string Status { get; set; }

            public int Usage { get; set; }

            public int DaysRange { get; set; }

            public bool DetailedMessageShown { get; set; }

            public string Type { get; set; }
        }

        public class Message
        {
            [JsonProperty(PropertyName = "@clientUnixTime")]
            public string ClientUnixTime { get; set; }

            public int Id { get; set; }

            public string MessengerId { get; set; }

            public string MessengerName { get; set; }

            public int UnixTime { get; set; }

            public string MessageType { get; set; }

            public double Latitude { get; set; }

            public double Longitude { get; set; }

            public string ModelId { get; set; }

            public string ShowCustomMsg { get; set; }

            public DateTime DateTime { get; set; }

            public string BatteryState { get; set; }

            public int Hidden { get; set; }

            public int Altitude { get; set; }
        }

        public class Messages
        {
            public Message Message { get; set; }
        }

        public class FeedMessageResponse
        {
            public int Count { get; set; }

            public Feed Feed { get; set; }

            public int TotalCount { get; set; }

            public int ActivityCount { get; set; }

            public Messages Messages { get; set; }
        }

        public class Response
        {
            public FeedMessageResponse FeedMessageResponse { get; set; }
        }

        public class RootObject
        {
            public Response Response { get; set; }
        }
    }

    /// <summary>
    /// Interface to REST service for Find Me SPOT
    /// </summary>
    public interface IFindMeSpotService
    {
        /// <summary>
        /// Gets latest position for given feed ID
        /// </summary>
        /// <param name="feedId">feed ID to specify user</param>
        /// <returns>root object of latest position query</returns>
        [Get("/public/feed/{feedId}/latest.json")]
        Task<Model.RootObject> GetLatest(string feedId);
    }
}
