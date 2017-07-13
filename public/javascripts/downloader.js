var module = angular.module('downloadApp', []);

module.controller('downloadController', function($scope, $http, $window, $location) {

  $scope.submitDownload = function() {
    //$window.open('http://localhost:8080/download?username=' + $scope.text);

    //$location.path('http://localhost:8080/download?username=' + $scope.text)

    $window.location.href = '/download?username=' + $scope.text;
    //$http.get("/download", {params:{username: $scope.text}});
    //    .then(function (response) { /* */ })
    //$window.open('http://localhost:8080/download?username=' + $scope.text);
    //var data = $http.get('http://localhost:8080/download',{params: {username: $scope.text}})
  }

});
