# Setting up `src/local.json`
Example setup:
```json
{
  "aws_access_key_id": "85z0k6",
  "aws_secret_access_key": "78mz0f",
  "region": "localhost",
  "endpoint": "http://localhost:8000"
}
```
Make sure to set credentials to access in accordance with NoSQL Workbench.

# Run Code
```bash
# Terminal 1 - start DynamoDB local server
npm run start:db
# Terminal 2
node route.js
```

# Working with DynamoDB
Mainly use NoSQL Workbench + NodeJS

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
