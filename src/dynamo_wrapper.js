const { DynamoDB, PutItemCommand, CreateTableCommand, ListTablesCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const uuid_v1 = require("uuid").v1;

const ddb = new DynamoDB({
  // aws_access_key_id: "85z0k6",
  // aws_secret_access_key: "78mz0f",
  region: 'localhost', // us-east-1
  // endpoint: "http://localhost:8000"
});

const tables = {
  sessions: "team75_tracking_sessions",
  students: "team75_tracking_students",
  initiatives: "team75_tracking_initiatives"
}

// function log(obj) {
//   console.dir(obj, { depth: null })
// }

// Init
ddb.send(new ListTablesCommand({})).then(async res => {
  const schemas = require("./data_structure");
  const currTables = res.TableNames;
  for (const table of Object.entries(tables)) {
    if (!currTables.includes(table[1])) {
      await ddb.send(
        new CreateTableCommand(schemas[table[0]])
      );
    }
  }
})

function addStudent(g_ID, g_name, g_email, g_photo, status) {
  if (typeof g_ID === "number") {
    g_ID = g_ID.toString();
  }
  if (typeof status === "string") {
    status = [{ "S": status }]
  } else if (Array.isArray(status)) {
    status = status.map(el => { return { "S": el } })
  }
  let userID = uuid_v1();

  let student_data = {
    "TableName": "team75_tracking_students",
    "Item": {
      "user_id": {
        "S": userID
      },
      "email": {
        "S": g_email
      },
      "google_id": {
        "S": g_ID
      },
      "name": {
        "S": g_name
      },
      "profile_picture": {
        "S": g_photo
      },
      "initiative_data": {
        "L": [
          {
            "M": {}
          }
        ]
      },
      "attendance": {
        "L": [
          {
            "M": {}
          }
        ]
      },
      "tags": {
        "L": status
      }
    }
  }

  ddb.send(new PutItemCommand(student_data));
}

async function getUserUUID(g_ID){
  let query = {
    "TableName": "team75_tracking_students",
    "ScanIndexForward": true,
    "IndexName": "SecureLogin",
    "KeyConditionExpression": "#35f20 = :35f20",
    "ExpressionAttributeValues": {
      ":35f20": {
        "S": g_ID
      }
    },
    "ExpressionAttributeNames": {
      "#35f20": "google_id"
    }
  }

  let res = await ddb.send(new QueryCommand(query));

  return res.Items[0].user_id.S;
}

module.exports = {
  addStudent,
  getUserUUID
}