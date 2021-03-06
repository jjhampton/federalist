const nock = require("nock")

const accessToken = ({ authorizationCode, accessToken, scope } = {}) => {
  authorizationCode = authorizationCode || "auth-code-123abc"
  accessToken = accessToken || "access-token-123abc"

  if (scope && typeof scope !== "string") {
    scope = scope.join(",")
  } else {
    scope = "user,repo"
  }

  return nock("https://github.com")
    .post("/login/oauth/access_token", {
      client_id: sails.config.passport.github.options.clientID,
      client_secret: sails.config.passport.github.options.clientSecret,
      code: authorizationCode
    })
    .reply(200, {
      token_type: "bearer",
      scope: scope,
      access_token: accessToken
    })
}

const githubAuth = (username, organizations) => {
  accessToken()
  user({ username })
  userOrganizations({ organizations })
}

const repo = ({ accessToken, owner, repo, response } = {}) => {
  let webhookNock = nock("https://api.github.com")

  if (owner && repo) {
    webhookNock = webhookNock.get(`/repos/${owner}/${repo}`)
  } else {
    webhookNock = webhookNock.get(/\/repos\/.*\/.*/)
  }

  if (accessToken) {
    webhookNock = webhookNock.query({ access_token: accessToken })
  } else {
    webhookNock = webhookNock.query(true)
  }

  const typicalResponse = {
    permissions: {
      admin: false,
      push: true,
      pull: true,
    }
  }

  response = response || 201
  if (typeof response === "number") {
    response = [response, typicalResponse]
  } else if (response[1] === undefined) {
    response[1] = typicalResponse
  }

  return webhookNock.reply(...response)
}

const user = ({ accessToken, githubUserID, username, email } = {}) => {
  accessToken = accessToken || "access-token-123abc"

  userID = githubUserID || Math.floor(Math.random() * 10000)
  username = username || `user-${userID}`
  email = email || `${username}@example.com`

  return nock("https://api.github.com")
    .get(`/user?access_token=${accessToken}`)
    .reply(200, {
      email: email,
      login: username,
      id: githubUserID
    })
}

const userOrganizations = ({ accessToken, organizations, response } = {}) => {
  accessToken = accessToken || "access-token-123abc"
  organizations = organizations || [{ id: 123456 }]

  return nock("https://api.github.com")
    .get(`/user/orgs?access_token=${accessToken}`)
    .reply(response || 200, organizations)
}

const webhook = ({ accessToken, owner, repo, response } = {}) => {
  let webhookNock = nock("https://api.github.com")

  if (owner && repo) {
    webhookNock = webhookNock.post(`/repos/${owner}/${repo}/hooks`, {
      name: 'web',
      active: true,
      config: {
        url: sails.config.webhook.endpoint,
        secret: sails.config.webhook.secret,
        content_type: 'json',
      },
    })
  } else {
    webhookNock = webhookNock.post(/\/repos\/.*\/.*\/hooks/)
  }

  if (accessToken) {
    webhookNock = webhookNock.query({ access_token: accessToken })
  } else {
    webhookNock = webhookNock.query(true)
  }

  response = response || 201
  if (typeof response === "number") {
    response = [response]
  }

  return webhookNock.reply(...response)
}

module.exports = {
  accessToken,
  githubAuth,
  repo,
  user,
  userOrganizations,
  webhook,
}
