const {
  forceInit,
  cleanCacheAndDatabase,
  homepage,
  checkLogin,
  loginClient,
  getUserOverview
} = require("./api")

const devName = "Eshaan Debnath"
const devEmail = "debnathe@htps.us"

function getCookies(header) {
  map = {}
  header["cookies"]?.forEach(el => {
    let parts = el.split("=");
    map[parts[0].trim()] = parts[1].trim();
  });
  return map;
}

async function route(event) {
  let response;
  try {
    cleanCacheAndDatabase();

    const origin = event["headers"]["origin"];
    const path = event["requestContext"]?.["http"]?.["path"].trim();
    const method = event["requestContext"]?.["http"]?.["method"].trim();
    const cookies = getCookies(event);
    const body = event["body"] == undefined ? undefined : JSON.parse(event["body"]);

    if (path == "/" && method == "GET") {
      response = await homepage();
    } else if (path == "/auth" && method == "GET") {
      response = await checkLogin(cookies);
    } else if (path == "/auth" && method == "POST") {
      response = await loginClient(origin, body);
    } else if (path == "/user" && method == "POST") {
      response = await getUserOverview(cookies, body);
    } else if (path == "/force-update") {
      await forceInit();
      response = { "statusCode": 200, "body": JSON.stringify({"message": "Success"}) };
    } else {
      response = { "statusCode": 400, "body": JSON.stringify({"message": "Bad request"}) };
    }

    if (!["string", "number", "boolean", "undefined"].includes(typeof response["body"])) {
      response["body"] = JSON.stringify(response["body"]);
    }
  } catch (error) {
    response = {
      "statusCode": 500,
      "headers": {
        "Content-Type": "text/plain"
      },
      "body": `Oops! Looks like our server returned an error.\n` +
`To report this issue, please contact the developer, ${devName}, at "${devEmail}".\n` +
`Be sure to include the traceback below:
----------
${error.stack}`
    }
    console.log(error.stack);
  }

  if (response["body"]){
    response["headers"] = response["headers"] || {};
    response["headers"]["Content-Type"] = response["headers"]["Content-Type"] || "application/json";
  }

  return response;
}

module.exports = { route };
