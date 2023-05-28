module.exports = {
  "sessions": {
    "TableName": "team75_tracking_sessions",
    "AttributeDefinitions": [
      {
        "AttributeName": "session_token",
        "AttributeType": "S"
      },
      {
        "AttributeName": "timestamp",
        "AttributeType": "N"
      },
      // {
      //   "AttributeName": "user_id",
      //   "AttributeType": "S"
      // },
      // {
      //   "AttributeName": "tags",
      //   "AttributeType": "L"
      // }
    ],
    "KeySchema": [
      {
        "AttributeName": "session_token",
        "KeyType": "HASH"
      },
      {
        "AttributeName": "timestamp",
        "KeyType": "RANGE"
      }
    ],
    "BillingMode": "PROVISIONED",
    // "DeletionProtectionEnabled": true,
    "ProvisionedThroughput": {
      "ReadCapacityUnits": 1,
      "WriteCapacityUnits": 1
    },
    "SSESpecification": {
      "Enabled": false
    },
    "StreamSpecification": {
      "StreamEnabled": false,
      // "StreamViewType": "NEW_AND_OLD_IMAGES"
    },
    "TableClass": "STANDARD_INFREQUENT_ACCESS"
  },
  "students": {
    "TableName": "team75_tracking_students",
    "AttributeDefinitions": [
      {
        "AttributeName": "user_id",
        "AttributeType": "S"
      },
      {
        "AttributeName": "google_id",
        "AttributeType": "S"
      },
      // {
      //   "AttributeName": "email",
      //   "AttributeType": "S"
      // },
      // {
      //   "AttributeName": "name",
      //   "AttributeType": "S"
      // },
      // {
      //   "AttributeName": "profile_picture",
      //   "AttributeType": "S"
      // },
      // {
      //   "AttributeName": "initiative_data",
      //   "AttributeType": "L"
      // },
      // {
      //   "AttributeName": "attendance",
      //   "AttributeType": "L"
      // },
      // {
      //   "AttributeName": "tags",
      //   "AttributeType": "L"
      // }
    ],
    "KeySchema": [
      {
        "AttributeName": "user_id",
        "KeyType": "HASH"
      }
    ],
    "GlobalSecondaryIndexes": [
      {
        "IndexName": "SecureLogin",
        "KeySchema": [
          {
            "AttributeName": "google_id",
            "KeyType": "HASH"
          }
        ],
        "Projection": {
          "ProjectionType": "KEYS_ONLY"
        },
        "ProvisionedThroughput": {
          "ReadCapacityUnits": 1,
          "WriteCapacityUnits": 1
        }
      }
    ],
    "BillingMode": "PROVISIONED",
    // "DeletionProtectionEnabled": true,
    "ProvisionedThroughput": {
      "ReadCapacityUnits": 3,
      "WriteCapacityUnits": 1
    },
    "SSESpecification": {
      "Enabled": false
    },
    "StreamSpecification": {
      "StreamEnabled": false,
      // "StreamViewType": "NEW_AND_OLD_IMAGES"
    },
    "TableClass": "STANDARD_INFREQUENT_ACCESS"
  },
  "initiatives": {
    "TableName": "team75_tracking_initiatives",
    "KeySchema": [
      {
        "AttributeName": "initiative_id",
        "KeyType": "HASH"
      }
    ],
    "AttributeDefinitions": [
      {
        "AttributeName": "initiative_id",
        "AttributeType": "S"
      },
      // {
      //   "AttributeName": "initiative_name",
      //   "AttributeType": "S"
      // },
      // {
      //   "AttributeName": "category",
      //   "AttributeType": "L"
      // },
      // {
      //   "AttributeName": "total_mins",
      //   "AttributeType": "N"
      // },
      // {
      //   "AttributeName": "total_participants",
      //   "AttributeType": "N"
      // },
      // {
      //   "AttributeName": "participants",
      //   "AttributeType": "M"
      // },
      // {
      //   "AttributeName": "leads",
      //   "AttributeType": "M"
      // }
    ],
    "BillingMode": "PROVISIONED",
    // "DeletionProtectionEnabled": true,
    "ProvisionedThroughput": {
      "ReadCapacityUnits": 4,
      "WriteCapacityUnits": 1
    },
    "TableClass": "STANDARD_INFREQUENT_ACCESS"
  }
}