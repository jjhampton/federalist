var expect = require("chai").expect
var factory = require("../../support/factory")

describe('Build Model', () => {
  describe(".beforeCreate(model)", () => {
    it("should set the build token", done => {
      factory(Site).then(site => {
        return Site.findOne(site.id).populate("users")
      }).then(site => {
        user = site.users[0]
        return Build.create({
          site: site,
          user: user,
        })
      }).then(build => {
        expect(build.token).to.not.be.undefined
        expect(build.token).to.have.length.above(0)
        done()
      })
    })
  })

  describe(".afterCreate(model)", () => {
    it("should send a new build message", done => {
      var oldSendMessage = SQS.sqsClient.sendMessage
      SQS.sqsClient.sendMessage = (params, callback) => {
        SQS.sqsClient.sendMessage = oldSendMessage
        done()
      }
      factory(Build)
    })
  })

  describe(".completeJob(err, model)", done => {
    it("should mark a build successful if there's no error", done => {
      var build

      factory(Build).then(model => {
        build = model
        expect(build.state).to.equal("processing")
        expect(build.error).to.be.null
        return Build.completeJob(null, build)
      }).then(() => {
        return Build.findOne(build.id)
      }).then(build => {
        expect(build.state).to.equal("success")
        expect(build.error).to.equal("")
        done()
      })
    })

    it("should mark a build errored with a message if the error is a string", done => {
      var build

      factory(Build).then(model => {
        build = model
        expect(build.state).to.equal("processing")
        expect(build.error).to.be.null
        return Build.completeJob("this is an error message", build)
      }).then(() => {
        return Build.findOne(build.id)
      }).then(build => {
        expect(build.state).to.equal("error")
        expect(build.error).to.equal("this is an error message")
        done()
      })
    })

    it("should mark a build errored with the error's message if the error is an error object", done => {
      var build

      factory(Build).then(model => {
        build = model
        expect(build.state).to.equal("processing")
        expect(build.error).to.be.null
        return Build.completeJob(new Error("this is an error"), build)
      }).then(() => {
        return Build.findOne(build.id)
      }).then(build => {
        expect(build.state).to.equal("error")
        expect(build.error).to.equal("this is an error")
        done()
      })
    })

    it("should sanitize GitHub access tokens from error message", done => {
      var build

      factory(Build).then(model => {
        build = model
        expect(build.state).to.equal("processing")
        expect(build.error).to.be.null
        return Build.completeJob(new Error("http://123abc@github.com"), build)
      }).then(() => {
        return Build.findOne(build.id)
      }).then(build => {
        expect(build.error).not.to.match(/123abc/)
        done()
      })
    })
  })
})
