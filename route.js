const express = require('express');
const { route } = require('./src/router');
const app = express();
const PORT = 80;

app.disable('etag');
app.use(express.json())

app.use(async (req, res) => {
  req.cookies = req.get("Cookie")?.split(";")?.map(el => el.trim()) || [];
  req.headers.origin = req.get('origin');
  req.requestContext = {};
  req.requestContext.http = {};
  req.requestContext.http.path = req.path;
  req.requestContext.http.method = req.method;
  req.body = JSON.stringify(req.body);

  response = await route(req);

  res.status(response?.statusCode);
  res.header(response.headers);
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", 0);
  res.send(response.body);
  res.end();
})

app.listen(PORT, (err) => {
  if (err) {
    console.log("Make sure to add `local_file.txt`. Here's the error:")
    console.log(err);
  }
  console.log("Server listening on PORT", PORT);
});
