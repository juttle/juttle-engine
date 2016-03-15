# Gmail

These examples show ways to read messages from a gmail account and categorize the messages as well as writing the results of programs back to gmail by sending messages.

You can view these examples on the demo system [demo.juttle.io](http://demo.juttle.io/?path=/examples/gmail/index.juttle), or run them on your own using docker (see the parent [README](../README.md)).

A [detailed walkthrough](https://github.com/juttle/juttle-gmail-adapter/blob/master/docs/adapter_impl_notes.md) of the adapter implementation is available if you want to use it as a basis for writing your own adapters.

## Additional docker-compose configuration

None needed.

## ``juttle-config.json`` configuration

Modify `juttle-config.json` to add a ``gmail`` section containing credentials to access messages via the Gmail API:

{
  "adapters": {
    "gmail": {
      "client-credentials": {
        "installed": {
          "client_id": "--your-client-id--",
          "project_id": "--your-project-id",
          "auth_uri": "https:\/\/accounts.google.com\/o\/oauth2\/auth",
          "token_uri": "https:\/\/accounts.google.com\/o\/oauth2\/token",
          "auth_provider_x509_cert_url": "https:\/\/www.googleapis.com\/oauth2\/v1\/certs",
          "client_secret": "--your-client-secret-id--",
          "redirect_uris": [
            "urn:ietf:wg:oauth:2.0:oob",
            "http:\/\/localhost"
          ]
        }
      },
      "oauth2-token": {
        "access_token": "---your-access-token---",
        "token_type": "Bearer",
        "refresh_token": "---your-refresh-token---",
        "expiry_date": DDDDDDDDDDDDD
      }
    }
  }
}

The full set of steps to generate these credentials is [on the README](https://github.com/juttle/juttle-gmail-adapter) page on github.

## Juttle Programs

To run any of these programs, just visit
``http://(localhost|docker machine ip):8080/?path=/examples/gmail/index.juttle``
and follow the links.

### Categorizing messages by recipient

This program reads all messages from the last 12 hours, categorizes the messages by sender, and displays a table and bar chart with the counts. The gmail search expression is configurable.

View this program: [messages_by_sender.juttle](./messages_by_sender.juttle)

### Categorizing messages by time

This program reads all messages from the last 12 hours, batches the messages by time received in 30 minute groups, and displays a timechart with the counts. This program shows how juttle field matches map to message properties by only selecting those messages sent specifically to "me" (i.e. the gmail account owner).

View this program: [messages_by_time.juttle](./messages_by_time.juttle)

### Writing results by sending messages

This program emits a small set of artificial data and writes the result by sending an email. The email contains the data as a JSON attachment to the email. (The output is also written to a table so it can be viewed in juttle-engine).

View this program: [write_results.juttle](./write_results.juttle)

