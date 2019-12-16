﻿using Newtonsoft.Json;
using SQLite;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WhereToFly.App.Geo;
using WhereToFly.App.Logic;
using WhereToFly.App.Model;
using WhereToFly.Shared.Model;
using Xamarin.Forms;

namespace WhereToFly.App.Core.Services.SqliteDatabase
{
    /// <summary>
    /// Data service implementation that stores data in an SQLite database
    /// </summary>
    internal partial class SqliteDatabaseDataService : IDataService
    {
        /// <summary>
        /// Filename for the SQLite database file
        /// </summary>
        private const string DatabaseFilename = "database.db";

        /// <summary>
        /// SQLite database connection
        /// </summary>
        private readonly SQLiteAsyncConnection connection;

        /// <summary>
        /// Task that is completed when initializing database has completed
        /// </summary>
        private readonly Task initCompleteTask;

        /// <summary>
        /// Data service to access backend
        /// </summary>
        private readonly BackendDataService backendDataService = new BackendDataService();

        /// <summary>
        /// Backing store for app settings
        /// </summary>
        private AppSettings appSettings;

        #region Database entry objects
        /// <summary>
        /// Database entry for app data
        /// </summary>
        [Table("appdata")]
        [SuppressMessage("StyleCop.CSharp.Naming", "SA1300:ElementMustBeginWithUpperCaseLetter", Justification = "database entry object")]
        internal class AppDataEntry
        {
            /// <summary>
            /// App settings object
            /// </summary>
            [Ignore]
            public AppSettings AppSettings { get; set; }

            /// <summary>
            /// ID; needed for primary key
            /// </summary>
            [Column("id"), PrimaryKey]
            public int Id { get; set; } = 42;

            /// <summary>
            /// App settings serialized to JSON
            /// </summary>
            [Column("settings"), NotNull]
            public string Settings
            {
                get
                {
                    return JsonConvert.SerializeObject(this.AppSettings);
                }

                set
                {
                    this.AppSettings = JsonConvert.DeserializeObject<AppSettings>(value);
                }
            }
        }

        /// <summary>
        /// Database entry for websites and their favicon urls
        /// </summary>a
        [Table("favicons")]
        [SuppressMessage("StyleCop.CSharp.Naming", "SA1300:ElementMustBeginWithUpperCaseLetter", Justification = "database entry object")]
        private class FaviconUrlEntry
        {
            /// <summary>
            /// Website URL
            /// </summary>
            [Column("url"), PrimaryKey]
            public string WebsiteUrl { get; set; }

            /// <summary>
            /// Favicon address
            /// </summary>
            [Column("favicon"), NotNull]
            public string FaviconUrl { get; set; }
        }
        #endregion

        /// <summary>
        /// Creates a new data service, opens and initializes database
        /// </summary>
        public SqliteDatabaseDataService()
        {
            var platform = DependencyService.Get<IPlatform>();
            string databaseFilename = Path.Combine(platform.AppDataFolder, DatabaseFilename);

            this.connection = new SQLiteAsyncConnection(
                databaseFilename,
                SQLiteOpenFlags.Create | SQLiteOpenFlags.ReadWrite);

            this.initCompleteTask = Task.Run(async () => await this.InitAsync());
        }

        /// <summary>
        /// Initializes database; when the tables are newly created, add default entries.
        /// </summary>
        /// <returns>task to wait on</returns>
        private async Task InitAsync()
        {
            await this.connection.CreateTableAsync<AppDataEntry>();

            if (await this.connection.CreateTableAsync<FaviconUrlEntry>() == CreateTableResult.Created)
            {
                var defaultEntries =
                    from keyAndValue in DataServiceHelper.GetDefaultFaviconCache()
                    select new FaviconUrlEntry
                    {
                        WebsiteUrl = keyAndValue.Key,
                        FaviconUrl = keyAndValue.Value
                    };

                await this.connection.InsertAllAsync(defaultEntries, runInTransaction: true);
            }

            if (await this.connection.CreateTableAsync<LocationEntry>() == CreateTableResult.Created)
            {
                await this.GetLocationDataService().AddList(
                    DataServiceHelper.GetDefaultLocationList());
            }

            if (await this.connection.CreateTableAsync<TrackEntry>() == CreateTableResult.Created)
            {
                await this.GetTrackDataService().AddList(
                    DataServiceHelper.GetDefaultTrackList());
            }

            await this.connection.CreateTableAsync<LayerEntry>();

            await this.connection.CreateTableAsync<WeatherIconDescriptionEntry>();
        }

        /// <summary>
        /// Gets the current app settings object
        /// </summary>
        /// <param name="token">cancellation token</param>
        /// <returns>app settings object</returns>
        public async Task<AppSettings> GetAppSettingsAsync(CancellationToken token)
        {
            await this.initCompleteTask;

            if (this.appSettings != null)
            {
                return this.appSettings;
            }

            var appDataEntry = await this.connection.Table<AppDataEntry>()?.FirstOrDefaultAsync();
            this.appSettings = appDataEntry?.AppSettings;

            if (this.appSettings == null)
            {
                this.appSettings = new AppSettings();
                await this.StoreAppSettingsAsync(this.appSettings);
            }

            return this.appSettings;
        }

        /// <summary>
        /// Stores new app settings object
        /// </summary>
        /// <param name="appSettings">new app settings to store</param>
        /// <returns>task to wait on</returns>
        public async Task StoreAppSettingsAsync(AppSettings appSettings)
        {
            await this.initCompleteTask;

            await this.connection.InsertOrReplaceAsync(new AppDataEntry
            {
                AppSettings = appSettings
            });
        }

        /// <summary>
        /// Returns location data service that acesses the locations in the database
        /// </summary>
        /// <returns>location data service</returns>
        public ILocationDataService GetLocationDataService()
        {
            return new LocationDataService(this.connection);
        }

        /// <summary>
        /// Gets list of locations
        /// </summary>
        /// <param name="token">cancellation token</param>
        /// <returns>list of locations</returns>
        public Task<List<Location>> GetLocationListAsync(CancellationToken token)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Stores new location list
        /// </summary>
        /// <param name="locationList">location list to store</param>
        /// <returns>task to wait on</returns>
        public Task StoreLocationListAsync(List<Location> locationList)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Returns track data service that acesses the tracks in the database
        /// </summary>
        /// <returns>track data service</returns>
        public ITrackDataService GetTrackDataService()
        {
            return new TrackDataService(this.connection);
        }

        /// <summary>
        /// Gets list of tracks
        /// </summary>
        /// <param name="token">cancellation token</param>
        /// <returns>list of tracks</returns>
        public Task<List<Track>> GetTrackListAsync(CancellationToken token)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Stores new track list
        /// </summary>
        /// <param name="trackList">track list to store</param>
        /// <returns>task to wait on</returns>
        public Task StoreTrackListAsync(List<Track> trackList)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Returns a data service for Layer objects
        /// </summary>
        /// <returns>layer data service</returns>
        public ILayerDataService GetLayerDataService()
        {
            return new LayerDataService(this.connection);
        }

        /// <summary>
        /// Gets list of layers
        /// </summary>
        /// <param name="token">cancellation token</param>
        /// <returns>list of layers</returns>
        public Task<List<Layer>> GetLayerListAsync(CancellationToken token)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Stores new layer list
        /// </summary>
        /// <param name="layerList">layer list to store</param>
        /// <returns>task to wait on</returns>
        public Task StoreLayerListAsync(List<Layer> layerList)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Returns a data service for WeatherIconDescription objects
        /// </summary>
        /// <returns>weather icon description data service</returns>
        public IWeatherIconDescriptionDataService GetWeatherIconDescriptionDataService()
        {
            return new WeatherIconDescriptionDataService(this.connection);
        }

        /// <summary>
        /// Retrieves list of weather icon descriptions
        /// </summary>
        /// <returns>list with current weather icon descriptions</returns>
        public Task<List<WeatherIconDescription>> GetWeatherIconDescriptionListAsync()
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Stores new weather icon list
        /// </summary>
        /// <param name="weatherIconList">weather icon list to store</param>
        /// <returns>task to wait on</returns>
        public Task StoreWeatherIconDescriptionListAsync(List<WeatherIconDescription> weatherIconList)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Returns the repository of all available weather icon descriptions that can be used
        /// to select weather icons for the customized list
        /// </summary>
        /// <returns>repository of all weather icons</returns>
        public List<WeatherIconDescription> GetWeatherIconDescriptionRepository()
        {
            return DataServiceHelper.GetWeatherIconDescriptionRepository();
        }

        /// <summary>
        /// Retrieves a favicon URL for the given website URL
        /// </summary>
        /// <param name="websiteUrl">website URL</param>
        /// <returns>favicon URL or empty string when none was found</returns>
        public async Task<string> GetFaviconUrlAsync(string websiteUrl)
        {
            await this.initCompleteTask;

            var uri = new Uri(websiteUrl);
            string baseUri = $"{uri.Scheme}://{uri.Host}/";

            if (uri.Host.ToLowerInvariant() == "localhost")
            {
                return $"{uri.Scheme}://{uri.Host}/favicon.ico";
            }

            string faviconUrl =
                (await this.connection.FindAsync<FaviconUrlEntry>(baseUri))?.FaviconUrl;

            if (!string.IsNullOrEmpty(faviconUrl))
            {
                return faviconUrl;
            }

            try
            {
                faviconUrl = await this.backendDataService.GetFaviconUrlAsync(websiteUrl);

                await this.connection.InsertAsync(new FaviconUrlEntry
                {
                    WebsiteUrl = baseUri,
                    FaviconUrl = faviconUrl
                });

                return faviconUrl;
            }
            catch (Exception)
            {
                return string.Empty;
            }
        }

        /// <summary>
        /// Retrieves latest info about a live waypoint, including new coordinates and
        /// description.
        /// </summary>
        /// <param name="liveWaypointId">live waypoint ID</param>
        /// <returns>query result for live waypoint</returns>
        public async Task<LiveWaypointQueryResult> GetLiveWaypointDataAsync(string liveWaypointId)
        {
            return await this.backendDataService.GetLiveWaypointDataAsync(liveWaypointId);
        }

        /// <summary>
        /// Plans a tour with given tour planning parameters and returns the planned tour.
        /// </summary>
        /// <param name="planTourParameters">tour planning parameters</param>
        /// <returns>planned tour</returns>
        public async Task<PlannedTour> PlanTourAsync(PlanTourParameters planTourParameters)
        {
            return await this.backendDataService.PlanTourAsync(planTourParameters);
        }
    }
}
