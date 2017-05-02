(function(global){
  var config = {
    localProxy : "ws://"+window.location.host
    ,serverProxy : "ws://my-ws-iso-websurf.herokuapp.com"
  }
  global.config = config;
})(this);
