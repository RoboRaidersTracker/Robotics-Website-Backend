const { readFileSync } = require("fs");

let local, pageCode;
try {
  readFileSync("./src/local_file.txt", "utf-8");
  local = true;
} catch (error) {
  local = false;
}

module.exports = { local };