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

//수행자입장에서 검색
router.get('/', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
        } else {
            //id 수정해야 함
            let selectQuery = 'SELECT status FROM helpers WHERE user_idx = 1';
            connection.query(selectQuery, function(error, rows) {
                if(error) {
                    console.log("Connection Error : " + error);
                    res.sendStatus(500).send({ message: "Connection Error : " + error });
                    connection.release();
                } else {
                    if (rows == "D"){
                        console.log("this client already asking");
                        res.status(400).send({ message: 'this client already asking' }); 
                        connection.release();
                    } else {
                        let home_lat = req.query.home_lat;
                        let home_long = req.query.home_long;
                        let workplace_lat = req.query.workplace_lat;
                        let workplace_long = req.query.workplace_long;
                        console.log("input : " , home_lat, home_long, workplace_lat, workplace_long);
                        if (!(home_lat && home_long && workplace_lat && workplace_long))
                            res.status(400).send({ message: 'wrong inout', result: [] });
                        else {
                            let lat = (parseFloat(home_lat) + parseFloat(workplace_lat)) / parseFloat(2.0);
                            let long = (parseFloat(home_long) + parseFloat(workplace_long)) / parseFloat(2.0);
                            let r = (lat - home_lat)*(lat - home_lat) + (long - home_long)*(long - home_long);
                            console.log("center : " , lat, long);
                            //매칭되지 않고 반경안에 있는 task
                            let selectQuery = 'SELECT t.*, m.phone, (c.rating/c.rated_count) AS star FROM current_tasks t, clients c, members m WHERE matching_time = ? AND (t.home_lat - ?)*(t.home_lat - ?)+(t.home_long - ?)*(t.home_long - ?) <= ? AND t.clients_members_idx = c.user_idx AND c.user_idx = m.user_id';
                            var value=["0000-00-00 00:00:00",lat,lat,long,long,r];
                            connection.query(selectQuery, value, function(error, rows) {
                                if (error) {
                                    console.log("Connection Error : " + error);
                                    res.sendStatus(500).send({ message: 'Connection Error' + error, result: [] });
                                    connection.release();
                                } else {
                                    console.log('Success selecting the task list');
                                    res.status(200).json({message : "Success in selecting the task list", result : rows});
                                    res.json(rows).send();
                                    connection.release();
                                }
                            });
                        }
                    }
                }
            });
        }
    });
});

module.exports = router;
