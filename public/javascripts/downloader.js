var module = angular.module('downloadApp', []);

module.controller('downloadController', function($scope, $http, $window, $location) {
    $scope.data = [];

  $scope.submitDownload = function() {
    //$window.location.href = '/download?username=' + $scope.text;
    var requestUrl = '/download?username=' + $scope.text;
    console.log("Starting response");
    $http.get(requestUrl)
    .then(function(response) {
        console.log("Get response");
    });
    /*$http({
      method: 'GET',
      url: requestUrl
    }).then(function successCallback(response) {
        $scope.data = response;
      }, function errorCallback(response) {
        console.log('Error: ' + response);
      });*/
  }
});
