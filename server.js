
// # filenode.io

var express = require('express')
var app = express()
var aws = require('aws-sdk')
var crypto = require('crypto')
var moment = require('moment')

var maxFileSize = 1048576 // 1 gb

var awsConfig = {
  accessKeyId: process.env.ID,
  secretAccessKey: process.env.KEY
}

var bucketName = process.env.BUCKET.toLowerCase()
var bucketUrl = 'http://' + bucketName + '.s3.amazonaws.com'

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
      { bucket: bucketName },
      { acl: 'public-read' },
      [ 'starts-with', '$key', 'uploads/' ],
      { success_action_redirect: 'http://localhost:3000/redirect' },
      //[ 'starts-with', '$Content-Type', '' ],
      [ 'content-length-range', 0, 524288000 ]
    ]
  }

  policy = JSON.stringify(policy)

  policy = new Buffer(policy).toString('base64')

  res.render('', {
    accessKeyId: awsConfig.accessKeyId,
    success_action_redirect: 'http://localhost:3000/redirect',
    policy: policy,
    signature: crypto.createHmac('sha1', awsConfig.secretAccessKey).update(policy).digest('base64'),
    bucketUrl: bucketUrl
  })
})

app.get('/redirect', function(req, res, next) {
  console.dir(req.query, req.body)
  next()
}, verifyFile)

function verifyFile(req, res, next) {
  s3.headObject({
    Bucket: req.query.bucket,
    Key: req.query.key
  }, function(err, data) {
    if (err)
      return res.send(500, { message: err.message })
    console.dir('data', data)
    // TODO: remove the file?
    if (data.ContentLength > maxFileSize)
      return res.send(500, { message: 'File too big' })
    res.redirect('http://' + req.query.bucket + '.s3.amazonaws.com/' + req.query.key)
  })
}

app.listen(3000)
