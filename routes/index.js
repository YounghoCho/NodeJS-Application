var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var db_config = require('../config/AWS_RDS_Config.json');
aws.config.loadFromPath('./config/AWS_config.json');//.한개지 ..두개찍으면 안됨.
var multer = require('multer');
var multerS3 = require('multer-s3');
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
//나중에 name이 뭘로 오는지 봐야해
router.post('/add', upload.single('file'),function(req, res, next) { //single()에서 S3로 파일이 전송된다.
    console.log(req.body);
});

router.get('/', function(req, res, next) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
          //  var value = [req.params.id];
            connection.query('select * from members;'/*, value*/, function(error, rows) {
                if (error) {
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                    connection.release();
                } else {
                    console.log('All Users');
                    res.json(rows);
                    connection.release();
                }
            });
        }
    });
});

module.exports = router;
