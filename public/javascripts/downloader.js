var module = angular.module('downloadApp', []);

module.controller('downloadController', function($scope, $http, $window, $location) {
  $scope.submitDownload = function() {
    $window.location.href = '/download?username=' + $scope.text;
  }
});
