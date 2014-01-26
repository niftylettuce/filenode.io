
// # filenode.io

var express = require('express')
var app = express()
var aws = require('aws-sdk')
var crypto = require('crypto')
var moment = require('moment')

var maxFileSize = 10240

var awsConfig = {
  accessKeyId: process.env.ID,
  secretAccessKey: process.env.KEY
}

var bucketUrl = process.env.BUCKET

aws.config.update(awsConfig)

var s3 = new aws.S3()

app.configure(function() {
  app.use(express.logger())
  app.use(express.favicon())
  app.use(express.json())
  app.use(express.urlencoded())
  app.use(express.methodOverride())
  app.set('view engine', 'jade')
  app.set('views', __dirname)
  app.locals.pretty = true
  app.use(app.router)
  app.use(express.static(__dirname))
})

app.get('/', function(req, res, next) {

  console.log('req.query', req.query)
  console.log('req.body', req.body)
  console.log('req.headers', req.headers)

  var policy = {
    expiration: moment.utc().add('days', 1).toISOString(),
    conditions: [
      { bucket: 'filenode' },
      { acl: 'public-read' },
      [ 'starts-with', '$key', 'uploads/' ],
      { success_action_redirect: 'http://localhost:3000/' },
      [ 'starts-with', '$Content-Type', '' ],
      [ 'content-length-range', 0, 524288000 ]
    ]
  }

  policy = JSON.stringify(policy)

  policy = new Buffer(policy).toString('base64')

  res.render('', {
    accessKeyId: awsConfig.accessKeyId,
    success_action_redirect: 'http://localhost:3000/',
    policy: policy,
    signature: crypto.createHmac('sha1', awsConfig.secretAccessKey).update(policy).digest('base64'),
    bucketUrl: bucketUrl
  })
})

app.post('/', function(req, res, next) {
  console.dir(req.query, req.body)
  res.send(200)
}, verifyFile)

function verifyFile(req, res, next) {
  s3.headObject({
    Bucket: req.body.bucket,
    Key: req.body.key
  }, function(err, data) {
    if (err)
      return res.send(500, { message: err.message })
    console.dir('data', data)
    if (data.ContentLength > maxFileSize)
      return res.send(500, { message: 'File too big' })
    res.send(200)
  })
}

app.listen(3000)
