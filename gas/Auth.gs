/** Auth.gs — User authentication via OAuth 2.0 + session tokens */

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function getCurrentUser(optEmail) {
  var email = optEmail || '';
  if (!email) {
    try { email = Session.getActiveUser().getEmail(); } catch (ex) {}
  }
  if (!email || !email.endsWith('@unisza.edu.my')) return null;
  return decorateUser_(lookupUser(email));
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
  var user = decorateUser_(lookupUser(payload.email));
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
  return decorateUser_(lookupUser(email));
}

function decorateUser_(user) {
  if (!user) return null;
  var isAdmin = user.role === 'Admin';
  user.capabilities = {
    universityStatus: true,
    facultyDetail: !isAdmin,
    graduateSchoolAdmin: isAdmin
  };
  return user;
}

function isGraduateSchoolAdmin_(user) {
  return !!user && !!user.capabilities && user.capabilities.graduateSchoolAdmin === true;
}

function getAuthorizedProgrammeScope_() {
  var user = getCurrentUser();
  if (!user) return null;
  return {
    mode: isGraduateSchoolAdmin_(user) ? 'graduate-school' : 'faculty',
    faculty: user.faculty || null,
    email: user.email
  };
}

function canViewProgramme_(user, mqaCode, optAccess) {
  if (!user || !mqaCode) return false;
  if (isGraduateSchoolAdmin_(user)) return true;

  var programme = findProgrammeByMqaCode_(mqaCode);
  if (!programme) return false;
  if (programme.faculty === String(user.faculty || '').trim()) return true;

  if (!optAccess || optAccess.email !== user.email) return false;
  if (optAccess.mqaCode && optAccess.mqaCode === mqaCode) return true;
  return !!optAccess.targetFaculty && optAccess.targetFaculty === programme.faculty;
}

function requireProgrammeAccess_(mqaCode, action) {
  var user = getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  var access = typeof getActiveAccessGrant_ === 'function'
    ? getActiveAccessGrant_(user.email, mqaCode)
    : null;
  if (!canViewProgramme_(user, mqaCode, access)) {
    throw new Error('Forbidden: programme access is outside your authorized scope');
  }
  return { user: user, action: action || 'view', access: access };
}

function lookupUser(email) {
  var ss = getSpreadsheet();
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
      if (picData[i][6] && String(picData[i][6]).trim().toLowerCase() === emailStr) {
        return { email: email, role: 'Timbalan Dekan Akademik', faculty: picData[i][0], name: picData[i][5] || '' };
      }
    }
  }

  var coorSheet = ss.getSheetByName('COOR');
  if (coorSheet) {
    var coorData = coorSheet.getDataRange().getValues();
    for (var i = 1; i < coorData.length; i++) {
      var coorFaculty = String(coorData[i][0] || '').trim();
      if (String(coorData[i][2]).trim().toLowerCase() === emailStr) {
        if (!coorFaculty) continue;
        return { email: email, role: 'Faculty Coordinator', faculty: coorFaculty, name: String(coorData[i][1] || '').trim() };
      }
    }
  }

  return null;
}
