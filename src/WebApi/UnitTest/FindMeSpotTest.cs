using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereToFly.WebApi.Logic.Services;

namespace WhereToFly.WebApi.UnitTest
{
    /// <summary>
    /// Tests for the Find Me SPOT web service class
    /// </summary>
    [TestClass]
    public class FindMeSpotTest
    {
        /// <summary>
        /// Test to get live waypoint data using data service
        /// </summary>
        [TestMethod]
        public void TestLiveWaypointData()
        {
            // set up
            var dataService = new FindMeSpotTrackerDataService();
            string liveWaypointID = "wheretofly-findmespot-xxx";

            // run
            var liveWaypointData = dataService.GetDataAsync(liveWaypointID).Result;

            // check
            Assert.AreEqual(liveWaypointID, liveWaypointData.ID, "live waypoint IDs must match");
        }
    }
}
