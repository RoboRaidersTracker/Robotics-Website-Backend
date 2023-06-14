const {
  DynamoDB,
  PutItemCommand,
  CreateTableCommand,
  ListTablesCommand,
  QueryCommand,
  BatchWriteItemCommand,
  ScanCommand,
  GetItemCommand,
  UpdateItemCommand
} = require("@aws-sdk/client-dynamodb");
const uuid_v1 = require("uuid").v1;

let ddb;
try {
  ddb = new DynamoDB(require("./local.json"))
} catch (error) {
  ddb = new DynamoDB({ region: "us-east-1" });
}

const tables = {
  sessions: "team75_tracking_sessions",
  students: "team75_tracking_students",
  initiatives: "team75_tracking_initiatives",
  departments: "team75_tracking_departments"
}

/* ----- Setup + Init Data ----- */

async function initDB() {
  let res = await ddb.send(new ListTablesCommand({}))

  // Create tables if they don't exist
  const schemas = require("./data_structure.json");
  const currTables = res.TableNames;
  for (const table of Object.entries(tables)) {
    if (!currTables.includes(table[1])) {
      await ddb.send(
        new CreateTableCommand(schemas[table[0]])
      );
    }
  }

  // Add init data
  initSampleData();
}

async function initSampleData() {
  try {
    await batchAddUsersDB(
      "114409764148443206366",
      "Eshaan Debnath",
      "eshaandebnath@gmail.com",
      "https://lh3.googleusercontent.com/a/AAcHTtfsmybpx59Z8dwUWN1saEu0Cm8Pwsl_h_PKns9e5w=s100",
      "Programming",
      "mentor"
    )
  } catch { }
  try {
    await addInitiative(
      "Initiative Name",
      ["STEM", "Internal"],
      "56d26180-ff2e-11ed-ac97-659b7a975caa"
    )
  } catch { }
}

/* ----- Session Management ----- */

async function addSessionDB(session_token, timestamp, user_id, department_name, tags) {
  if (typeof timestamp === "number") {
    timestamp = timestamp.toString();
  }

  if (typeof tags === "string") {
    tags = [{ "S": tags }]
  } else if (Array.isArray(tags)) {
    tags = tags.map(el => { return { "S": el } })
  }

  let query = {
    "TableName": "team75_tracking_sessions",
    "Item": {
      "session_token": {
        "S": session_token
      },
      "timestamp": {
        "N": timestamp
      },
      "user_id": {
        "S": user_id
      },
      "department_name": {
        "S": department_name
      },
      "tags": {
        "L": tags
      }
    }
  }

  ddb.send(new PutItemCommand(query));
}

async function findSessionDB(session_token) {
  let query = {
    "TableName": "team75_tracking_sessions",
    "ScanIndexForward": true,
    "ConsistentRead": true,
    "KeyConditionExpression": "session_token = :session_token",
    "ExpressionAttributeValues": {
      ":session_token": {
        "S": session_token
      }
    }
  }

  let res = await ddb.send(new QueryCommand(query));

  return res.Items[0];
}

async function cleanSessionsDB(expireMins, currTime) {
  let query = {
    "TableName": "team75_tracking_sessions",
    "ConsistentRead": true,
    "ProjectionExpression": "timestamp,session_token"
  }

  let res = await ddb.send(new ScanCommand(query)), delItems = [];

  res.Items.forEach(session => {
    if (parseInt(session.timestamp.N) + expireMins < currTime) {
      delItems.push({
        DeleteRequest: {
          Key: {
            "session_token": session.session_token,
            "timestamp": session.timestamp
          }
        }
      })
    }
  })

  for (let i = 0; i < Math.ceil(delItems.length / 25); i++) {
    let slice = delItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query["RequestItems"][tables["sessions"]] = slice;
    await ddb.send(new BatchWriteItemCommand(query));
  }
}

/* ----- Users ----- */
// Add functions
async function batchAddUsersDB(g_ids, g_names, g_emails, g_photos, department_names, tags_s){

  if (typeof g_ids === "string" || typeof g_ids === "number") {
    g_ids = [g_ids];
    g_names = [g_names];
    g_emails = [g_emails];
    g_photos = [g_photos];
    department_names = [department_names];
    tags_s = [tags_s];
  }

  let len = g_ids.length;
  if (
    g_names.length != len
    || g_emails.length != len
    || g_photos.length != len
    || department_names.length != len
    || tags_s.length != len
  ){
    return false;
  }

  let putItems = [];
  for (let i = 0; i < len; i++){
    if (typeof tags_s[i] == "string") {
      tags_s[i] = [tags_s[i]];
    }

    tags_s[i].map(el => { return { "S": el } })

    putItems.push({
      PutRequest: {
        Item: {
          // FIX
          "user_id": { "S": "114409764148443206366" ? "56d26180-ff2e-11ed-ac97-659b7a975caa" : user_id },
          "google_id": { "S": g_ids[i] },
          "name": { "S": g_names[i] },
          "department_name": { "S": department_names[i] },
          "profile_picture": { "S": g_photos[i] },
          "initiative_hours": { "N": "0" },
          "initiative_data": { "L": [] },
          "attendance": { "L": [] },
          "tags": { "L": tags_s[i] },
          "email": { "S": g_emails[i] }
        }
      }
    })
  }
 
  for (let i = 0; i < Math.ceil(putItems.length / 25); i++) {
    let slice = putItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query["RequestItems"]["team75_tracking_students"] = slice;
    await ddb.send(new BatchWriteItemCommand(query));
  }
}

// Get functions
async function loginUserDB(g_id) {
  if (typeof g_id === "number") {
    g_id = g_id.toString();
  }

  let query = {
    "TableName": "team75_tracking_students",
    "ScanIndexForward": true,
    "IndexName": "SecureLogin",
    "KeyConditionExpression": "google_id = :google_id",
    "ExpressionAttributeValues": {
      ":google_id": {
        "S": g_id
      }
    }
  }

  let res = await ddb.send(new QueryCommand(query));

  return res.Items[0];
}

async function getUserOverviewDB(user_id) {
  let query = {
    "TableName": "team75_tracking_students",
    "ConsistentRead": true,
    "Key": {
      "user_id": {
        "S": user_id
      }
    },
    "ProjectionExpression": "user_id,email,#name,profile_picture,department_name,initiative_hours,tags",
    "ExpressionAttributeNames": {
      "#name": "name"
    }
  }

  let res = await ddb.send(new GetItemCommand(query));

  return res.Item;
}

async function getUserInitiativeDataDB(user_id) {
  let query = {
    "TableName": "team75_tracking_students",
    "ConsistentRead": true,
    "Key": {
      "user_id": {
        "S": user_id
      }
    },
    "ProjectionExpression": "initiative_hours,initiative_data"
  }

  let res = await ddb.send(new GetItemCommand(query));

  return res.Item;
}

// Update functions
async function addInitiativeDataToUserDB(user_id, initiative_id, prep_time, duration, timestamp, lead) {
  // Check if initiative exists

  if (typeof lead === "string") {
    lead = lead.toLowerCase() === "true";
  }

  if (typeof prep_time === "string") {
    prep_time = prep_time.toLowerCase() === "true";
  }

  if (!lead && prep_time){
    return false;
  }

  if (typeof prep_time === "boolean") {
    prep_time = prep_time.toString();
  }

  if (typeof duration === "number") {
    duration = duration.toString();
  }

  if (typeof timestamp === "number") {
    timestamp = timestamp.toString();
  }

  let query = {
    "TableName": "team75_tracking_students",
    "Key": {
      "user_id": {
        "S": user_id
      }
    },
    "UpdateExpression": "SET initiative_data = list_append(:datapoint, initiative_data)",
    "ExpressionAttributeValues": {
      ":datapoint": {
        "M": {
          "initiative_id": {
            "S": initiative_id
          },
          "prep_time": {
            "BOOL": prep_time
          },
          "duration": {
            "N": duration
          },
          "timestamp": {
            "N": timestamp
          }
        }
      }
    }
  }

  ddb.send(new UpdateItemCommand(query));

  att = lead ? "lead_logs" : "participant_logs";

  // https://stackoverflow.com/questions/47472603
  // https://stackoverflow.com/questions/47415522
  query = {
    "TableName": "team75_tracking_initiatives",
    "Key": {
      "initiative_id": {
        "S": initiative_id
      }
    },
    "UpdateExpression": `SET ${att}.${user_id} = list_append(:datapoint, if_not_exists(${att}.${user_id}, :empty)),
    total_mins = total_mins + :mins_change`,
    "ExpressionAttributeValues": {
      ":datapoint": {
        "M": {
          "duration": {
            "N": duration
          },
          "timestamp": {
            "N": timestamp
          }
        }
      },
      ":mins_change": duration,
      ":empty": { "L": [] }
    }
  }

  if (lead){
    query.ExpressionAttributeValues[":datapoint"].M.prep_time = { "BOOL": prep_time }
  }

  ddb.send(new UpdateItemCommand(query));
}

async function updateUserDB(user_id, data){
  // For @shravan
}

// Delete functions
async function batchCleanUsersDB(user_ids) {
  if (typeof user_ids === "string") {
    user_ids = [user_ids];
  }

  let putItems = [];

  user_ids.forEach(user_id => {
    putItems.push({
      PutRequest: {
        Item: {
          "user_id": { "S": user_id },
          "initiative_data": { "L": [] },
          "attendance": { "L": [] }
        }
      }
    })
  })

  for (let i = 0; i < Math.ceil(putItems.length / 25); i++) {
    let slice = putItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query["RequestItems"]["team75_tracking_students"] = slice;
    await ddb.send(new BatchWriteItemCommand(query));
  }
}

async function batchDeleteUsersDB(user_ids) {
  if (typeof user_ids === "string") {
    user_ids = [user_ids];
  }

  let delItems = [];

  user_ids.forEach(user_id => {
    delItems.push({
      DeleteRequest: {
        Key: {
          "user_id": { "S": user_id }
        }
      }
    })
  })

  for (let i = 0; i < Math.ceil(delItems.length / 25); i++) {
    let slice = delItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query["RequestItems"]["team75_tracking_students"] = slice;
    await ddb.send(new BatchWriteItemCommand(query));
  }
}

/* ----- Initiatives ----- */

async function addInitiative(initiative_name, categories, leads) {
  if (typeof leads === "string") {
    leads = [leads]
  }

  // Check if leads exist

  let initiative_id = leads[0] == "56d26180-ff2e-11ed-ac97-659b7a975caa" ? "0ecda500-ff53-11ed-8e9f-339a46b4c7b3" : uuid_v1();

  if (typeof categories === "string") {
    categories = [{ "S": categories }]
  } else if (Array.isArray(categories)) {
    categories = categories.map(el => { return { "S": el } })
  }

  let leadObj = {};
  for (let lead of leads) {
    leadObj[lead] = { "L": [] };
  }

  let query = {
    "TableName": "team75_tracking_initiatives",
    "Item": {
      "initiative_id": {
        "S": initiative_id
      },
      "initiative_name": {
        "S": initiative_name
      },
      "categories": {
        "L": categories
      },
      "total_mins": {
        "N": "0"
      },
      "total_participants": {
        "N": Object.keys(leadObj).length.toString()
      },
      "participant_logs": {
        "M": {}
      },
      "lead_logs": {
        "M": leadObj
      },
      "leads": {
        "L": leads.map(el => { return { "S": el } })
      }
    }
  }

  ddb.send(new PutItemCommand(query));
}

async function getInitiative(initiative_id) {
  let query = {
    "TableName": "team75_tracking_initiatives",
    "ConsistentRead": true,
    "Key": {
      "initiative_id": {
        "S": initiative_id
      }
    },
    "ProjectionExpression": "initiative_name,categories,total_mins,total_participants,leads"
  }

  let res = await ddb.send(new GetItemCommand(query));

  return res.Item;
}

async function getAllInitiatives() {
  let query = {
    "TableName": "team75_tracking_initiatives",
    "ConsistentRead": true,
    "ProjectionExpression": "initiative_id,initiative_name,categories,total_mins,total_participants,leads"
  }

  let res = await ddb.send(new ScanCommand(query));

  return res.Items;
}

async function updateInitiativeDB(user_id, data){
  // For @shravan
}

module.exports = {
  initDB,
  addSessionDB,
  findSessionDB,
  cleanSessionsDB,
  batchAddUsersDB,
  loginUserDB,
  batchCleanUsersDB,
  batchDeleteUsersDB,
  getUserOverviewDB,
  getUserInitiativeDataDB,
  addInitiativeDataToUserDB
}
