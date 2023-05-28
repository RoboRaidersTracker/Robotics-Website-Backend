const { addStudent, getUserUUID } = require("./dynamo_wrapper");
const { getTokens, getClientID } = require("./google_oauth");
const { local, pageCode } = require("./preparation.js");
const newSession = () => require("randomstring").generate({
  length: 20,
  charset: "alphanumeric"
});

// Setup
async function page() {
  return {
    "statusCode": 200,
    "headers": { "Content-Type": "text/html" },
    "body": pageCode
  }
};

let user_cache = [];
const expireMins = 5;

function timestamp(){
  return Math.floor((new Date() - new Date("Jan 1 2020 00:00:00 GMT")) / 1000 / 60);
}

function getCookies(event){
  map = {}
  event?.["headers"]?.["Cookie"]?.forEach(el => {
    let parts = el.split("=");
    map[parts[0].trim()] = parts[1].trim();
  });
  return map;
}

async function checkLogin(event) {
  cookies = getCookies(event);
  let res = user_cache.find(el => el["token"] == cookies["session-token"]
    && el["issued"] + Math.floor(expireMins*60) > timestamp());
  
  if (res === undefined){
    return {
      "statusCode": 404
    }
  }

  return {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json",
    },
    "body": JSON.stringify({"message": "Success!"})
  }
}

async function loginClient(event) {
  try {
    origin = local ? "http://localhost" : "https://" + event.headers.Host
    const { code } = JSON.parse(event.body);
    const { tokens, oauth2Client } = await getTokens(code);
    const g_data = await getClientID(tokens, oauth2Client);

    let session_token = newSession();

    user_cache.push({
      uuid: await getUserUUID(g_data.id),
      token: session_token,
      issued: timestamp()
    })

    // Add user
    // addStudent(g_data.id, g_data.name, g_data.email, g_data.photo, "mentor");

    let expireTime = new Date();
    expireTime.setSeconds(expireTime.getSeconds() + Math.floor(expireMins*60));
    expireTime = expireTime.toUTCString();

    return {
      "statusCode": 200,
      "headers": {
        "Content-Type": "application/json",
        "Set-Cookie": `session-token=${session_token}; Expires=${expireTime}; HttpOnly;`
      },
      "body": JSON.stringify({"message": "Success!"})
    }
  } catch (error) {
    return {
      "statusCode": 401,
      "headers": { "Content-Type": "application/json" },
      "body": JSON.stringify({"message": "Unauthorized."})
    }
  }
}

module.exports = {
  page,
  checkLogin,
  loginClient
}
