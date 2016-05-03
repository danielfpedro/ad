angular.module('starter.controllers', [])

.controller('AppCtrl', function($scope, $ionicModal, $timeout) {

})
.factory('FirebaseAuth', function(
    FirebaseRef,
    $firebaseAuth
) {
    return new $firebaseAuth(FirebaseRef); 
})
.factory('FirebaseRef', function(
    CONFIG
) {
    return new Firebase(CONFIG.firebaseRef); 
})
.filter('countMembers', function(){
    return function(input) {
        if (typeof input.members != 'undefined') {
            return Object.keys(input.members).length;
        }
        return 0;
    };
})
.factory('Auth', function(
    $q,
    FirebaseRef,
    $firebaseObject,
    $ionicPlatform
) {
    return {
        doLoginEmailPassword: function(){

        },
        doFacebookLogin: function(){
            var _this = this;
            return this.getAccessToken()
                .then(function(token){
                    _this.authWithToken(token)
                        .then(function(data){
                            console.log(data);
                            var userData = _this.getUserData(data);
                            console.log('Final user data:', userData);
                            console.log('Salvando/update usuario');
                            _this.saveUser(userData);
                        });
                });
        },
        saveUser: function(user) {
            var defer = $q.defer();

            var obj = $firebaseObject(FirebaseRef.child('users').child(user.firebaseUid));

            obj.$loaded()
                .then(function(){
                    obj.facebookId = user.facebookId;
                    obj.name = user.name;
                    obj.email = user.email;
                    obj.provider = user.provider;

                    obj.$save()
                        .then(function(){
                            defer.resolve();
                        });
                });
            
            return defer.promise;
        },
        getUserData: function(data) {
            return {
                firebaseUid: data.uid,
                facebookId: data.facebook.id,
                email: data.facebook.email,
                name: data.facebook.displayName,
                provider: 'facebook'
            };
        },
        authWithToken: function(token) {
            var defer = $q.defer();
            var ref = FirebaseRef;
            console.log('Acessar o firebase authWithToken with:', token);
            ref.authWithOAuthToken("facebook", token, function(error, authData) {
                if (error) {
                    console.error("Login Failed!", error);
                    defer.reject(error);
                } else {
                    console.log("Authenticated successfully with payload:", authData);
                    defer.resolve(authData);
                }
            });

            return defer.promise;
        },
        getAccessToken: function(){
            var defer = $q.defer();

            var fbLoginSuccess = function (userData) {
                console.log("UserInfo: ", userData);
                
                $ionicPlatform.ready(function() {
                    facebookConnectPlugin.getAccessToken(function(token) {
                        console.log("Token: " + token);
                        defer.resolve(token);
                    }, function(error) {
                        console.error('Erro ao obter o token');
                        console.error(error);
                    });
                });
            };

            $ionicPlatform.ready(function() {
                facebookConnectPlugin
                    .login(["public_profile", "email"], fbLoginSuccess, function (error) {
                        console.error('Erro ao logar no Facebook');
                        console.error(error);
                        defer.reject();
                    });
            });

            return defer.promise;
        }
    };
})
.controller('LoginController', function(
    $scope,
    Auth,
    $cordovaToast,
    $ionicPlatform,
    $ionicBackdrop,
    $state,
    FirebaseAuth
) {
    $scope.user = {};
    $scope.doLoginEmailPassword = function() {
        FirebaseAuth.$authWithPassword({
          email: "danielfpedro@gmail.com",
          password: "123mudar"
        }).then(function(authData) {
          $state.go('app.rooms');
        }).catch(function(error) {
          console.error("Authentication failed:", error);
        });
    };
    $scope.logout = function(){
        FirebaseAuth.$unauth();
    };
    $scope.createUser = function() {
      $scope.message = null;
      $scope.error = null;

      FirebaseAuth.$createUser({
        email: 'danielfpedro@gmail.com',
        password: '123mudar'
      }).then(function(userData) {
        $scope.message = "User created with uid: " + userData.uid;
      }).catch(function(error) {
        $scope.error = error;
      });
    };
    $scope.doFacebookLogin = function() {
        $ionicBackdrop.retain();
        Auth
            .doFacebookLogin()
            .then(function(){
                $state.go('app.rooms');
            })
            .catch(function(){
                $ionicPlatform.ready(function() {
                    $cordovaToast.show('Ocorreu um erro ao tentar logar com o Facebook', 'long', 'bottom');
                });
            })
            .finally(function(){
                $ionicBackdrop.release();
            });
    };
})
.controller('RoomsController', function(
    $scope,
    $firebaseObject,
    FirebaseRef,
    authData,
    $ionicPopup
) {
    $scope.rooms = $firebaseObject(FirebaseRef.child('rooms'));

    $scope.createRoom = function(name) {
        var newRoom = FirebaseRef.child('rooms');
        newRoom.push({
            name: name,
            admin: authData.uid
        });
    };

    $scope.newRoomData = {};
    $scope.openPrompt = function() {
          var myPopup = $ionicPopup.show({
            template: '<input type="text" ng-model="newRoomData.name" placeholder="Nome">',
            title: 'Entre com o nome',
            scope: $scope,
            buttons: [
              { text: 'Cancel' },
              {
                text: '<b>Criar</b>',
                type: 'button-positive',
                onTap: function(e) {
                  if (!$scope.newRoomData.name) {
                    //don't allow the user to close unless he enters wifi password
                    e.preventDefault();
                  } else {
                    $scope.createRoom($scope.newRoomData.name);
                    $scope.newRoomData.name = '';
                    return $scope.newRoomData.name;
                  }
                }
              }
            ]
          });
    };
})
.controller('RoomController', function(
    $scope,
    $firebaseObject,
    FirebaseRef,
    $stateParams,
    FirebaseAuth,
    authData,
    $firebaseArray,
    $ionicModal
) {

    function addPresence() {
        console.log('Add presence');
        var newMember = FirebaseRef.child('rooms').child(roomUid).child('members');
        var data = {};
        data[authData.uid] = true;
        newMember.update(data);
    }
    function removePresence() {
        var removeMembership = FirebaseRef.child('rooms').child(roomUid).child('members').child(authData.uid);
        removeMembership.remove();        
    }
    $scope.$on("$ionicView.afterEnter", function(event, data){
        addPresence();
        var presence = FirebaseRef.child('rooms').child(roomUid).child('members').child(authData.uid);
        presence.onDisconnect().remove();

    });
    $scope.$on("$ionicView.afterLeave", function(event, data){
        removePresence();
    });
    console.log(authData);

    var roomUid = $stateParams.id;

    $scope.room = $firebaseObject(FirebaseRef.child('rooms').child(roomUid));

    $scope.members = [];
    $scope.room.$watch(function(){
        $scope.members = [];
        angular.forEach($scope.room.members, function(value, key){
            $scope.members.push($firebaseObject(FirebaseRef.child('users').child(key)));
        });

        console.log('Mudou');
    });
    $scope.room.$loaded().then(function(){
    });

    $scope.chatMessages = [];
    var chatMessages = FirebaseRef.child('roomsChat').child(roomUid).limitToLast(50);
    $scope.chatMessages = $firebaseArray(chatMessages);
    console.log('Mensagens do char', $scope.chatMessages);

    $scope.addChatMessage = function(msg) {
        var data = {'sender': authData.uid, msg: $scope.chatdata.message};
        var addMsg = FirebaseRef.child('roomsChat').child(roomUid);
        addMsg.push(data);
        console.log(msg);
        $scope.chatdata.message = '';
    };

    $scope.chatdata = {};

    $ionicModal.fromTemplateUrl('templates/modal-room-chat.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function(modal) {
        $scope.modal = modal;
    });

    $scope.openModal = function() {
        $scope.modal.show();
    };
    $scope.closeModal = function() {
        $scope.modal.hide();
    };
})


.controller('PlaylistsCtrl', function($scope) {
    $scope.playlists = [
        { title: 'Reggae', id: 1 },
        { title: 'Chill', id: 2 },
        { title: 'Dubstep', id: 3 },
        { title: 'Indie', id: 4 },
        { title: 'Rap', id: 5 },
        { title: 'Cowbell', id: 6 }
    ];
})

.controller('PlaylistCtrl', function($scope, $stateParams) {
});
