const clientId = '260263b1f55c4d6e850c2fe3cab1bb59'; // your clientId
const redirectUrl = 'http://localhost:5500/spotify-tool/'; // https://oddo4.github.io/spotify-tool/

const authorizationEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";
const scope = 'user-read-private user-read-email user-follow-read playlist-modify-public playlist-modify-private';

// Data structure that manages the current active token, caching it in localStorage
const currentToken = {
  get access_token() { return localStorage.getItem('access_token') || null; },
  get refresh_token() { return localStorage.getItem('refresh_token') || null; },
  get expires_in() { return localStorage.getItem('refresh_in') || null },
  get expires() { return localStorage.getItem('expires') || null },

  save: function (response) {
    // console.log(response);
    const { access_token, refresh_token, expires_in } = response;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('expires_in', expires_in);

    const now = new Date();
    const expiry = new Date(now.getTime() + (expires_in * 1000));
    localStorage.setItem('expires', expiry);
  }
};

// On page load, try to fetch auth code from current browser search URL
const args = new URLSearchParams(window.location.search);
const code = args.get('code');

var userData;
var artistsArray = [];
var trackDatasArray = [];
var popupCallback;
var createPlaylistInProgress = false;

// If we find a code, we're in a callback, do a token exchange
if (code) {
  const token = await apiGetToken(code);
  currentToken.save(token);

  // Remove code from URL so we can refresh correctly.
  const url = new URL(window.location.href);
  url.searchParams.delete("code");

  const updatedUrl = url.search ? url.href : url.href.replace('?', '');
  window.history.replaceState({}, document.title, updatedUrl);
}

// If we have a token, we're logged in, so fetch user data and render logged in template
if (currentToken.access_token) {
  let now = new Date();
  let expiry = new Date(currentToken.expires);
  if (now.getTime() > expiry.getTime()) {
    logoutClick();
  }

  const token = await apiRefreshToken();
  currentToken.save(token);

  userData = JSON.parse(localStorage.getItem("user-data"));
  if (userData == null) {
    userData = await apiGetUserData();
    localStorage.setItem("user-data", JSON.stringify(userData));
  }
  renderTemplate("main", "logged-in-template", userData);

  let lastArtistInput = localStorage.getItem("last-artist-input");
  if (lastArtistInput != null) {
    document.getElementById("artist-id-input").value = lastArtistInput;
  }

  loadArtistsArrayFromLocalStorage();
  if (artistsArray.length > 0) {
    loadArtistsArrayToList();
  }
}

// Otherwise we're not logged in, so render the login template
if (!currentToken.access_token) {
  renderTemplate("main", "login-template");
}

function loadArtistsArrayFromLocalStorage() {
  console.log("load artists array");
  artistsArray = JSON.parse(localStorage.getItem("artists-array"));
  if (artistsArray == null) {
    artistsArray = [];
  }

  updateClearButtonVisibility();
  updateCreatePlaylistButtonVisibility();
}

function updateClearButtonVisibility() {
  if (artistsArray.length > 0) {
    document.getElementById("clear-list-button").style.visibility = "visible";
  }
  else {
    document.getElementById("clear-list-button").style.visibility = "hidden";
  }
}

function updateCreatePlaylistButtonVisibility() {
  if (artistsArray.length > 0) {
    document.getElementById("create-playlist-button").style.visibility = "visible";
  }
  else {
    document.getElementById("create-playlist-button").style.visibility = "hidden";
  }
}

function saveArtistsArrayToLocalStorage() {
  console.log("save artists array");
  localStorage.setItem("artists-array", JSON.stringify(artistsArray));
  updateClearButtonVisibility();
  updateCreatePlaylistButtonVisibility();
}

async function redirectToSpotifyAuthorize() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = crypto.getRandomValues(new Uint8Array(64));
  const randomString = randomValues.reduce((acc, x) => acc + possible[x % possible.length], "");

  const code_verifier = randomString;
  const data = new TextEncoder().encode(code_verifier);
  const hashed = await crypto.subtle.digest('SHA-256', data);

  const code_challenge_base64 = btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  window.localStorage.setItem('code_verifier', code_verifier);

  const authUrl = new URL(authorizationEndpoint)
  const params = {
    response_type: 'code',
    client_id: clientId,
    scope: scope,
    code_challenge_method: 'S256',
    code_challenge: code_challenge_base64,
    redirect_uri: redirectUrl,
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString(); // Redirect the user to the authorization server for login
}

// Soptify API Calls
async function apiGetToken(code) {
  console.log("API Call: getToken");

  const code_verifier = localStorage.getItem('code_verifier');

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUrl,
      code_verifier: code_verifier,
    }),
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

async function apiRefreshToken() {
  console.log("API Call: refreshToken");

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: currentToken.refresh_token
    }),
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

async function apiGetUserData() {
  console.log("API Call: getUserData");

  const response = await fetch("https://api.spotify.com/v1/me", {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + currentToken.access_token
    },
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

async function apiGetSeveralArtists(artistIds) {
  console.log("API Call: getSeveralArtists");

  const response = await fetch("https://api.spotify.com/v1/artists?ids=" + artistIds, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + currentToken.access_token
    },
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

async function apiGetArtist(artistId) {
  console.log("API Call: getArtist");

  const response = await fetch("https://api.spotify.com/v1/artists/" + artistId, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + currentToken.access_token
    },
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

async function apiGetArtistsAlbums(artistId, nextCall) {
  console.log("API Call: getArtistsAlbum");

  let includeGroups = "single,album";
  let limit = "50";
  let request = "https://api.spotify.com/v1/artists/" + artistId + "/albums?include_groups=" + includeGroups + "&limit=" + limit;
  if (nextCall) {
    request = nextCall;
  }
  const response = await fetch(request, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + currentToken.access_token
    },
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

async function apiGetAlbumTracks(albumId, nextCall) {
  console.log("API Call: getAlbumTracks");

  let limit = "50";
  let request = "https://api.spotify.com/v1/albums/" + albumId + "/tracks?limit=" + limit;
  if (nextCall) {
    request = nextCall;
  }
  const response = await fetch(request, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + currentToken.access_token
    },
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

async function apiCreatePlaylist(userId, playlistName, playlistDescription) {
  console.log("API Call: createPlaylist");

  const response = await fetch("https://api.spotify.com/v1/users/" + userId + "/playlists", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + currentToken.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      {
        name: playlistName,
        description: playlistDescription,
        public: false
      }
    ),
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

async function apiAddItemsToPlaylist(playlistId, urisObject) {
  console.log("API Call: addItemsToPlaylist");

  const response = await fetch("https://api.spotify.com/v1/playlists/" + playlistId + "/tracks", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + currentToken.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      {
        uris: urisObject
      }
    ),
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.error(errorResponse.error.message + " (" + errorResponse.error.status + ")");
    return null;
  }
}

// Click handlers
async function loginWithSpotifyClick() {
  await redirectToSpotifyAuthorize();
}

async function logoutClick() {
  localStorage.clear();
  window.location.href = redirectUrl;
}

async function refreshTokenClick() {
  if (createPlaylistInProgress) {
    return;
  }

  const token = await apiRefreshToken();
  currentToken.save(token);
  window.location.reload();
}

async function addArtistClick() {
  let artistInput = document.getElementById("artist-id-input").value.replace("https://open.spotify.com/artist/", "");
  localStorage.setItem("last-artist-input", artistInput);
  
  let artistDataResponse = await apiGetSeveralArtists(artistInput);
  if (artistDataResponse != null && artistDataResponse.artists.length > 0) {
    artistDataResponse.artists.forEach((artist) => {
      addArtistToList(artist);
    });
  }
}

function removeArtistClick(artistId) {
  // console.log("Remove '" + artistId + "'");
  let artistData = artistsArray.find((artist) => artist.id == artistId);
  if (artistData == null) {
    console.error("Artist ID not found in array!");
    return;
  }

  showPopup("Remove '" + artistData.name + "' from the list?", function () {
    artistsArray.splice(artistsArray.indexOf(artistData), 1);

    let artistsList = document.getElementById("artists-list");
    let artistElement = document.getElementById(artistData.id);
    if (artistElement != null) {
      artistsList.removeChild(artistElement);
    }
  
    saveArtistsArrayToLocalStorage();
  });
}

function clearListClick() {
  showPopup("Clear artists list?", function () {
    let artistElement = document.getElementById("artists-list");
    artistElement.replaceChildren();
    artistsArray = [];
    saveArtistsArrayToLocalStorage();
  });
}

async function createPlaylistClick() {
  let maxProgress = 100;
  let percentage = maxProgress * 0.75;

  showCreatePlaylistProgress();
  setButtonsActive(false);
  setCreatePlaylistProgressValue(0);

  trackDatasArray = [];
  let totalNumOfArtists = artistsArray.length;
  for (let i = 0; i < totalNumOfArtists; i++) {
    await getAndAddTracksToList(artistsArray[i], i, totalNumOfArtists, percentage);
    setCreatePlaylistProgressValue((i + 1) / totalNumOfArtists * percentage);
  }

  let urisObject = getUrisObject();
  if (urisObject == null) {
    console.error("Failed to create playlist! (Uris empty)")
    return;
  }

  console.log(urisObject);
  let playlistDescription = "Playlist generated through Spotify Tool. (";
  artistsArray.forEach((artist) => {
    playlistDescription += artist.name + ", ";
  })
  playlistDescription = playlistDescription.slice(0, -2);
  playlistDescription += ")";

  let playlistResponse = await apiCreatePlaylist(userData.id, "Spotify Tool", playlistDescription);
  if (playlistResponse == null) {
    return;
  }

  console.log(playlistResponse);

  if (urisObject.length > 100) {
    let totalUris = urisObject.length;
    let totalNumOfCalls = Math.ceil(totalUris / 100);
    let position = 0;
    let nextNumOfObjects = 100;
    for (let i = 0; i < totalNumOfCalls; i++) {
      let trimmedUrisObject = urisObject.slice(position, position + nextNumOfObjects);
      console.log(trimmedUrisObject);
      let addToPlaylistResponse = await apiAddItemsToPlaylist(playlistResponse.id, trimmedUrisObject);
      if (addToPlaylistResponse == null) {
        return;
      }

      position += 100;
      setCreatePlaylistProgressValue(percentage + ((i + 1) / totalNumOfCalls * percentage));
    }
  }
  else {
    let addToPlaylistResponse = await apiAddItemsToPlaylist(playlistResponse.id, urisObject);
    if (addToPlaylistResponse == null) {
      return;
    }
  }
  
  setCreatePlaylistProgressValue(maxProgress);

  hideCreatePlaylistProgress();
  setButtonsActive(true);

  console.log("Playlist created successfully!");
}

function popupConfirmClick() {
  if (popupCallback != null) {
    popupCallback();
  }

  hidePopup();
}

function popupCancelClick() {
  hidePopup();
}

async function loadArtistsArrayToList() {
  if (artistsArray != null && artistsArray.length > 0) {
    artistsArray.forEach((artist) => {
      addArtistToList(artist);
    });
  }
}

function addArtistToList(artistData) {
  // console.log(artistData);
  let artistsList = document.getElementById("artists-list");
  
  // Check for list element
  let artistElement = document.getElementById(artistData.id);
  if (artistElement == null) {
    artistElement = document.createElement("li");
    artistElement.setAttribute("id", artistData.id);
    artistElement.setAttribute("class", "artist-item");
    artistElement.innerHTML = artistData.name;

    let removeButton = document.createElement("button");
    removeButton.setAttribute("class", "button-alt remove-button");
    removeButton.addEventListener("click", function() { removeArtistClick(artistData.id); });
    removeButton.innerHTML = "✖";
    artistElement.appendChild(removeButton);
    
    artistsList.appendChild(artistElement);
    console.log("Added artist '" + artistData.name + "'");
  }
  else {
    console.log("Artist already in list '" + artistData.name + "'");
  }

  // Check if artist is in local storage array
  if (!artistsArray.some(artist => artist.name == artistData.name)) {
    artistsArray.push(artistData);
    saveArtistsArrayToLocalStorage();
  }
}

async function getAndAddTracksToList(artistData, index, total, percentage) {
  let artistAlbumIds = await getAlbumIds(artistData.id);
  
  if (artistAlbumIds == null || artistAlbumIds.length == 0) {
    console.error("Failed to create playlist! (Albums empty.)");
    return;
  }

  let totalNumOfAlbums = artistAlbumIds.length;
  for (let i = 0; i < totalNumOfAlbums; i++) {
    let albumTrackDatas = await getTrackDatas(artistAlbumIds[i]);
    trackDatasArray = trackDatasArray.concat(albumTrackDatas);
    setCreatePlaylistProgressValue(((index / total) + ((i + 1) / totalNumOfAlbums / total)) * percentage);
  };

  if (trackDatasArray == null || trackDatasArray.length == 0) {
    console.error("Failed to create playlist! (Tracks empty.)");
    return;
  }
}

async function getAlbumIds(artistId) {
  let albumIds = [];
  let firstResponse = await apiGetArtistsAlbums(artistId);
  
  if (firstResponse == null) {
    return null;
  }

  console.log(firstResponse);

  let nextCall = firstResponse.next;
  
  firstResponse.items.forEach((album) => {
    albumIds.push(album.id);
  });

  while (nextCall != null) {
    let nextResponse = await apiGetArtistsAlbums(artistId, nextCall);
    
    if (nextResponse == null) {
      break;
    }

    console.log(nextResponse);

    nextResponse.items.forEach((album) => {
      albumIds.push(album.id);
    });

    nextCall = nextResponse.next;
  }

  return albumIds;
}

async function getTrackDatas(albumId) {
  let trackDatas = [];
  let firstResponse = await apiGetAlbumTracks(albumId);
  
  if (firstResponse == null) {
    return null;
  }

  console.log(firstResponse);

  let nextCall = firstResponse.next;
  
  firstResponse.items.forEach((track) => {
    if (!trackDatasArray.find((existingTrack) => existingTrack.name == track.name)) {
      trackDatas.push(track);
    }
  });

  while (nextCall != null) {
    let nextResponse = await apiGetAlbumTracks(albumId, nextCall);
    
    if (nextResponse == null) {
      break;
    }

    console.log(nextResponse);

    nextResponse.items.forEach((track) => {
      if (!trackDatasArray.find((existingTrack) => existingTrack.name == track.name)) {
        trackDatas.push(track);
      }
    });

    nextCall = nextResponse.next;
  }

  return trackDatas;
}

function getUrisObject() {
  	if (trackDatasArray == null || trackDatasArray.length == 0) {
      return null;
    }

    let uris = [];
    let prefixType = "spotify:track:";
    trackDatasArray.forEach((trackData) => {
      uris.push(prefixType + trackData.id);
    });

    return uris;
}

function showPopup(message, callback) {
  popupCallback = callback;
  document.getElementById("popup-body").style.visibility = "visible";
  document.getElementById("popup-message").innerHTML = message;
}

function hidePopup() {
  popupCallback = null;
  document.getElementById("popup-body").style.visibility = "hidden";
}

function showCreatePlaylistButton() {
  document.getElementById("create-playlist-button").style.visibility = "visible";
}

function hideCreatePlaylistButton() {
  document.getElementById("create-playlist-button").style.visibility = "hidden";
}

function showCreatePlaylistProgress() {
  document.getElementById("create-playlist-progress").style.visibility = "visible";
}

function hideCreatePlaylistProgress() {
  document.getElementById("create-playlist-progress").style.visibility = "hidden";
}

function setCreatePlaylistProgressValue(value) {
  document.getElementById("create-playlist-progress").value = value;
}

function setButtonsActive(active) {
  document.getElementById("refresh-token-button").disabled = !active;
  document.getElementById("add-artist-button").disabled = !active;
  document.getElementById("clear-list-button").disabled = !active;
  document.getElementById("create-playlist-button").disabled = !active;
  let removeButtons = document.getElementsByClassName("remove-button");
  for (let i = 0; i < removeButtons.length; i++) {
    removeButtons[i].disabled = !active;
  }
}

// HTML Template Rendering with basic data binding - demoware only.
function renderTemplate(targetId, templateId, data = null) {
  const template = document.getElementById(templateId);
  const clone = template.content.cloneNode(true);

  const elements = clone.querySelectorAll("*");
  elements.forEach((ele) => {
    const bindingAttrs = [...ele.attributes].filter(a => a.name.startsWith("data-bind"));

    bindingAttrs.forEach((attr) => {
      const target = attr.name.replace(/data-bind-/, "").replace(/data-bind/, "");
      const targetType = target.startsWith("onclick") ? "HANDLER" : "PROPERTY";
      const targetProp = target === "" ? "innerHTML" : target;

      const prefix = targetType === "PROPERTY" ? "data." : "";
      const expression = prefix + attr.value.replace(/;\n\r\n/g, "");

      // Maybe use a framework with more validation here ;)
      try {
        ele[targetProp] = targetType === "PROPERTY" ? eval(expression) : () => { eval(expression) };
        ele.removeAttribute(attr.name);
      } catch (ex) {
        console.error(`Error binding ${expression} to ${targetProp}`, ex);
      }
    });
  });

  const target = document.getElementById(targetId);
  target.innerHTML = "";
  target.appendChild(clone);
}