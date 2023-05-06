/**
 * A Lambda function that returns a string.
 */
let helloFromLambdaHandler = async (event) => {
  // If you change this message, you will need to adjust tests in hello-from-lambda.test.js
  // const message = 'Hello from Lambda!';

  // All log statements are written to CloudWatch by default. For more information, see
  // https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-logging.html
  // console.log("Test");

  let t = new Date();
  t.setSeconds(t.getSeconds() + 10);

  return {
    "statusCode": 200,
    "headers": { "Content-Type": "text/html", "Set-Cookie": `cheese=good; Expires=${
      t.toUTCString()
    }; HttpOnly` },
    "body": "<html><body>Wassap?</body></html>"
  }
};

module.exports = {
  test: helloFromLambdaHandler
};