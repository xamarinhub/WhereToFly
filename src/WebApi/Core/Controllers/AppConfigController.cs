﻿using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WhereToFly.Shared.Model;

namespace WhereToFly.WebApi.Core.Controllers
{
    /// <summary>
    /// Controller to deliver app config for WhereToiFly app
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class AppConfigController : Controller
    {
        /// <summary>
        /// Logger instance
        /// </summary>
        private readonly ILogger<AppConfigController> logger;

        /// <summary>
        /// App config object to use
        /// </summary>
        private readonly AppConfig appConfig;

        /// <summary>
        /// Creates a new app config controller
        /// </summary>
        /// <param name="config">configuration object</param>
        /// <param name="logger">logging instance</param>
        public AppConfigController(IConfiguration config, ILogger<AppConfigController> logger)
        {
            this.logger = logger;

            this.appConfig = new AppConfig
            {
                CesiumIonApiKey = config["CESIUM_ION_API_KEY"] ?? string.Empty,
                BingMapsApiKey = config["BING_MAPS_API_KEY"] ?? string.Empty,
            };

            this.logger.LogDebug(
                $"Initializing AppConfig controller with Cesium Ion API Key \"{this.appConfig.CesiumIonApiKey}\" " +
                $"and Bing Maps API key \"{this.appConfig.BingMapsApiKey}\"");
        }

        /// <summary>
        /// GET: api/AppConfig/appVersion
        /// Returns current WhereToFly app configuration.
        /// </summary>
        /// <param name="appVersion">version of the app that wants to get app config</param>
        /// <returns>app config object</returns>
        [HttpGet]
        public AppConfig Get(string appVersion)
        {
            this.logger.LogInformation($"WhereToFly app config request, with version {appVersion}");

            return this.appConfig;
        }
    }
}
