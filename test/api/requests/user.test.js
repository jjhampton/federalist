const crypto = require("crypto")
const expect = require("chai").expect
const nock = require("nock")
const Promise = require("bluebird")
const request = require("supertest-as-promised")
const sinon = require("sinon")

const factory = require("../support/factory")
const githubAPINocks = require("../support/githubAPINocks")
const session = require("../support/session")
const validateAgainstJSONSchema = require("../support/validateAgainstJSONSchema")

describe("User API", () => {
  var userResponseExpectations = (response, user) => {
    expect(response).to.have.property("id", user.id)
    expect(response).to.have.property("username", user.username)
    expect(response).to.have.property("email", user.email)
  }

  describe("GET /v0/me", () => {
    it("should require authentication", done => {
      factory(User).then(user => {
        return request("http://localhost:1337")
          .get("/v0/me")
          .expect(403)
      }).then(response => {
        validateAgainstJSONSchema("GET", "/me", 403, response.body)
        done()
      })
    })

    it("should render the current user with their GitHub user data", done => {
      var user

      factory(User).then(model => {
        user = model
        return session(user)
      }).then(cookie => {
        return request("http://localhost:1337")
          .get("/v0/me")
          .set("Cookie", cookie)
          .expect(200)
      }).then(response => {
        validateAgainstJSONSchema("GET", "/me", 200, response.body)

        userResponseExpectations(response.body, user)
        expect(response.body).to.have.property("githubAccessToken", user.githubAccessToken)
        expect(response.body).to.have.property("githubUserId", user.githubUserId)

        done()
      })
    })
  })
})
