/** Auth.gs — User authentication via OAuth 2.0 + session tokens */

function getCurrentUser(optEmail) {
  var email = optEmail || '';
  if (!email) {
    try { email = Session.getActiveUser().getEmail(); } catch (ex) {}
  }
  if (!email || !email.endsWith('@unisza.edu.my')) return null;
  return lookupUser(email);
}

function getOAuthUrl() {
  var clientId = CONFIG.GOOGLE_CLIENT_ID || '';
  if (!clientId) return '';
  var redirectUri = ScriptApp.getService().getUrl()
    .replace(/\/a\/[^\/]+\/macros\//, '/macros/');
  var state = Utilities.getUuid();
  CacheService.getScriptCache().put('oauth_state_' + state, 'pending', 600);
  return 'https://accounts.google.com/o/oauth2/v2/auth?' +
    'client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent('openid email') +
    '&state=' + encodeURIComponent(state) +
    '&access_type=offline';
}

function handleOAuthCode(code, state) {
  var cache = CacheService.getScriptCache();
  var stateKey = 'oauth_state_' + state;
  var stored = cache.get(stateKey);
  if (!stored) throw new Error('Invalid or expired OAuth state');
  cache.remove(stateKey);
  var clientId = CONFIG.GOOGLE_CLIENT_ID || '';
  var clientSecret = CONFIG.GOOGLE_CLIENT_SECRET || '';
  var redirectUri = ScriptApp.getService().getUrl()
    .replace(/\/a\/[^\/]+\/macros\//, '/macros/');
  var tokenPayload = {
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  };
  var options = {
    method: 'post',
    payload: tokenPayload,
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', options);
  var result = JSON.parse(response.getContentText());
  if (!result.id_token) throw new Error('OAuth failed: ' + JSON.stringify(result));
  var parts = result.id_token.split('.');
  var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString());
  if (!payload.email) throw new Error('No email in OAuth response');
  if (!payload.email_verified) throw new Error('Email not verified by Google');
  var user = lookupUser(payload.email);
  if (!user) throw new Error('Email tidak berdaftar: ' + payload.email);
  var sessionToken = Utilities.getUuid();
  cache.put('oauth_session_' + sessionToken, user.email, 86400);
  return { sessionToken: sessionToken, user: user };
}

function resolveSessionToken(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var email = cache.get('oauth_session_' + token);
  if (!email) return null;
  return lookupUser(email);
}

function lookupUser(email) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var emailStr = String(email).trim().toLowerCase();

  var ppsSheet = ss.getSheetByName('PPS');
  if (ppsSheet) {
    var ppsData = ppsSheet.getDataRange().getValues();
    for (var i = 1; i < ppsData.length; i++) {
      if (String(ppsData[i][1]).trim().toLowerCase() === emailStr) {
        return { email: email, role: 'Admin', faculty: null, name: ppsData[i][0] };
      }
    }
  }

  var picSheet = ss.getSheetByName('PIC');
  if (picSheet) {
    var picData = picSheet.getDataRange().getValues();
    for (var i = 1; i < picData.length; i++) {
      if (String(picData[i][2]).trim().toLowerCase() === emailStr) {
        return { email: email, role: 'Graduate Coordinator', faculty: picData[i][0], name: picData[i][1] };
      }
      if (String(picData[i][4]).trim().toLowerCase() === emailStr) {
        return { email: email, role: 'Faculty PIC', faculty: picData[i][0], name: picData[i][3] };
      }
    }
  }

  return null;
}
