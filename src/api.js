const { readFileSync } = require("fs");
const {
  initDB,
  addSessionDB,
  findSessionDB,
  cleanSessionsDB,
  batchAddUsersDB,
  loginUserDB,
  getUserOverviewDB,
  getUserInitiativeDataDB,
  batchGetNamesDB, // Getting users on initiative's page
  addInitiativeDataToUserDB,
  updateUserDB, // In progress, @shravan
  batchCleanUsersDB,
  batchDeleteUsersDB,
  addInitiativeDB,
  getInitiativeLeadsDB,
  getInitiativeDB,
  getAllInitiativesDB,
  // batchGetInitiativeNamesDB, // Getting initiatives on user's page
  updateInitiativeDB, // In progress, @shravan
  batchDeleteInitiativesDB
} = require("./dynamo_wrapper");
const { setOrigin, getTokens, getClientID, getAllClientIDs } = require("./google_oauth");
const newSession = () => require("randomstring").generate({
  length: 20,
  charset: "alphanumeric"
});

// Home page
const pageCode = readFileSync("./src/page.html", "utf-8");

// Predefined constants
const maxInitiativeLogDuration = 60 * 10;

// Session management
let user_cache = [];
const expireMins = 60;
const databaseCleanRateMins = 60 * 24 * 3;
let lastDatabaseClean = timestamp();

function timestamp() {
  return Math.floor((new Date() - new Date("Jan 1 2020 00:00:00 GMT")) / 1000 / 60);
}

async function forceInit() {
  initDB();
}

async function cleanCacheAndDatabase() {
  for (let i = user_cache.length - 1; i >= 0; i--) {
    if (user_cache[i].timestamp + expireMins <= timestamp()) {
      user_cache = user_cache.slice(i + 1);
      return;
    }
  }

  if (lastDatabaseClean + databaseCleanRateMins <= timestamp()) {
    cleanSessionsDB(expireMins, timestamp());
  }
}

/* ----- API Functions ----- */
async function homepage() {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: pageCode
  }
};

async function checkLogin(cookies) {
  if (cookies["session-token"] == undefined) {
    return {
      statusCode: 404
    }
  }

  // Check local cache
  let res = user_cache.find(el => el.session_token == cookies["session-token"]
    && el.issued + expireMins > timestamp());

  if (res != undefined) {
    return {
      statusCode: 200,
      body: { message: "Success!", user_id: user_cache.user_id }
    }
  }

  // Check database
  let session = await findSessionDB(cookies["session-token"])

  if (session != undefined) {
    let session_timestamp = parseInt(session.timestamp.N);
    if (session_timestamp + expireMins > timestamp()) {
      // Update local cache
      user_cache.push({
        session_token: session.session_token.S,
        timestamp: session_timestamp,
        user_id: session.user_id.S,
        department: session.department_name.S,
        tags: session.tags.L.map(el => el.S)
      });

      return {
        statusCode: 200,
        body: { message: "Success!", user_id: user_cache.user_id }
      }
    }
  }

  // If both fail, throw error
  return {
    statusCode: 404
  }
}

async function loginClient(origin, body) {
  try {
    setOrigin(origin);
    const { code } = body;
    const { tokens, oauth2Client } = await getTokens(code);
    const g_data = await getClientID(tokens, oauth2Client);

    let session_token = newSession(), user = await loginUserDB(g_data.id), currTime = timestamp();

    // Save to local cache
    user_cache.push({
      session_token: session_token,
      timestamp: currTime,
      user_id: user.user_id.S,
      department: user.department_name.S,
      tags: user.tags.L.map(el => el.S)
    });

    // Save to database
    addSessionDB(session_token, currTime, user.user_id.S, user.department_name.S, user.tags.L.map(el => el.S));

    // Add user
    // addUser(g_data.id, g_data.name, g_data.email, g_data.photo, "mentor");

    let expireTime = new Date();
    expireTime.setSeconds(expireTime.getSeconds() + Math.floor(expireMins * 60));
    expireTime = expireTime.toUTCString();

    return {
      statusCode: 200,
      headers: {
        "Set-Cookie": `session-token=${session_token}; Expires=${expireTime}; HttpOnly;`
      },
      body: { message: "Success!" }
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 401,
      body: { message: "Unauthorized.", details: error }
    }
  }
}

async function getUserOverview(cookies, body) {
  // Check user + update local cache
  if ((await checkLogin(cookies)).statusCode != 200) {
    return {
      statusCode: 400
    }
  }

  // Check if user has access
  let user = user_cache.find(el => el.session_token == cookies["session-token"]);
  if (body.user_id && user.user_id != body.user_id && !user.tags.includes("mentor")) {
    return {
      statusCode: 403
    }
  }

  let response = await getUserOverviewDB(body.user_id || user.user_id);
  response.initiative_hours = response.initiative_hours.N;
  response.user_id = response.user_id.S;
  response.department_name = response.department_name.S;
  response.name = response.name.S;
  response.profile_picture = response.profile_picture.S;
  response.email = response.email.S;
  response.tags = response.tags.L.map(el => el.S);

  return {
    statusCode: 200,
    body: response
  }
}

async function batchAddStudents(cookies, origin, body) {
  try {
    // Check user + update local cache
    if ((await checkLogin(cookies)).statusCode != 200) {
      return {
        statusCode: 400
      }
    }

    // Check if user has access
    let user = user_cache.find(el => el.session_token == cookies["session-token"]);
    if (!user.tags.includes("mentor")) {
      return {
        statusCode: 403
      }
    }

    setOrigin(origin);
    const { code } = body;
    const { tokens, oauth2Client } = await getTokens(code);
    const g_data = await getAllClientIDs(tokens, oauth2Client, body.searches || [body.search]);

    let g_ids = g_data.map(el => el.id),
      g_names = g_data.map(el => el.name),
      g_emails = g_data.map(el => el.email),
      g_photos = g_data.map(el => el.photo),
      department_names = body.department || body.departments,
      tags_s = body.tags || body.tags_s;

    if (typeof department_names === "string") {
      department_names = new Array(g_data.length).fill(department_names);
    }

    if (department_names.length != g_data.length) {
      throw new Error("Department name list and user list are different sizes.");
    }

    if (typeof tags_s === "string") {
      tags_s = new Array(g_data.length).fill([tags_s]);
    }

    if (tags_s.length != g_data.length) {
      throw new Error("Tag list and user list are different sizes.");
    }

    batchAddUsersDB(g_ids, g_names, g_emails, g_photos, department_names, tags_s);

    return {
      statusCode: 200,
      body: response
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 401,
      body: { message: "Unauthorized.", details: error }
    }
  }
}

async function batchDeleteUsers(cookies, body) {
  // Check user + update local cache
  if ((await checkLogin(cookies)).statusCode != 200) {
    return {
      statusCode: 400
    }
  }

  // Check if user has access
  let user = user_cache.find(el => el.session_token == cookies["session-token"]);
  if (!user.tags.includes("mentor")) {
    return {
      statusCode: 403
    }
  }

  batchDeleteUsersDB(body.user_ids || body.user_id);
  return { statusCode: 200 }
}

async function batchCleanUsers(cookies, body) {
  // Check user + update local cache
  if ((await checkLogin(cookies)).statusCode != 200) {
    return {
      statusCode: 400
    }
  }

  // Check if user has access
  let user = user_cache.find(el => el.session_token == cookies["session-token"]);
  if (!user.tags.includes("mentor")) {
    return {
      statusCode: 403
    }
  }

  batchCleanUsersDB(body.user_ids || body.user_id);
  return { statusCode: 200 }
}

async function getUserInitiativeData(cookies, body) {
  // Check user + update local cache
  if ((await checkLogin(cookies)).statusCode != 200) {
    return {
      statusCode: 400
    }
  }

  // Check if user has access
  let user = user_cache.find(el => el.session_token == cookies["session-token"]);
  if (body.user_id && user.user_id != body.user_id && !user.tags.includes("mentor")) {
    return {
      statusCode: 403
    }
  }

  let response = await getUserInitiativeDataDB(body.user_id || user.user_id);
  response.initiative_hours = response.initiative_hours.N;
  response.initiative_data = response.initiative_data.L.map(el => {
    let obj = {};
    obj.initiative_id = el.M.initiative_id.S
    obj.prep_time = el.M.prep_time.BOOL
    obj.duration = el.M.duration.N
    obj.timestamp = el.M.timestamp.N
  });

  return {
    statusCode: 200,
    body: response
  }
}

async function addInitiativeDataToUser(cookies, body) {
  // Check user + update local cache
  if ((await checkLogin(cookies)).statusCode != 200) {
    return {
      statusCode: 400
    }
  }

  let { user_id, initiative_id, prep_time, duration } = body;

  // Check if user has access
  let user = user_cache.find(el => el.session_token == cookies["session-token"]);
  if (user_id && user.user_id != user_id) {
    return {
      statusCode: 403
    }
  }

  if (duration > maxInitiativeLogDuration) {
    return {
      statusCode: 400
    }
  }

  // FIX
  // Check initiative exists
  // Check that user can log prep time
  if (prep_time);

  addInitiativeDataToUserDB(user_id || user.user_id, initiative_id, prep_time, duration, timestamp());

  let response = await addInitiativeDataToUserDB(body.user_id);
  response.initiative_hours = response.initiative_hours.N;
  response.initiative_data = response.initiative_data.L.map(el => {
    let obj = {};
    obj.initiative_id = el.M.initiative_id.S
    obj.prep_time = el.M.prep_time.BOOL
    obj.duration = el.M.duration.N
    obj.timestamp = el.M.timestamp.N
  });

  return { statusCode: 200 }
}

module.exports = {
  forceInit,
  cleanCacheAndDatabase,
  homepage,
  checkLogin,
  loginClient,
  getUserOverview,
  getUserInitiativeData
}
