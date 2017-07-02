var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var db_config = require('../config/AWS_RDS_Config.json');
aws.config.loadFromPath('./config/AWS_config.json');//.한개지 ..두개찍으면 안됨.
const multer= require('multer');
const multerS3= require('multer-s3');
var router = express.Router();
var s3= new aws.S3();//S3의 객체를 생성한다

var pool= mysql.createPool({
  host: db_config.host,
  port: db_config.port,
  user: db_config.user,
  password: db_config.password,
  database: db_config.database,
  connectionLimit: db_config.connectionLimit
});

var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'dodghek',
        acl: 'public-read',
        key: function(req, file, cb) {
            cb(null, Date.now() + '.' + file.originalname.split('.').pop());
        }
    })
});


module.exports = router;
