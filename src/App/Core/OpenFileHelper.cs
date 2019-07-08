﻿using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WhereToFly.App.Core.Services;
using WhereToFly.App.Core.Views;
using WhereToFly.App.Geo;
using WhereToFly.App.Geo.DataFormats;
using WhereToFly.App.Geo.Spatial;
using WhereToFly.App.Model;
using WhereToFly.Shared.Model;
using Xamarin.Forms;

namespace WhereToFly.App.Core
{
    /// <summary>
    /// Helper for opening files, which can either contain locations, tracks or both
    /// </summary>
    public static class OpenFileHelper
    {
        /// <summary>
        /// Waiting dialog that is currently shown; else it's set to null
        /// </summary>
        private static WaitingPopupPage waitingDialog;

        /// <summary>
        /// Opens file from given stream
        /// </summary>
        /// <param name="stream">stream object</param>
        /// <param name="filename">
        /// filename; extension of filename is used to determine file type
        /// </param>
        /// <returns>task to wait on</returns>
        public static async Task OpenFileAsync(Stream stream, string filename)
        {
            if (Path.GetExtension(filename).ToLowerInvariant() == ".czml")
            {
                await ImportLayerFile(stream, filename);
                return;
            }

            try
            {
                var geoDataFile = GeoLoader.LoadGeoDataFile(stream, filename);

                bool hasTracks = geoDataFile.GetTrackList().Any();

                if (geoDataFile.HasLocations() && !hasTracks)
                {
                    await ImportLocationListAsync(geoDataFile.LoadLocationList());
                    return;
                }

                if (!geoDataFile.HasLocations() && hasTracks)
                {
                    await SelectAndImportTrackAsync(geoDataFile);
                    return;
                }

                if (!geoDataFile.HasLocations() && !hasTracks)
                {
                    await App.Current.MainPage.DisplayAlert(
                        Constants.AppTitle,
                        "No locations or tracks were found in the file",
                        "OK");

                    return;
                }

                // file has both locations and tracks; ask user
                await AskUserImportLocationsOrTracks(geoDataFile);
            }
            catch (Exception ex)
            {
                App.LogError(ex);

                await App.Current.MainPage.DisplayAlert(
                    Constants.AppTitle,
                    "Error while opening file: " + ex.Message,
                    "OK");
            }
        }

        /// <summary>
        /// Opens and load location list from given stream object
        /// </summary>
        /// <param name="stream">stream object</param>
        /// <param name="filename">
        /// filename; extension of filename is used to determine file type
        /// </param>
        /// <returns>task to wait on</returns>
        public static async Task OpenLocationListAsync(Stream stream, string filename)
        {
            await CloseWaitingPopupPageAsync();
            waitingDialog = new WaitingPopupPage("Importing locations...");

            try
            {
                await waitingDialog.ShowAsync();

                var geoDataFile = GeoLoader.LoadGeoDataFile(stream, filename);
                var locationList = geoDataFile.HasLocations() ? geoDataFile.LoadLocationList() : null;

                if (locationList == null ||
                    !locationList.Any())
                {
                    await App.Current.MainPage.DisplayAlert(
                        Constants.AppTitle,
                        "No locations were found in the file",
                        "OK");

                    return;
                }

                await ImportLocationListAsync(locationList);
            }
            catch (Exception ex)
            {
                App.LogError(ex);

                await App.Current.MainPage.DisplayAlert(
                    Constants.AppTitle,
                    "Error while loading locations: " + ex.Message,
                    "OK");

                return;
            }
            finally
            {
                await CloseWaitingPopupPageAsync();
            }
        }

        /// <summary>
        /// Opens and loads track from given stream object
        /// </summary>
        /// <param name="stream">stream object</param>
        /// <param name="filename">
        /// filename; extension of filename is used to determine file type
        /// </param>
        /// <returns>true when loading track was successful, false when not</returns>
        public static async Task<bool> OpenTrackAsync(Stream stream, string filename)
        {
            waitingDialog = new WaitingPopupPage("Importing track...");

            try
            {
                await waitingDialog.ShowAsync();

                var geoDataFile = GeoLoader.LoadGeoDataFile(stream, filename);

                bool hasTracks = geoDataFile.GetTrackList().Any();
                if (!hasTracks)
                {
                    await App.Current.MainPage.DisplayAlert(
                        Constants.AppTitle,
                        "No tracks were found in the file",
                        "OK");

                    return false;
                }

                return await SelectAndImportTrackAsync(geoDataFile);
            }
            catch (Exception ex)
            {
                App.LogError(ex);

                await App.Current.MainPage.DisplayAlert(
                    Constants.AppTitle,
                    $"Error while loading track: {ex.Message}",
                    "OK");
            }
            finally
            {
                await CloseWaitingPopupPageAsync();
            }

            return false;
        }

        /// <summary>
        /// Asks user if location list should be appended or replaced
        /// </summary>
        /// <returns>true when location list should be appended, false when it should be
        /// replaced</returns>
        private static async Task<bool> AskAppendToList()
        {
            bool appendToList = await App.Current.MainPage.DisplayAlert(
                Constants.AppTitle,
                "Append to current location list or replace list?",
                "Append",
                "Replace");

            return appendToList;
        }

        /// <summary>
        /// Imports loaded location list by appending or replacing the location list present.
        /// </summary>
        /// <param name="locationList">location list to import</param>
        /// <returns>task to wait on</returns>
        private static async Task ImportLocationListAsync(List<Location> locationList)
        {
            var dataService = DependencyService.Get<IDataService>();

            var currentList = await dataService.GetLocationListAsync(CancellationToken.None);

            if (currentList.Any())
            {
                bool appendToList = await AskAppendToList();

                if (appendToList)
                {
                    locationList.InsertRange(0, currentList);
                }
            }

            await dataService.StoreLocationListAsync(locationList);

            var liveWaypointRefreshService = DependencyService.Get<LiveWaypointRefreshService>();
            liveWaypointRefreshService.UpdateLiveWaypointList(locationList);

            App.ShowToast("Locations were loaded.");

            App.UpdateMapLocationsList();
        }

        /// <summary>
        /// Selects a single file in the track list and imports the track
        /// </summary>
        /// <param name="geoDataFile">geo data file to import from</param>
        /// <returns>true when loading track was successful, false when not</returns>
        private static async Task<bool> SelectAndImportTrackAsync(IGeoDataFile geoDataFile)
        {
            var trackList = geoDataFile.GetTrackList();

            if (trackList.Count == 1)
            {
                return await ImportTrackAsync(geoDataFile, 0);
            }

            string question = "Select track to import";

            var choices = new List<string>();
            int count = 0;
            foreach (var trackName in trackList)
            {
                count++;
                choices.Add($"{count}. {trackName}");
            }

            string choice = await App.Current.MainPage.DisplayActionSheet(
                question,
                "Cancel",
                null,
                choices.ToArray());

            int index = choices.IndexOf(choice);
            if (index != -1)
            {
                return await ImportTrackAsync(geoDataFile, index);
            }

            return false;
        }

        /// <summary>
        /// Imports a single track and adds it to the map
        /// </summary>
        /// <param name="geoDataFile">geo data file to import track from</param>
        /// <param name="trackIndex">track index</param>
        /// <returns>true when loading track was successful, false when not</returns>
        private static async Task<bool> ImportTrackAsync(IGeoDataFile geoDataFile, int trackIndex)
        {
            var track = geoDataFile.LoadTrack(trackIndex);

            if (track == null)
            {
                return false;
            }

            track.CalculateStatistics();

            await CloseWaitingPopupPageAsync();

            track = await AddTrackPopupPage.ShowAsync(track);
            if (track == null)
            {
                return false; // user canceled editing track properties
            }

            // sample track heights only when it's a flight; non-flight tracks are draped onto
            // the ground
            if (track.IsFlightTrack)
            {
                await SampleTrackHeightsAsync(track);
            }

            var dataService = DependencyService.Get<IDataService>();

            var currentList = await dataService.GetTrackListAsync(CancellationToken.None);
            currentList.Add(track);

            await dataService.StoreTrackListAsync(currentList);

            await App.AddTrack(track);
            App.MapView.ZoomToTrack(track);

            App.ShowToast("Track was loaded.");

            return true;
        }

        /// <summary>
        /// Samples track point heights and adjust track
        /// </summary>
        /// <param name="track">track to sample point heights</param>
        /// <returns>task to wait on</returns>
        private static async Task SampleTrackHeightsAsync(Track track)
        {
            waitingDialog = new WaitingPopupPage("Sampling track point heights...");
            App.RunOnUiThread(async () => await waitingDialog.ShowAsync());

            try
            {
                await App.MapView.SampleTrackHeights(track, 0.0);
            }
            finally
            {
                await waitingDialog.HideAsync();
                waitingDialog = null;
            }
        }

        /// <summary>
        /// Asks user if locations or tracks should be imported
        /// </summary>
        /// <param name="geoDataFile">geo data file to import from</param>
        /// <returns>task to wait on</returns>
        private static async Task AskUserImportLocationsOrTracks(IGeoDataFile geoDataFile)
        {
            string question = "What do you want to import?";

            var choices = new string[2]
                {
                    "Import Locations",
                    "Import Tracks"
                };

            string choice = await App.Current.MainPage.DisplayActionSheet(
                question,
                null,
                null,
                choices[0],
                choices[1]);

            if (choice == choices[0])
            {
                await ImportLocationListAsync(geoDataFile.LoadLocationList());
            }
            else if (choice == choices[1])
            {
                await SelectAndImportTrackAsync(geoDataFile);
            }
        }

        /// <summary>
        /// Checks for file extension and then imports layer file
        /// </summary>
        /// <param name="stream">stream to read from</param>
        /// <param name="filename">filename of file</param>
        /// <returns>task to wait on</returns>
        public static async Task OpenLayerFileAsync(Stream stream, string filename)
        {
            if (Path.GetExtension(filename).ToLowerInvariant() != ".czml")
            {
                await App.Current.MainPage.DisplayAlert(
                    Constants.AppTitle,
                    "The file is not a CZML layer data file",
                    "OK");

                return;
            }

            await ImportLayerFile(stream, filename);
        }

        /// <summary>
        /// Imports a layer file
        /// </summary>
        /// <param name="stream">stream to read from</param>
        /// <param name="filename">filename of file</param>
        /// <returns>task to wait on</returns>
        private static async Task ImportLayerFile(Stream stream, string filename)
        {
            string czml;
            using (var streamReader = new StreamReader(stream))
            {
                czml = streamReader.ReadToEnd();
            }

            if (!IsValidJson(czml))
            {
                await App.Current.MainPage.DisplayAlert(
                    Constants.AppTitle,
                    "The file contained no valid CZML layer data",
                    "OK");

                return;
            }

            var layer = new Layer
            {
                Id = Guid.NewGuid().ToString("B"),
                Name = Path.GetFileNameWithoutExtension(filename),
                IsVisible = true,
                LayerType = LayerType.CzmlLayer,
                Data = czml
            };

            layer = await AddLayerPopupPage.ShowAsync(layer);

            if (layer == null)
            {
                return;
            }

            var dataService = DependencyService.Get<IDataService>();

            var layerList = await dataService.GetLayerListAsync(CancellationToken.None);
            layerList.Add(layer);
            await dataService.StoreLayerListAsync(layerList);

            await NavigationService.Instance.NavigateAsync(Constants.PageKeyMapPage, animated: true);

            App.MapView.AddLayer(layer);
            App.MapView.ZoomToLayer(layer);

            App.ShowToast("Layer was loaded.");
        }

        /// <summary>
        /// Checks if given JSON string is actually valid JSON.
        /// </summary>
        /// <param name="json">JSON string to check</param>
        /// <returns>true when valid JSON, false when not</returns>
        private static bool IsValidJson(string json)
        {
            json = json.Trim();

            // check for object or array syntax
            if ((!json.StartsWith("{") || !json.EndsWith("}")) &&
                (!json.StartsWith("[") || !json.EndsWith("]")))
            {
                return false;
            }

            try
            {
                JToken.Parse(json);
                return true;
            }
            catch (JsonReaderException jex)
            {
                App.LogError(jex);
                return false;
            }
            catch (Exception ex)
            {
                App.LogError(ex);
                return false;
            }
        }

        /// <summary>
        /// Closes waiting popup page when on stack (actually removes any popup page).
        /// </summary>
        /// <returns>task to wait on</returns>
        private static async Task CloseWaitingPopupPageAsync()
        {
            try
            {
                if (waitingDialog != null)
                {
                    await waitingDialog.HideAsync();
                    waitingDialog = null;
                }
            }
            catch (Exception)
            {
                // ignore when there's no popup page on stack
            }
        }
    }
}
