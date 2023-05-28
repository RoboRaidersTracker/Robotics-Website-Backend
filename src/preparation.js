const { readFileSync } = require("fs");

let local, pageCode;
try {
  readFileSync("./src/local_file.txt", "utf-8");
  local = true;
} catch (error) {
  local = false;
}

if (local){
  pageCode = readFileSync("./src/page.html", "utf-8");
} else {
  pageCode = readFileSync("./page.html", "utf-8");
}

module.exports = { local, pageCode };