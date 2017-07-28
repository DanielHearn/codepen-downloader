var module = angular.module('downloadApp', []);

module.controller('downloadController', function($scope, $http) {
  $scope.statusColours ={};
  $scope.statusColours.current = {background: "yellow"};
  const greenStatus = "#38B44A";
  const yellowStatus = "#EFB73E";
  const redStatus = "#DF382C";
  $scope.downloading = false;

  $scope.submitDownload = function() {
    //console.log($scope.downloading);
    if($scope.downloading) {

    } else {
      var username = $scope.text
      var requestUrl = '/download?username=' + username;
      //console.log("Starting response");
      $scope.downloading = true;
      $scope.status = "Handling request";
      setInput(true);
      $scope.statusColours.current = {background: yellowStatus, display: "block"};
      $scope.loaderDisplay = {display: "block"}
      $http({
        responseType: 'arraybuffer',
        url: requestUrl,
        headers: {
          'Content-Type': 'application/zip',
        }
      }).then(function successCallback(response) {
          //console.log(response);
          //console.log(response.statusText);
          $scope.downloading = false;
          var data = response.data;
            $scope.statusColours.current = {background: greenStatus, display: "block"};
            $scope.loaderDisplay = {display: "none"}
            $scope.status = "Successfull download";
            //console.log("Successfull");

            var blob = new Blob([data], {type: "application/zip"});

            now = new Date();
            var formattedDate = now.format('isoDate');
            var fileName = formattedDate + "-" + username + ".zip";
            saveAs(blob, fileName);
            setInput(false);
        }, function errorCallback(response) {
          $scope.downloading = false;
          $scope.statusColours.current = {background: redStatus, display: "block"};
          $scope.loaderDisplay = {display: "none"}
          var statusText = response.statusText;
          //console.log(statusText);
          $scope.status = statusText;
          setInput(false);
        });
      }

      function setInput(state) {
        document.getElementById("usernameInput").disabled = state;
      }
    }
});
