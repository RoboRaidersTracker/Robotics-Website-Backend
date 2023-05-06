const express = require('express');
const app = express();
const PORT = 80;
const { compile } = require("./update-template");
compile();

app.disable('etag');
app.use(express.json())

const json = require("./template-resources.json");
[...Object.values(json.Resources)].forEach( el => {
  let func, url = el.Properties.CodeUri || "./";
  url += el.Properties.Handler;
  url = url.split(".");
  func = require("." + url[1])[url[2]];

  app[el.Properties.Events.API.Properties.Method](
    el.Properties.Events.API.Properties.Path, async (req, res) => {
      awsData = {};
      awsData["httpMethod"] = req.method.toUpperCase();
      req.get("Cookie") && (awsData["headers"] = {
        "Cookie": req.get("Cookie").split(";").map(el => el.trim()),
        "Host": req.get("Host")
      });
      awsData["body"] = Object.keys(req.body).length == 0 ? null : JSON.stringify(req.body);
      awsData["path"] = req.path

      let retVal = await func(awsData);

      res.status(retVal.statusCode);
      res.header(retVal.headers);
      res.header("Cache-Control", "no-cache, no-store, must-revalidate");
      res.header("Pragma", "no-cache");
      res.header("Expires", 0);
      res.send(retVal.body);
      res.end();
    }
  )
})

app.listen(PORT, function (err) {
  if (err) {
    console.log(err);
  }
  console.log("Server listening on PORT", PORT);
});