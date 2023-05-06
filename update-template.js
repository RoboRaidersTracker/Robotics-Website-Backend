const YAML = require("yaml");
const fs = require("fs");

module.exports.compile = () => {
  const yaml = fs.readFileSync("./template-base.yml", "utf-8");
  const json = require("./template-resources.json");
  const doc = new YAML.Document();

  doc.contents = json;

  const template = yaml + "\n" + doc.toString();
  fs.writeFileSync("./template.yml", template);
}