const fs = require("fs");
const { google } = require("googleapis");
// const { addStudent, getUserUUID } = require("./dynamo_wrapper");
// const { getTokens, getClientID } = require("./google_oauth");
const newSession = () => require("randomstring").generate({
  length: 20,
  charset: "alphanumeric"
});

let pageContent, origin;

try {
  pageContent = fs.readFileSync("./src/page.html", "utf-8");
} catch (error) {
  pageContent = fs.readFileSync("./page.html", "utf-8");
}

// Setup
function page() {
  console.log(pageContent)
  return {
    "statusCode": 200,
    "headers": { "Content-Type": "text/html" },
    "body": pageContent
  }
};

let user_cache = [];
const expireMins = 5;

// Google OAuth
const newClient = () => new google.auth.OAuth2(
  "672955273389-bc25j23ds73qgp7ukroaloutv2a22qjv.apps.googleusercontent.com",
  "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",
  origin
);

const peopleAPI = google.people({
  version: "v1",
});

async function getTokens(code, oauth2Client) {
  let client = oauth2Client || newClient();
  let { tokens } = await client.getToken(code);
  return { tokens, client };
}

async function getClientID(tokens, oauth2Client) {
  let client = oauth2Client || newClient();
  client.setCredentials(tokens);

  let response = await peopleAPI.people.get({
    resourceName: "people/me",
    personFields: "names,emailAddresses,photos",
    auth: client
  });

  return {
    id: response.data.resourceName.split("/")[1],
    name: response.data.names[0].displayName,
    email: response.data.emailAddresses[0].value,
    photo: response.data.photos[0].url
  };
}

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
    new Error();
    origin = event.headers.Host == "localhost" ? "http://localhost" : "https://" + event.headers.Host
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
