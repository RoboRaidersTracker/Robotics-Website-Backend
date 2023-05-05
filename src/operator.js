const fs = require('fs');
const { google } = require("googleapis");
// const {v4: uuid} = require('uuid');

// Setup
const pageContent = fs.readFileSync('./src/page.html', 'utf8', 'r');

async function page() {
  return {
    "statusCode": 200,
    "headers": { "Content-Type": "text/html" },
    "body": pageContent
  }
};

// Google OAuth
const newClient = () => new google.auth.OAuth2(
  "672955273389-bc25j23ds73qgp7ukroaloutv2a22qjv.apps.googleusercontent.com",
  "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",
  "http://localhost"
);

const peopleAPI = google.people({
  version: "v1",
});

async function getTokens(code, oauth2Client) {
  let client = oauth2Client || new newClient();
  let { tokens } = await client.getToken(code);
  return { tokens, client };
}

async function getClientID(tokens, oauth2Client) {
  let client = oauth2Client || new newClient();
  client.setCredentials(tokens);

  let response = await peopleAPI.people.get({
    resourceName: "people/me",
    personFields: "names,photos",
    auth: client,
  });

  return response.data.resourceName.slice(7);
}

async function checkLogin(event) {
  return {
    "statusCode": 400
  }
}

async function loginClient(event) {
  const { code } = JSON.parse(event.body);
  console.log(code);
  const { tokens, oauth2Client } = getTokens(code);
  const googleID = getClientID(tokens, oauth2Client);
  console.log(googleID);
  return {
    "statusCode": 200,
    "headers": { "Content-Type": "application/json" },
    "body": JSON.stringify({ "google-id": googleID })
  }
}

module.exports = {
  page,
  checkLogin,
  loginClient
}
