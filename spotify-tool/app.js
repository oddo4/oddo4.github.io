const clientId = '260263b1f55c4d6e850c2fe3cab1bb59'; // your clientId
const redirectUrl = 'http://localhost:5500/spotify-tool/'; // https://oddo4.github.io/spotify-tool/

const authorizationEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";
const scope = 'user-read-private user-read-email user-follow-read';

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
var popupCallback;

// If we find a code, we're in a callback, do a token exchange
if (code) {
  const token = await getToken(code);
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

  const token = await refreshToken();
  currentToken.save(token);

  userData = JSON.parse(localStorage.getItem("user-data"));
  if (userData == null) {
    userData = await getUserData();
    localStorage.setItem("user-data", JSON.stringify(userData));
  }
  renderTemplate("main", "logged-in-template", userData);

  let lastArtistInput = localStorage.getItem("last-artist-input");
  if (lastArtistInput != null) {
    document.getElementById("artist-id-input").value = lastArtistInput;
  }

  loadArtistsArrayFromLocalStorage();
  if (artistsArray.length > 0) {
    let artistIds = "";
    artistsArray.forEach((artistData) => {
      artistIds += artistData.id + ",";
    });

    if (artistIds) {
      loadArtistsToList(artistIds);
    }
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
async function getToken(code) {
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
    console.log(errorResponse.error.message + " (" + errorResponse.error.status + ")");
  }
}

async function refreshToken() {
  console.log("refreshToken");
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
    console.log(errorResponse.error.message + " (" + errorResponse.error.status + ")");
  }
}

async function getUserData() {
  console.log("getUserData");
  const response = await fetch("https://api.spotify.com/v1/me", {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.log(errorResponse.error.message + " (" + errorResponse.error.status + ")");
  }
}

async function getSeveralArtists(artistIds) {
  console.log("getSeveralArtists");
  const response = await fetch("https://api.spotify.com/v1/artists?ids=" + artistIds, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.log(errorResponse.error.message + " (" + errorResponse.error.status + ")");
  }
}

async function getArtist(artistId) {
  console.log("getArtist");
  const response = await fetch("https://api.spotify.com/v1/artists/" + artistId, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });

  if (response.ok) {
    return await response.json();
  }
  else {
    let errorResponse = await response.json();
    console.log(errorResponse.error.message + " (" + errorResponse.error.status + ")");
  }
}

// async function getArtist(artistId) {
//   const response = await fetch("https://api.spotify.com/v1/artists/" + artistId, {
//     method: 'GET',
//     headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
//   });

//   if (response.ok) {
//     return await response.json();
//   }
//   else {
//     let errorResponse = await response.json();
//     console.log(errorResponse.error.message + " (" + errorResponse.error.status + ")");
//   }
// }

// Click handlers
async function loginWithSpotifyClick() {
  await redirectToSpotifyAuthorize();
}

async function logoutClick() {
  localStorage.clear();
  window.location.href = redirectUrl;
}

async function refreshTokenClick() {
  const token = await refreshToken();
  currentToken.save(token);
  window.location.reload();
}

async function addArtistClick() {
  let artistInput = document.getElementById("artist-id-input").value.replace("https://open.spotify.com/artist/", "");
  localStorage.setItem("last-artist-input", artistInput);
  
  let artistDataResponse = await getSeveralArtists(artistInput);
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

function popupConfirmClick() {
  if (popupCallback != null) {
    popupCallback();
  }

  hidePopup();
}

function popupCancelClick() {
  hidePopup();
}

async function loadArtistsToList(artistIds) {
  let artistDataResponse = await getSeveralArtists(artistIds);
  if (artistDataResponse != null && artistDataResponse.artists.length > 0) {
    artistDataResponse.artists.forEach((artist) => {
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

function showPopup(message, callback) {
  popupCallback = callback;
  let popup = document.getElementById("popup-body");
  popup.style.visibility = "visible";
  let popupMessage = document.getElementById("popup-message");
  popupMessage.innerHTML = message;
}

function hidePopup() {
  popupCallback = null;
  let popup = document.getElementById("popup-body");
  popup.style.visibility = "hidden";
}

function showCreatePlaylistButton() {
  let button = document.getElementById("create-playlist-button");
  button.style.visibility = "visible";
}

function hideCreatePlaylistButton() {
  let button = document.getElementById("create-playlist-button");
  button.style.visibility = "hidden";
}

// HTML Template Rendering with basic data binding - demoware only.
function renderTemplate(targetId, templateId, data = null) {
  const template = document.getElementById(templateId);
  const clone = template.content.cloneNode(true);

  const elements = clone.querySelectorAll("*");
  elements.forEach(ele => {
    const bindingAttrs = [...ele.attributes].filter(a => a.name.startsWith("data-bind"));

    bindingAttrs.forEach(attr => {
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