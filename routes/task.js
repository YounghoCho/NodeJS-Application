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
            res.sendStatus(500).send({ message: "Connection Error : " + error, result: [] });
        } else {
            //id 수정해야 함
            let selectQuery = 'SELECT status FROM helpers WHERE user_idx = 1';
            connection.query(selectQuery, function(error, rows) {
                if(error) {
                    console.log("Connection Error : " + error);
                    res.sendStatus(500).send({ message: "Connection Error : " + error, result: [] });
                    connection.release();
                } else {
                    if (rows == "D"){
                        console.log("this helper already help other client");
                        res.status(405).send({ message: 'this helper already help other client', result: [] }); 
                        connection.release();
                    } else {
                        let home_lat = req.body.home_lat;
                        let home_long = req.body.home_long;
                        let workplace_lat = req.body.workplace_lat;
                        let workplace_long = req.body.workplace_long;
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
                                    console.log("Success in selecting the task list");
                                    res.status(200).json({message : "Success in selecting the task list", result : rows});
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

//의뢰자 
router.post('/', function(req, res) {
    pool.getConnection(function(error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
            connection.release();
        } else {
            //의뢰 가능한 사람인지 검증
            let selectQuery = 'SELECT status FROM clients WHERE id = 1';
            connection.query(selectQuery, function(error, rows) {
                if(error) {
                    console.log("Connection Error : " + error);
                    res.sendStatus(500).send({ message: "Connection Error : " + error });
                    connection.release();
                } else {
                    if (rows == "D"){
                        console.log("this user has already ask to other helper");
                        res.status(405).send({ message: 'this user has already ask to other helper' }); 
                        connection.release();
                    } else {
                        let task_type = req.body.task_type;             let cost = req.body.cost;
                        let details = req.body.details;                 let deadline = req.body.deadline;
                        let workplace_lat = req.body.workplace_lat;     let workplace_long = req.body.workplace_long;
                        let home_lat = req.body.home_lat;               let home_long = req.body.home_long;
                        let workplace_name = req.body.workplace_name;   let home_name = req.body.home_name;
                        let phone = req.body.phone;                     let star = req.body.star;

                        //올바른 인풋이 아닐때
                        if (!(task_type && cost && details && deadline && workplace_lat && workplace_long
                              && home_lat && home_long && workplace_name && home_name && phone && star)) {
                            res.status(400).send({ message: 'wrong inout' });
                            connection.release();
                        } else {
                            //테이블에 정보 삽입
                            let insertQuery = 'INSERT INTO current_tasks SET ?';
                            let value = [task_type, cost, details, deadline, workplace_lat, workplace_long, home_lat, home_long, workplace_name, home_name, phone, star];
                            connection.query(insertQuery, value, function(err, rows) {
                                if(err) {
                                    console.log("Connection Error : " + err);
                                    res.sendStatus(500).send("Connection Error : " + err);
                                    connection.release();
                                } else {
                                    res.status(200).json({ message : "Success in getting user information" });
                                    connection.release();
                                }  
                            });

                            let updateQuery = 'UPDATE clients SET status = ? WHERE user_idx = ?'
                            var value = ["D", 1];
                            connection.query(updateQuery, value, function(error, rows) {
                                if(error) {
                                    console.log("Connection Error : " + err);
                                    res.sendStatus(500).send("Connection Error : " + err);
                                    connection.release();
                                }
                                else {
                                    res.status(200).json({ message : "Success in getting user information" });
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
