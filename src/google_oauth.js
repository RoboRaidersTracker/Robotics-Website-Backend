const { google } = require("googleapis");
let origin;

function setOrigin(requestOrigin) {
  origin = requestOrigin;
}

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

async function getClientID(tokens, oauth2Client, g_id) {
  let client = oauth2Client || newClient();
  client.setCredentials(tokens);

  let response = await peopleAPI.people.get({
    resourceName: `people/${g_id || "me"}`,
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

module.exports = { setOrigin, getTokens, getClientID }
