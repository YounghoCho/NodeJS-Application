var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var db_config = require('../config/AWS_RDS_Config.json');
const bodyParser= require('body-parser');
const multer = require('multer');
const multerS3 = require('multer-s3');
var router = express.Router();
var s3 = new aws.S3();//S3의 객체를 생성한다

router.use(bodyParser.urlencoded({extended: true}));
router.use(bodyParser.text());

var pool = mysql.createPool({
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
        key: function (req, file, cb) {
            cb(null, Date.now() + '.' + file.originalname.split('.').pop());
        }
    })
});

router.get('/test', function (req, res) {
    pool.getConnection(function (err, connection) {
        if (err) {
            res.status(500).send({ message: "Connection Error : " });
        } else {
            let Query = 'insert into current_tasks set ?';
            let value = {
            "task_idx": 12,
            "clients_members_idx": 1,
            "helpers_members_idx": 1,
            "task_type": "E",
            "cost": 12000,
            "details": "머리좀 감겨주세요ㅛ 간지러웡 ",
            "home_lat": 37.466882, 
            "home_long": 126.888364,
            "workplace_lat":37.466930,  
            "workplace_long":126.889474,
            "matching_time": "0000-00-00 00:00:00",
            "workplace_name": "어떤곳",
            "home_name": "어떤곳2",
            "deadline": "60분"
        }
            connection.query(Query, value, function (error, rows) {
                if (error) {
                    res.status(500).send({ message: "Connection Error : " + error });
                    connection.release();
                } else {
                    res.status(200).send({ message: rows });
                    connection.release();
                }
            });
        }
    });
});

//수행자입장에서 검색
router.get('/helper', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send({ message: "Connection Error : " + error, result: [] });
        } else {
            //id 수정해야 함
            let selectQuery = 'SELECT status FROM helpers WHERE user_idx = 1';
            connection.query(selectQuery, function (err, rows) {
                if (err) {
                    console.log("Connection Error : " + err);
                    res.status(500).send({ message: "Connection Error : " + err, result: [] });
                    connection.release();
                } else {
                    //이미 수행중인지 체크
                    if (rows == "D") {
                        console.log("this helper already help other client");
                        res.status(405).send({ message: 'this helper already help other client', result: [] });
                        connection.release();
                    } else {
                        //수행중이지 않으면
                        let home_lat = req.query.home_lat;
                        let home_long = req.query.home_long;
                        let workplace_lat = req.query.workplace_lat;
                        let workplace_long = req.query.workplace_long;
                        console.log(req.query.home_lat);
                        console.log(req.query.home_long);
                        console.log(req.query.workplace_lat);
                        console.log(req.query.workplace_long);
                        
                        console.log("input : ", home_lat, home_long, workplace_lat, workplace_long);
                        //올바른 좌표 들어오는지 체크
                        if (!(home_lat && home_long && workplace_lat && workplace_long)) {
                            res.status(400).send({ message: 'wrong inout', result: [] });
                            connection.release();
                        } else {
                            let lat = (parseFloat(home_lat) + parseFloat(workplace_lat)) / parseFloat(2.0);
                            let long = (parseFloat(home_long) + parseFloat(workplace_long)) / parseFloat(2.0);

                            //소수점 6 이하 자르기
                            Math.floor(lat * 1000000)/1000000;
                            Math.floor(long * 1000000)/1000000;
                            //let r = (lat - home_lat)*(lat - home_lat) + (long - home_long)*(long - home_long);
                            
                            function getDistance(lat1, lng1, lat2, lng2) {
                                function deg2rad(deg) {
                                    return deg * (Math.PI / 180);
                                }
                                var dLat = deg2rad(lat2 - lat1);  // deg2rad below
                                var dLon = deg2rad(lng2 - lng1);
                                var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                var d = 6371 * c; // Distance in km
                                return d*0.5;
                            }
                            var r = getDistance(workplace_lat, workplace_long, home_lat, home_long);

                            console.log("center : ", lat, long);
                            console.log("radius : ", r);
                            //매칭되지 않고 반경안에 있는 task list
                            //let selectQuery = 'SELECT t.*, m.user_name, m.phone, (c.rating/c.rated_count) AS star FROM current_tasks t, clients c, members m WHERE matching_time = ? AND (t.home_lat - ?)*(t.home_lat - ?)+(t.home_long - ?)*(t.home_long - ?) <= ? AND t.clients_members_idx = c.user_idx AND c.user_idx = m.user_id';
                            //let selectQuery = 'SELECT * FROM current_tasks';
                            let selectQuery = 'SELECT t.*, m.user_name, m.phone, (c.rating/c.rated_count) AS star FROM current_tasks t, clients c, members m WHERE matching_time = ? AND (6371*acos(cos(radians(?))*cos(radians(workplace_lat))*cos(radians(workplace_long)-radians(?))+sin(radians(?))*sin(radians(workplace_lat))))<=?';
                            var value = ["0000-00-00 00:00:00", lat, long, lat, r];
                            connection.query(selectQuery, value, function (error2, rows2) {
                                if (error) {
                                    console.log("Connection Error2 : " + error2);
                                    res.status(500).send({ message: 'Connection Error' + error, result: [] });
                                    connection.release();
                                } else {
                                    console.log("Success in selecting the task list");
                                    res.status(200).json({ message: "Success in selecting the task list", result: rows2 });
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

router.post('/new', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send({ message: "Connection Error : " + error, result: [] });
        } else {
            let member = {
                user_idx : 20,
                user_id : "tina0430",
                user_name : "이지희",
                user_pw : "asdf1234",
                phone : 12345678,
                gender : "F",
                image_path : "",
                money : 30000,
                about : "뀨",
                join_date : "2016-11-11 12:34:32"
            }
            let selectQuery = 'INSERT INTO members VALUE ?';            
            connection.query(selectQuery, member, function (error, rows) {
                if (error) {
                    console.log("Connection Error : " + error);
                    res.status(500).send({ message: "Connection Error : " + error, result: [] });
                    connection.release();
                } else {
                    console.log("Success in inserting the member");
                    res.status(200).json({ message: "Success in selecting the task list", result: rows });
                    connection.release();
                     
                }
            });
        }
    });
});

//의뢰자
//임무등록 - 등록 30분안에 matching time 갱신 안되면 삭제
//
router.post('/client', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send({ message: "getConnection Error" + error });
            connection.release();
        } else {
            //의뢰 가능한 사람인지 검증
            let selectQuery = 'SELECT status FROM clients WHERE user_idx = 1';
            connection.query(selectQuery, function (error, rows) {
                if (error) {
                    console.log("Connection Error1 : " + error);
                    res.status(500).send({ message: "Connection Error1 : " + error });
                    connection.release();
                } else {
                    if (rows == "D") {
                        console.log("this user has already ask to other helper");
                        res.status(405).send({ message: 'this user has already ask to other helper' });
                        connection.release();
                    } else {
                        let task_type = req.body.task_type;             let cost = req.body.cost;
                        let details = req.body.details;                 let deadline = req.body.deadline;
                        let workplace_lat = req.body.workplace_lat;     let workplace_long = req.body.workplace_long;
                        let home_lat = req.body.home_lat;               let home_long = req.body.home_long;
                        let workplace_name = req.body.workplace_name;   let home_name = req.body.home_name;

                        console.log(req.body.task_type);console.log(cost);console.log(details);console.log(deadline);
                        console.log(workplace_lat);console.log(workplace_long);console.log(workplace_name);console.log(home_name);
                        console.log(workplace_lat);console.log(workplace_long);

                        //올바른 인풋이 아닐때
                        if (!(task_type && cost && details && deadline && workplace_lat && workplace_long
                            && home_lat && home_long && workplace_name && home_name)) {
                            res.status(400).send({ message: 'wrong input' });
                            connection.release();
                        } else {
                            //테이블에 정보 삽입
                            
                            let insertQuery = 'INSERT INTO current_tasks (clients_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, workplace_name, home_name, deadline) VALUE ?';
                            //1은 의뢰자 id대신 쓴거임
                            let value = [1, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, workplace_name, home_name, deadline];
                            connection.query(insertQuery, value, function (err, rows) {
                                if (err) {
                                    console.log("Connection Error2 : " + err);
                                    res.status(500).send("Connection Error2 : " + err);
                                    connection.release();
                                } else {
                                    //의뢰자 사태 갱신
                                    let updateQuery = 'UPDATE clients SET status = ? WHERE user_idx = ?'
                                    var value2 = ["D", 1];
                                    connection.query(updateQuery, value2, function (error, rows) {
                                        if (error) {
                                            console.log("Connection Error3 : " + err);
                                            res.status(500).send("Connection Error3 : " + err);
                                            connection.release();
                                        }
                                        else {
                                            res.status(200).json({ message: "Success" });
                                            connection.release();
                                        }
                                    });
                                }
                            });
                        }
                    }
                }
            });
        }
    });
});

//임무 취소
router.get('/cancle', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("getConnection Error" + error);
            connection.release();
        } else {
            let client = req.query.client_user_idx;
            let helper = req.query.helper_user_idx;
            if (!(client && helper)) {
                res.status(400).send({ message: 'wrong inout' });
                connection.release();
            } else {
                let selectQuery = 'SELECT clients_members_idx FROM current_tasks WHRER helpers_members_idx = ?';
                connection.query(insertQuery, helper, function (err, rows) {
                    if (error) {
                        console.log("Connection Error : " + error);
                        res.status(500).send({ message: "Connection Error : " + error });
                        connection.release();
                    } else {
                        if (rows != client) {
                            res.status(400).send({ message: "wrong input" });
                            connection.release();
                        } else {
                            let deleteQuery = 'UPDATE '
                        }
                    }
                });
            }
        }
    });
});

//매칭 이벤트
router.put('/matching', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("getConnection Error" + error);
            connection.release();
        } else {
            //client_user_idx로 task 검색하고 그 row의 helper_user_idx를 current_tasks 테이블에 추가 
            //matching_time 현재시간으로 변경
            //helpers의 status D로 변경 - client는 이미 D
            let client_user_idx = req.query.client_user_idx;
            let helper_user_idx = req.query.helper_user_idx;

            if (!(client_user_idx && helper_user_idx)) {
                res.status(400).send({ message: 'wrong inout', result: [] });
                connection.release();
            } else {
                let updateQuery = "UPDATE current_tasks SET helpers_members_idx = ? WHERE clients_members_idx = ? AND matching_time = ?";
                let value = [helper_user_idx, client_user_idx, "0000-00-00 00:00:00"];
                connection.query(selectQuery, value, function (err, rows) {
                    if (error) {
                        console.log("Connection Error : " + error);
                        res.status(500).send({ message: "Connection Error : " + error });
                        connection.release();
                    } else {
                        updateQuery = ""
                    }
                });
            }
        }
    });
});


//유저 아이디로 유저 idx 검색해서 저장 / 유저 상태도 변경
//요청이 오면 current에서 별점으로 검색 : post past + finish time = 0000-00-00 00:00:00 star이랑 id 등록 
//두번 쨰 요청이 오면 put past matching time star이랑 id 등록 / delete current - 검사

//ㅇㅖ외처리 해야함!
router.post('/star', function (req, res) {
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log("getConnection Error" + error);
            res.status(500).send("getConnection Error" + error);
            connection.release();
        } else {
            let user_id = req.body.user_id;
            let user_star = req.body.user_star;
            let user_comment = req.body.user_comment;
            let role = req.body.role;

            let user_idx;

            let insertQuery;
            let selectQuery;
            let deleteQuery;

            let check = false;

            console.log(user_id, user_star, user_comment, role);

            //제대로 값이 들어왔는지 확인
            if (!(user_id && user_star && user_comment && role)) {
                res.status(405).send({ message: 'wrong inout - body' });
                connection.release();
            } else {
                //사용자 user_idx 구함
                selectQuery = "SELECT user_idx FROM members WHERE user_id = ?";
                connection.query(selectQuery, user_id, function (err, rows) {
                    if (err) {
                        console.log("Connection Error1 : " + err);
                        res.status(500).send({ message: "Connection Error1 : " + err });
                        connection.release();
                    } else {
                        user_idx = rows.user_idx;
                        console.log(user_idx);

                        if (role == "client") {
                            //insertQuery = "INSERT INTO past_tasks (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time, comment_c, rating_c) VALUE SELECT (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time, ?, ?)";
                            selectQuery = "SELECT rating_h FROM past_tasks WHERE clients_members_idx = ? AND finish_time = ?";
                            insertQuery = "INSERT INTO past_tasks (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time) SELECT clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time FROM current_tasks WHERE clients_members_idx = ?";
                            deleteQuery = "DELETE FROM current_tasks WHERE clients_members_idx = ?";
                            updateQuery = "UPDATE past_tasks SET comment_c = ?, rating_c = ?, matching_time = ? WHERE clients_members_idx = ?";
                        }
                        else if (role == "helper") {
                            //insertQuery = "INSERT INTO past_tasks (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time, comment_h, rating_h) VALUE SELECT (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time, ?, ?)";
                            selectQuery = "SELECT rating_c FROM past_tasks WHERE clients_members_idx = ? AND finish_time = ?";
                            insertQuery = "INSERT INTO past_tasks (clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time) SELECT clients_members_idx, helpers_members_idx, task_type, cost, details, home_lat, home_long, workplace_lat, workplace_long, matching_time FROM current_tasks WHERE helpers_members_idx = ?";
                            deleteQuery = "DELETE FROM current_tasks WHERE helpers_members_idx = ?";
                            updateQuery = "UPDATE past_tasks SET comment_h = ?, rating_h = ?, matching_time = ? WHERE helpers_members_idx = ?";
                        }
                        else {
                            console.log("wrong input - role");
                            res.status(403).send({ message: 'wrong inout - role' });
                            connection.release();
                        }

                        //상대방이 별점 등록했는지 체크 - 내 idx로 task 검색
                        let data1 = [user_idx, "0000-00-00 00:00:00"];
                        connection.query(selectQuery, data1, function (err2, rows2) {
                            if (err2) {
                                console.log("Connection Error2 : " + err2);
                                res.status(500).send({ message: "Connection Error2 : " + err2 });
                                connection.release();
                            } else {
                                //res.status(200).send({ message: rows2 }); //디버깅
                                //등록을 안했으면
                                if (rows2 == '') {
                                    //current_tasks의 정보 past_tasks로 옮김 / 삭제는 안함
                                    connection.query(insertQuery, user_idx, function (err3, rows3) {
                                        if (err3) {
                                            console.log("Connection Error3 : " + err3);
                                            res.status(500).send({ message: "Connection Error3 : " + err3, result : user_idx });
                                            connection.release();
                                        } else {
                                            console.log("정보 옮김!");
                                            check = true;
                                        }
                                    });
                                    
                                    let data2 = [user_comment, user_star, "0000-00-00 00:00:00"];
                                }
                                //등록했으면 
                                else {
                                    //이미 pask_taskscurrent_task삭제
                                    connection.query(deleteQuery, user_idx, function (err3, rows3) {
                                        if (err3) {
                                            console.log("Connection Error4 : " + err3);
                                            res.status(500).send({ message: "Connection Error4 : " + err3 });
                                            connection.release();
                                        } else {
                                            console.log("정보 삭제!");
                                            check = true;
                                        }
                                    });

                                    let data2 = [user_comment, user_star, now.Date];                                    
                                }
                                //pask_tasks에 별점 등록 - 공동이라서 밖으로 빼둠
                                if (check) {
                                    connection.query(updateQuery, data2, function (err3, rows3) {
                                        if (err3) {
                                            console.log("Connection Error : " + err3);
                                            res.status(500).send({ message: "Connection Error : " + err3 });
                                            connection.release();
                                        } else {
                                            console.log("1차 별점 등록!");
                                            res.status(200).send({ message: "Success" });
                                        }
                                    });
                                } 
                            }
                        });
                    }
                });
            }
        }
    });
});


module.exports = router;
