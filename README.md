# Run Code
```bash
node route.js
```

# Working with DynamoDB
## Run Locally
```bash
java -D"java.library.path=./DynamoDBLocal/DynamoDBLocal_lib" -jar ./DynamoDBLocal/DynamoDBLocal.jar
```

Make sure to set credentials to access in accordance with NoSQL Workbench.

## Access Through Terminal
```bash
aws dynamodb [command] --endpoint-url http://localhost:8000
```

### List of Commands
Make sure to use with `--table-name`
- `list-tables`
- `delete-table`
  - `aws dynamodb delete-table --table-name team75_tracking_students --endpoint-url http://localhost:8000`
- `scan`

# Trying to set multiple cookies?
https://stackoverflow.com/questions/45111150/setting-cookie-in-http-response-header-from-aws-lambda-node-js
