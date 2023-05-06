const fs = require("fs");
const { google } = require("googleapis");
const { v1 } = require("uuid");
const randomstring = () => require("randomstring").generate({
  length: 16,
  charset: "alphanumeric"
});

// Setup
async function page() {
  let pageContent;
  try {
    pageContent = fs.readFileSync("./src/page.html");
  } catch (error) {
    pageContent = fs.readFileSync("./page.html");
  }
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
  let client = oauth2Client || newClient();
  let { tokens } = await client.getToken(code);
  return { tokens, client };
}

async function getClientID(tokens, oauth2Client) {
  let client = oauth2Client || newClient();
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
  console.log(event);
  const { code } = JSON.parse(event.body);
  console.log(code);
  const { tokens, oauth2Client } = await getTokens(code);
  const googleID = await getClientID(tokens, oauth2Client);
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
