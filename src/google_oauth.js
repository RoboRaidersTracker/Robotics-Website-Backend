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
}).people;

async function getTokens(code, oauth2Client) {
  let client = oauth2Client || newClient();
  let { tokens } = await client.getToken(code);
  return { tokens, client };
}

async function getClientID(tokens, oauth2Client) {
  let client = oauth2Client || newClient();
  client.setCredentials(tokens);

  let response = await peopleAPI.get({
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

// https://www.googleapis.com/auth/contacts.readonly
async function getAllClientIDs(tokens, oauth2Client, searches) {
  let client = oauth2Client || newClient();
  client.setCredentials(tokens);

  data = new Array(searches.length);
  for (let i = 0; i < searches.length; i++) {
    data[i] = await peopleAPI.searchContacts({
      "query": searches[i],
      "readMask": "names,emailAddresses,photos",
      "sources": [
        "READ_SOURCE_TYPE_PROFILE",
        "READ_SOURCE_TYPE_CONTACT"
      ],
      auth: client
    });
  }

  data = data.map((user, i) =>
    user.data.results.find(res => 
      res.person?.emailAddresses.find(email => searches[i].includes(email.value)) != undefined
    ).person
  )

  return data.map(res => {
    return {
      id: res.resourceName.split("/")[1],
      name: res.names[0].displayName,
      email: res.emailAddresses[0].value,
      photo: res.photos[0].url
    };
  })
}

module.exports = { setOrigin, getTokens, getClientID, getAllClientIDs }
