const {
  DynamoDB,
  PutItemCommand,
  CreateTableCommand,
  ListTablesCommand,
  QueryCommand,
  BatchWriteItemCommand,
  ScanCommand,
  GetItemCommand,
  UpdateItemCommand,
  BatchGetItemCommand,
} = require("@aws-sdk/client-dynamodb");
const uuid_v1 = require("uuid").v1;

let ddb;
if (process.env.cloud) {
  ddb = new DynamoDB({ region: "us-east-1" });
} else {
  // Keys will vary per device (set by NoSQL Workbench)
  let localData = require("./local.json");
  const creds = (({
    endpoint,
    aws_access_key_id,
    aws_secret_access_key,
    region,
  }) => ({
    endpoint,
    aws_access_key_id,
    aws_secret_access_key,
    region,
  }))(localData);
  ddb = new DynamoDB({ creds });
}

const tables = {
  sessions: "team75_tracking_sessions",
  students: "team75_tracking_students",
  initiatives: "team75_tracking_initiatives",
  departments: "team75_tracking_departments",
};

/* ----- Setup + Init Data ----- */

async function initDB() {
  let res = await ddb.send(new ListTablesCommand({}));

  // Create tables if they don't exist
  const schemas = require("./data_structure.json");
  const currTables = res.TableNames;
  for (const table of Object.entries(tables)) {
    if (!currTables.includes(table[1])) {
      await ddb.send(new CreateTableCommand(schemas[table[0]]));
    }
  }

  // Add init data
  initSampleData();
}

async function initSampleData() {
  try {
    await batchAddUsersDB(
      "eshaandebnath@gmail.com",
      "Eshaan Debnath",
      "Programming",
      ["mentor", "student"]
    );
  } catch {}
}

/* ----- Session Management ----- */

async function addSessionDB(
  session_token,
  timestamp,
  user_id,
  department_name,
  tags
) {
  if (typeof timestamp === "number") {
    timestamp = timestamp.toString();
  }

  if (typeof tags === "string") {
    tags = [{ S: tags }];
  } else if (Array.isArray(tags)) {
    tags = tags.map((el) => {
      return { S: el };
    });
  }

  let query = {
    TableName: "team75_tracking_sessions",
    Item: {
      session_token: {
        S: session_token,
      },
      timestamp: {
        N: timestamp,
      },
      user_id: {
        S: user_id,
      },
      department_name: {
        S: department_name,
      },
      tags: {
        L: tags,
      },
    },
  };

  ddb.send(new PutItemCommand(query));
}

async function findSessionDB(session_token) {
  let query = {
    TableName: "team75_tracking_sessions",
    ScanIndexForward: true,
    ConsistentRead: true,
    KeyConditionExpression: "session_token = :session_token",
    ExpressionAttributeValues: {
      ":session_token": {
        S: session_token,
      },
    },
  };

  let res = await ddb.send(new QueryCommand(query));

  return res.Items[0];
}

async function cleanSessionsDB(expireMins, currTime) {
  let query = {
    TableName: "team75_tracking_sessions",
    ConsistentRead: true,
    ProjectionExpression: "timestamp,session_token",
  };

  let res = await ddb.send(new ScanCommand(query));
  let delItems = [];

  res.Items.forEach((session) => {
    if (parseInt(session.timestamp.N) + expireMins < currTime) {
      delItems.push({
        DeleteRequest: {
          Key: {
            session_token: session.session_token,
            timestamp: session.timestamp,
          },
        },
      });
    }
  });

  for (let i = 0; i < Math.ceil(delItems.length / 25); i++) {
    let slice = delItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query.RequestItems[tables.sessions] = slice;
    await ddb.send(new BatchWriteItemCommand(query));
  }
}

/* ----- Users ----- */
// Add functions
async function batchAddUsersDB(emails, names, departments, tags_s) {
  let len = emails.length;
  if (
    names.length != len ||
    departments.length != len ||
    tags_s.length != len
  ) {
    return false;
  }

  let putItems = [];
  for (let i = 0; i < len; i++) {
    if (typeof tags_s[i] == "string") {
      tags_s[i] = [tags_s[i]];
    }

    tags_s[i] = tags_s[i].map((el) => {
      return { S: el };
    });

    if ((await loginUserDB(emails[i])) !== undefined) {
      // FIX - update instead?
      continue;
    }

    let user_id = uuid_v1();

    putItems.push({
      PutRequest: {
        Item: {
          user_id: { S: user_id },
          email: { S: emails[i] },
          name: { S: names[i] },
          department_name: { S: departments[i] },
          initiative_mins: { N: "0" },
          initiative_data: { L: [] },
          attendance: { L: [] },
          tags: { L: tags_s[i] },
        },
      },
    });
  }

  for (let i = 0; i < Math.ceil(putItems.length / 25); i++) {
    let slice = putItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query.RequestItems.team75_tracking_students = slice;
    res = await ddb.send(new BatchWriteItemCommand(query));
  }
}

// Get functions
async function loginUserDB(email) {
  let query = {
    TableName: "team75_tracking_students",
    ScanIndexForward: true,
    IndexName: "SecureLogin",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": {
        S: email,
      },
    },
  };

  let res = await ddb.send(new QueryCommand(query));

  return res.Items[0];
}

async function getUserOverviewDB(user_id) {
  let query = {
    TableName: "team75_tracking_students",
    ConsistentRead: true,
    Key: {
      user_id: {
        S: user_id,
      },
    },
    ProjectionExpression:
      "user_id,email,#name,department_name,initiative_mins,tags",
    ExpressionAttributeNames: {
      "#name": "name",
    },
  };

  let res = await ddb.send(new GetItemCommand(query));

  return res.Item;
}

async function getAllUsersOverviewDB() {
  let query = {
    TableName: "team75_tracking_students",
    ConsistentRead: true,
    ProjectionExpression:
      "user_id,email,#name,department_name,initiative_mins,tags",
    ExpressionAttributeNames: {
      "#name": "name",
    },
  };

  let res = await ddb.send(new ScanCommand(query));

  return res.Items;
}

async function getUserInitiativeDataDB(user_id) {
  let query = {
    TableName: "team75_tracking_students",
    ConsistentRead: true,
    Key: {
      user_id: {
        S: user_id,
      },
    },
    ProjectionExpression: "initiative_mins,initiative_data",
  };

  let res = await ddb.send(new GetItemCommand(query));

  return res.Item;
}

async function batchGetNamesDB(user_ids) {
  if (typeof user_ids === "string") {
    user_ids = [user_ids];
  }

  let keyItems = [];

  user_ids.forEach((user_id) => {
    keyItems.push({ user_id: { S: user_id } });
  });

  let res = [];
  for (let i = 0; i < Math.ceil(keyItems.length / 25); i++) {
    let slice = keyItems.slice(i * 25, i * 25 + 25);
    query = {
      RequestItems: {
        team75_tracking_students: {
          Keys: slice,
          AttributesToGet: ["name", "user_id"],
        },
      },
    };
    res = [
      ...res,
      ...(await ddb.send(new BatchGetItemCommand(query))).Responses.team75_tracking_students,
    ];
  }
  return res;
}
// Update functions
async function addInitiativeDataToUserDB(
  user_id,
  initiative_id,
  prep_time,
  duration,
  start_time,
  timestamp
) {
  let leads = await getInitiativeLeadsDB(initiative_id);
  let isLead = leads.includes(user_id);
  if (!leads.includes(user_id) && prep_time) {
    return false;
  }

  if (typeof prep_time === "string") {
    prep_time = prep_time.toLowerCase() === "true";
  }

  if (typeof prep_time === "boolean") {
    prep_time = prep_time.toString();
  }

  if (typeof duration === "number") {
    duration = duration.toString();
  }

  if (typeof start_time === "number") {
    start_time = start_time.toString();
  }

  if (typeof timestamp === "number") {
    timestamp = timestamp.toString();
  }

  let query = {
    TableName: "team75_tracking_students",
    Key: {
      user_id: {
        S: user_id,
      },
    },
    UpdateExpression: `SET initiative_mins = initiative_mins + :mins_change,
      initiative_data = list_append(:datapoint, initiative_data)`,
    ExpressionAttributeValues: {
      ":datapoint": {
        L: [
          {
            M: {
              initiative_id: {
                S: initiative_id,
              },
              prep_time: {
                BOOL: prep_time,
              },
              duration: {
                N: duration,
              },
              start_time: {
                N: start_time,
              },
              timestamp: {
                N: timestamp,
              },
            },
          },
        ],
      },
      ":mins_change": { N: duration },
    },
  };

  ddb.send(new UpdateItemCommand(query));

  att = isLead ? "lead_logs" : "participant_logs";

  // https://stackoverflow.com/questions/47472603
  // https://stackoverflow.com/questions/47415522
  query = {
    TableName: "team75_tracking_initiatives",
    Key: {
      initiative_id: {
        S: initiative_id,
      },
    },
    UpdateExpression: `SET total_mins = total_mins + :mins_change,
    ${att}.#user_id = list_append(:datapoint, if_not_exists(${att}[0].#user_id, :empty))`,
    ExpressionAttributeValues: {
      ":datapoint": {
        L: [
          {
            M: {
              duration: {
                N: duration,
              },
              start_time: {
                N: start_time,
              },
              timestamp: {
                N: timestamp,
              },
            },
          },
        ],
      },
      ":mins_change": { N: duration },
      ":empty": { L: [] },
    },
    ExpressionAttributeNames: {
      "#user_id": user_id,
    },
  };

  if (isLead) {
    query.ExpressionAttributeValues[":datapoint"].L[0].M.prep_time = {
      BOOL: prep_time,
    };
  }

  ddb.send(new UpdateItemCommand(query));
  return true;
}

async function batchUpdateUsersDB(user_ids, data) {
  let updateRequests = user_ids.map((user_id) => {
    let query = {
      TableName: "team75_tracking_students",
      Key: {
        user_id: { S: user_id },
      },
      UpdateExpression: "SET",
      ExpressionAttributeValues: {},
      ExpressionAttributeNames: {},
    };

    // Update expression attribute values
    Object.entries(data).forEach(([key, value]) => {
      query.UpdateExpression += ` #${key} = :${key},`;
      query.ExpressionAttributeValues[`:${key}`] = { S: value };
      query.ExpressionAttributeNames[`#${key}`] = key;
    });

    // Remove trailing comma
    query.UpdateExpression = query.UpdateExpression.slice(0, -1);

    return {
      UpdateRequest: {
        Key: query.Key,
        UpdateExpression: query.UpdateExpression,
        ExpressionAttributeValues: query.ExpressionAttributeValues,
        ExpressionAttributeNames: query.ExpressionAttributeNames,
      },
    };
  });

  let batchParams = {
    RequestItems: {
      team75_tracking_students: updateRequests,
    },
  };

  await ddb.send(new BatchWriteItemCommand(batchParams));
}

// Delete functions
async function batchCleanUsersDB(user_ids) {
  if (typeof user_ids === "string") {
    user_ids = [user_ids];
  }

  let putItems = [];

  for (let user_id of user_ids) {
    let user = await ddb
      .send(
        new GetItemCommand({
          TableName: "team75_tracking_students",
          ConsistentRead: true,
          Key: {
            user_id: {
              S: user_id,
            },
          },
          ProjectionExpression: "email,#name,department_name,tags",
          ExpressionAttributeNames: {
            "#name": "name",
          },
        })
      )
      .then((el) => el.Item);

    putItems.push({
      PutRequest: {
        Item: {
          user_id: { S: user_id },
          attendance: { L: [] },
          name: user.name,
          department_name: user.department_name,
          initiative_mins: { N: "0" },
          initiative_data: { L: [] },
          tags: user.tags,
          email: user.email,
        },
      },
    });
  }

  for (let i = 0; i < Math.ceil(putItems.length / 25); i++) {
    let slice = putItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query.RequestItems.team75_tracking_students = slice;
    await ddb.send(new BatchWriteItemCommand(query));
  }
}

async function batchDeleteUsersDB(user_ids) {
  if (typeof user_ids === "string") {
    user_ids = [user_ids];
  }

  let delItems = [];

  user_ids.forEach((user_id) => {
    delItems.push({
      DeleteRequest: {
        Key: {
          user_id: { S: user_id },
        },
      },
    });
  });

  for (let i = 0; i < Math.ceil(delItems.length / 25); i++) {
    let slice = delItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query.RequestItems.team75_tracking_students = slice;
    await ddb.send(new BatchWriteItemCommand(query));
  }
}

/* ----- Initiatives ----- */
// Get functions
async function addInitiativeDB(
  initiative_name,
  picture,
  description,
  categories,
  leads
) {
  if (typeof leads === "string") {
    leads = [leads];
  }

  // Check if leads exist

  let initiative_id = uuid_v1();

  if (typeof categories === "string") {
    categories = [{ S: categories }];
  } else if (Array.isArray(categories)) {
    categories = categories.map((el) => {
      return { S: el };
    });
  }

  let leadObj = {};
  for (let lead of leads) {
    leadObj[lead] = { L: [] };
  }

  let query = {
    TableName: "team75_tracking_initiatives",
    Item: {
      initiative_id: {
        S: initiative_id,
      },
      initiative_name: {
        S: initiative_name,
      },
      description: {
        S: description,
      },
      picture: {
        S: picture,
      },
      categories: {
        L: categories,
      },
      total_mins: {
        N: "0",
      },
      total_participants: {
        N: Object.keys(leadObj).length.toString(),
      },
      participant_logs: {
        M: {},
      },
      lead_logs: {
        M: leadObj,
      },
      leads: {
        L: leads.map((el) => {
          return { S: el };
        }),
      },
    },
  };

  await ddb.send(new PutItemCommand(query));
}

async function getInitiativeLeadsDB(initiative_id) {
  let query = {
    TableName: "team75_tracking_initiatives",
    ConsistentRead: true,
    Key: {
      initiative_id: {
        S: initiative_id,
      },
    },
    ProjectionExpression: "leads",
  };

  let res = await ddb.send(new GetItemCommand(query));

  return res.Item?.leads.L.map((el) => el.S) || [];
}

async function getInitiativeDB(initiative_id) {
  let query = {
    TableName: "team75_tracking_initiatives",
    ConsistentRead: true,
    Key: {
      initiative_id: {
        S: initiative_id,
      },
    },
    ProjectionExpression:
      "initiative_name,categories,total_mins,total_participants,leads,description,picture",
  };

  let res = await ddb.send(new GetItemCommand(query));

  return res.Item;
}

async function getAllInitiativesDB() {
  let query = {
    TableName: "team75_tracking_initiatives",
    ConsistentRead: true,
    ProjectionExpression:
      "initiative_id,initiative_name,categories,total_mins,total_participants,leads,description,picture",
  };

  let res = await ddb.send(new ScanCommand(query));

  return res.Items;
}

async function batchGetInitiativeNamesDB(initiative_ids) {
  if (typeof initiative_ids === "string") {
    initiative_ids = [initiative_ids];
  }

  // Remove duplicates
  initiative_ids = [...new Set(initiative_ids)];

  let keyItems = [];

  initiative_ids.forEach((initiative_id) => {
    keyItems.push({ initiative_id: { S: initiative_id } });
  });

  let res = [];

  // Slice every 25 elements
  for (let i = 0; i < Math.ceil(keyItems.length / 25); i++) {
    let slice = keyItems.slice(i * 25, i * 25 + 25);
    query = {
      RequestItems: {
        team75_tracking_initiatives: {
          Keys: slice,
          AttributesToGet: ["initiative_name", "initiative_id"],
        },
      },
    };
    res = [
      ...res,
      ...(await ddb.send(new BatchGetItemCommand(query))).Responses.team75_tracking_initiatives,
    ];
  }
  return res;
}

async function batchUpdateInitiativesDB(user_ids, data) {
  let updateRequests = user_ids.map((user_id) => {
    let query = {
      TableName: "team75_tracking_initiatives",
      Key: {
        user_id: { S: user_id },
      },
      UpdateExpression: "SET",
      ExpressionAttributeValues: {},
      ExpressionAttributeNames: {},
    };

    // Update expression attribute values
    Object.entries(data).forEach(([key, value]) => {
      query.UpdateExpression += ` #${key} = :${key},`;
      query.ExpressionAttributeValues[`:${key}`] = { S: value };
      query.ExpressionAttributeNames[`#${key}`] = key;
    });

    // Remove trailing comma
    query.UpdateExpression = query.UpdateExpression.slice(0, -1);

    return {
      UpdateRequest: {
        Key: query.Key,
        UpdateExpression: query.UpdateExpression,
        ExpressionAttributeValues: query.ExpressionAttributeValues,
        ExpressionAttributeNames: query.ExpressionAttributeNames,
      },
    };
  });

  let batchParams = {
    RequestItems: {
      team75_tracking_initiatives: updateRequests,
    },
  };

  await ddb.send(new BatchWriteItemCommand(batchParams));
}

// Delete functions
async function batchDeleteInitiativesDB(initiative_ids) {
  if (typeof initiative_ids === "string") {
    initiative_ids = [initiative_ids];
  }

  let delItems = [];

  initiative_ids.forEach((initiative_id) => {
    delItems.push({
      DeleteRequest: {
        Key: {
          initiative_id: { S: initiative_id },
        },
      },
    });
  });

  for (let i = 0; i < Math.ceil(delItems.length / 25); i++) {
    let slice = delItems.slice(i * 25, i * 25 + 25);
    query = { RequestItems: {} };
    query.RequestItems.team75_tracking_initiatives = slice;
    await ddb.send(new BatchWriteItemCommand(query));
  }
}

function packData(obj) {
  const packedObj = {};

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      // Handle different data types
      if (value === null || value === undefined) {
        packedObj[key] = { NULL: true };
      } else if (typeof value === "string") {
        packedObj[key] = { S: value };
      } else if (typeof value === "number") {
        packedObj[key] = { N: value.toString() };
      } else if (typeof value === "boolean") {
        packedObj[key] = { BOOL: value };
      } else if (Array.isArray(value)) {
        packedObj[key] = { L: value.map((item) => packData(item)) };
      } else if (typeof value === "object") {
        packedObj[key] = { M: packData(value) };
      }
    }
  }

  return packedObj;
}

function unpackData(data) {
  const unpackedData = {};

  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];

      if (typeof value === "object") {
        if (value.hasOwnProperty("N")) {
          unpackedData[key] = parseInt(value.N);
        } else if (value.hasOwnProperty("S")) {
          unpackedData[key] = value.S;
        } else if (value.hasOwnProperty("BOOL")) {
          unpackedData[key] = value.BOOL;
        } else if (value.hasOwnProperty("L")) {
          let list_values = [];
          for (const i in value.L) {
            let itemValue = "";
            for (const itemKey in value.L[i]) {
              itemValue += value.L[i][itemKey].S;
            }
            list_values.push(itemValue);
          }
          unpackedData[key] = list_values;
        } else if (value.hasOwnProperty("M")) {
          unpackedData[key] = unpackData(value.M);
        }
      }
    }
  }

  return unpackedData;
}

module.exports = {
  initDB,
  addSessionDB,
  findSessionDB,
  cleanSessionsDB,
  batchAddUsersDB,
  loginUserDB,
  getUserOverviewDB,
  getAllUsersOverviewDB,
  getUserInitiativeDataDB,
  batchGetNamesDB,
  addInitiativeDataToUserDB,
  batchUpdateUsersDB,
  batchCleanUsersDB,
  batchDeleteUsersDB,
  addInitiativeDB,
  getInitiativeLeadsDB,
  getInitiativeDB,
  getAllInitiativesDB,
  batchGetInitiativeNamesDB,
  batchUpdateInitiativesDB,
  batchDeleteInitiativesDB,
  packData,
  unpackData,
};
