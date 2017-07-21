var module = angular.module('downloadApp', []);

module.controller('downloadController', function($scope, $http) {
  $scope.statusColours ={};
  $scope.statusColours.current = {background: "yellow"};
  const greenStatus = "#38B44A";
  const yellowStatus = "#EFB73E";
  const redStatus = "#DF382C";

  $scope.submitDownload = function() {
    var username = $scope.text
    var requestUrl = '/download?username=' + username;
    //console.log("Starting response");
    $scope.status = "Sending request";
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
        var data = response.data;
          $scope.statusColours.current = {background: greenStatus, display: "block"};
          $scope.loaderDisplay = {display: "none"}
          $scope.status = "Successfull download";
          //console.log("Successfull");

          var blob = new Blob([data], {type: "application/zip"});
          var fileName = username + ".zip";
          saveAs(blob, fileName);
          setInput(false);
      }, function errorCallback(response) {
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
});
